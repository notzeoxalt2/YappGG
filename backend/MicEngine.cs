using System.Text.Json;
using System.Runtime.InteropServices;
using Microsoft.Data.Sqlite;
using NAudio.CoreAudioApi;
using SonarAPOSettingsControl;
using SoundStageAudioStreamProcessingInteropLib;
using NAudio.Wave;

namespace MicOnly;

public record Preset(string Id, string Name, bool BuiltIn, bool Favorite, JsonElement Data)
{
    public override string ToString() => Name + (BuiltIn ? "" : " · custom") + (Favorite ? " ★" : "");
}

public sealed class MicEngine : IDisposable
{
    [ComVisible(true),ClassInterface(ClassInterfaceType.None)]public sealed class RoutingEvents:IInteropEventsClient{public string? Error;public void OnRoutingError(RoutingError_t error){Error=$"0x{error.result:X8}: {error.message}";Console.Error.WriteLine("Routing error: "+Error);}}
    readonly RoutingEvents events=new();
    readonly IBasicControl control;
    readonly IStore store;
    IAudioStreamManager? stream;
    readonly Dictionary<string, ISetting> settings = new();
    EndpointVisibility? visibility;
    MMDevice? inputDevice,processedDevice;
    WasapiCapture? recorder;
    WasapiCapture? meter;
    float outputPeak,currentGain=1;
    bool currentMuted;
    FunMicrophone? fun;
    JsonElement? funPreset;
    JsonElement? afterEffect;
    readonly SoundboardMixer soundboard=new();bool soundboardEnabled;
    WaveFileWriter? recordingWriter;
    string? recordingPath;
    long recordingBytes;
    double recordingSquares;
    float recordingPeak;
    long recordingSamples;
    readonly object recordLock=new();
    public bool Running => fun?.Running==true||stream?.IsRunning()==1;
    public MicEngine()
    {
        control = NativeEngine.OpenMicrophone();
        control.OpenStore(out store);
    }
    ISetting Setting(string name)
    {
        if (!settings.TryGetValue(name, out var s)) { store.OpenSetting(Enum.Parse<ESetting>("kSet_" + name), out s); settings[name] = s; }
        return s;
    }
    public bool Bool(string name) { Setting(name).GetBoolSetting(out var v); return v; }
    public float Float(string name) { Setting(name).GetFloatSetting(out var v); return v; }
    public int Long(string name) { Setting(name).GetLongSetting(out var v); return v; }
    public void Set(string name, bool value) => Setting(name).SetBoolSetting(value);
    public void Set(string name, float value)
    {
        var s = Setting(name); s.GetFloatTraits(out _, out var min, out var max);
        if (!float.IsFinite(value) || value < min || value > max) throw new ArgumentOutOfRangeException(name, $"Allowed range: {min}–{max}");
        s.SetFloatSetting(value);
    }
    public void Set(string name, int value)
    {
        var s = Setting(name); s.GetLongTraits(out _, out var min, out var max);
        if (value < min || value > max) throw new ArgumentOutOfRangeException(name);
        s.SetLongSetting(value);
    }
    public (float Min, float Max) Range(string name) { Setting(name).GetFloatTraits(out _, out var min, out var max); return (min,max); }
    public static bool IsSonarMic(MMDevice d)=>AudioPolicy.IsGG(d);
    public static List<MMDevice> Inputs()
    {
        using var e = new MMDeviceEnumerator();
        return e.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active).Where(d => !IsSonarMic(d)&&!d.FriendlyName.Contains("SteelSeries Sonar", StringComparison.OrdinalIgnoreCase)).ToList();
    }
    public void Start(string inputId)
    {
        if (System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length > 0)
            throw new InvalidOperationException("Close SteelSeries GG/Sonar before starting this app's mic engine.");
        using var e = new MMDeviceEnumerator();
        visibility??=new EndpointVisibility();
        foreach(var d in e.EnumerateAudioEndPoints(DataFlow.All,DeviceState.All).Where(d=>IsSonarMic(d)&&((int)d.State&3)!=0))
        {
            try{visibility.Enable(d.ID,d.State==DeviceState.Active);}catch(Exception error){Console.Error.WriteLine($"Endpoint {d.ID} visibility: {error.Message}");}
            d.Dispose();
        }
        Thread.Sleep(150);
        using var output = e.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active).FirstOrDefault(IsSonarMic)
            ?? throw new InvalidOperationException("The installed Sonar virtual microphone render endpoint is unavailable.");
        using var capture = e.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active).FirstOrDefault(IsSonarMic)
            ?? throw new InvalidOperationException("The installed Sonar virtual microphone capture endpoint is unavailable.");
        Stop();
        Directory.SetCurrentDirectory(NativeEngine.SonarPath);
        inputDevice?.Dispose();processedDevice?.Dispose();
        inputDevice=e.GetDevice(inputId);processedDevice=e.GetDevice(capture.ID);events.Error=null;
        if(afterEffect.HasValue||funPreset.HasValue||currentGain>1||soundboardEnabled){
            MirrorCaptureEq();Set("CaptureState",true);
            fun=new FunMicrophone(inputDevice,output,afterEffect??funPreset,capture.ID,soundboard);fun.Gain(currentGain,currentMuted);fun.Start();
        }else{
            stream ??= (IAudioStreamManager)new AudioStreamManagerClass();
            stream.RegisterEventsClient(events);
            stream.SetInputDevice(inputId);stream.SetOutputDevice(output.ID);stream.SetMonitoredDevice(capture.ID);
            stream.SetOutputLinearGain(currentGain);stream.SetOutputMute(currentMuted?1:0);
            stream.SetCopyOutputMute(1);stream.SetCopyOutputLinearGain(0);stream.SetStreamEffectState(1);
            Set("CaptureState",true);stream.Start();
        }
        if (!Running) throw new InvalidOperationException("The microphone stream did not start.");
        if(meter!=null){meter.StopRecording();meter.Dispose();}
        meter=new WasapiCapture(processedDevice);meter.DataAvailable+=(_,args)=>{float peak=0;for(int offset=0;offset+4<=args.BytesRecorded;offset+=4){float value=BitConverter.ToSingle(args.Buffer,offset);if(float.IsFinite(value))peak=Math.Max(peak,Math.Abs(value));}outputPeak=peak;};meter.StartRecording();
    }
    public void Stop() { soundboard.Stop();RecordStop();fun?.Dispose();fun=null;if(meter!=null){meter.StopRecording();meter.Dispose();meter=null;outputPeak=0;}if (stream != null && Running) stream.Stop(); }
    public void Gain(float value,bool muted){if(!float.IsFinite(value)||value<0||value>1000000)throw new ArgumentOutOfRangeException(nameof(value));var wasRunning=Running;currentGain=value;currentMuted=muted;if(wasRunning&&fun==null&&value>1){Start(inputDevice!.ID);return;}fun?.Gain(value,muted);if(fun==null&&value<=1){stream?.SetOutputLinearGain(value);stream?.SetOutputMute(muted?1:0);}}
    void MirrorCaptureEq(){for(int i=1;i<=10;i++){var p="ParametricEqFilter"+i;Set("Capture"+p+"State",Bool(p+"State"));foreach(var f in new[]{"FreqHz","Q","GainDb"})Set("Capture"+p+f,Float(p+f));Set("Capture"+p+"Type",Long(p+"Type"));}Set("CaptureParametricEqState",Bool("ParametricEqState"));}
    public void AfterEffect(JsonElement? value){var wasRunning=Running;var input=inputDevice?.ID;afterEffect=value?.Clone();if(fun!=null){fun.ChangeEffect(afterEffect??funPreset);return;}if(wasRunning&&input!=null&&afterEffect.HasValue)Start(input);}
    public void PrepareSoundboard(){soundboardEnabled=true;if(Running&&fun==null)Start(inputDevice!.ID);}
    public void PlaySound(string id,string path,float volume){if(!Running)throw new InvalidOperationException("Start microphone processing to play sounds.");PrepareSoundboard();soundboard.Play(id,path,volume);}
    public void StopSounds(string? id=null)=>soundboard.Stop(id);
    public object Status()=>new{running=Running,soundboardPlaying=soundboard.Playing,inputId=inputDevice?.ID,inputPeak=inputDevice?.AudioMeterInformation.MasterPeakValue??0,outputPeak,outputName=processedDevice?.FriendlyName,outputId=processedDevice?.ID,recording=recorder!=null,gain=currentGain,muted=currentMuted,effect=fun?.Name,cleanFirst=fun?.CleanFirst==true,afterEffectEnabled=afterEffect.HasValue,copyMuted=fun!=null||stream?.GetCopyOutputMute()==1,copyDevice=fun!=null?"":stream?.GetCopyOutputDevice(),outputMute=processedDevice?.AudioEndpointVolume.Mute,outputVolume=processedDevice?.AudioEndpointVolume.MasterVolumeLevelScalar,routingError=fun?.Error??events.Error};
    public void RecordStart(string path)
    {
        if(!Running||processedDevice==null)throw new InvalidOperationException("Start microphone processing before recording.");
        RecordStop();recordingPath=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(recordingPath)!);
        recorder=new WasapiCapture(processedDevice);recordingWriter=new WaveFileWriter(recordingPath,recorder.WaveFormat);
        recordingBytes=recordingSamples=0;recordingSquares=0;recordingPeak=0;
        recorder.DataAvailable+=(_,args)=>{lock(recordLock){
            recordingWriter?.Write(args.Buffer,0,args.BytesRecorded);recordingBytes+=args.BytesRecorded;
            if(recorder?.WaveFormat.BitsPerSample==32){for(int offset=0;offset+4<=args.BytesRecorded;offset+=4){var value=BitConverter.ToSingle(args.Buffer,offset);if(float.IsFinite(value)){recordingPeak=Math.Max(recordingPeak,Math.Abs(value));recordingSquares+=value*value;recordingSamples++;}}}
        }};
        recorder.StartRecording();
    }
    public object RecordStop()
    {
        if(recorder!=null){using var stopped=new ManualResetEventSlim();recorder.RecordingStopped+=(_,_)=>stopped.Set();recorder.StopRecording();stopped.Wait(2000);lock(recordLock){recordingWriter?.Dispose();recordingWriter=null;recorder.Dispose();recorder=null;}}
        return new{path=recordingPath,bytes=recordingBytes,samples=recordingSamples,peak=recordingPeak,rms=recordingSamples>0?Math.Sqrt(recordingSquares/recordingSamples):0};
    }
    public object CaptureTest(int milliseconds){if(milliseconds<100||milliseconds>15000)throw new ArgumentOutOfRangeException(nameof(milliseconds));RecordStart(Path.Combine(AppContext.BaseDirectory,"..","..","original-mic-data","native-audio-test.wav"));Thread.Sleep(milliseconds);return RecordStop();}
    public static List<Preset> ImportPresets(string database)
    {
        using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = database, Mode = SqliteOpenMode.ReadOnly }.ToString());
        db.Open();
        using var q = db.CreateCommand();
        q.CommandText = "SELECT id,name,is_preset,is_favorite,data,schema_version FROM configs WHERE vad=3 ORDER BY is_favorite DESC,is_preset DESC,name";
        using var rows = q.ExecuteReader();
        var result = new List<Preset>();
        while (rows.Read())
        {
            if (rows.GetInt32(5) is not (5 or 6)) throw new InvalidDataException("Unsupported mic preset schema. Expected version 5 or 6; no settings were changed.");
            using var doc = JsonDocument.Parse(rows.GetString(4));
            result.Add(new(rows.GetString(0), rows.GetString(1), rows.GetBoolean(2), rows.GetBoolean(3), doc.RootElement.Clone()));
        }
        return result;
    }
    public static string? SelectedPresetId(string database)
    {
        using var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=database,Mode=SqliteOpenMode.ReadOnly}.ToString());db.Open();
        using var q=db.CreateCommand();q.CommandText="SELECT config_id FROM selected_config WHERE vad=3";return q.ExecuteScalar() as string;
    }
    static readonly (string Key,string State,string Value)[] mappings = {
        ("noiseCancelingState","NoiseCancelingState","NoiseCancelingMixFactor"),
        ("noiseReductionState","CaptureAmbientNoiseReductionState","CaptureAmbientNoiseReductionRate"),
        ("impactNoiseReductionState","ImpactNoiseReductionState","ImpactNoiseReductionAgressiveness"),
        ("noiseGateState","NoiseGateState","NoiseGateThresholdDB"),
        ("automaticNoiseGateState","NoiseGateAutoThreshold","NoiseGateOffsetDB"),
        ("volumeStabilizerState","CaptureCompressorState","CaptureCompressorLevel")
    };
    public static readonly string[] FilterTypes = { "byPass", "lowPass", "highPass", "bandPassPeakQ", "bandPassPeak0dB", "notchFilter", "allPass", "peakingEQ", "lowShelving", "highShelving" };
    public Dictionary<string,object> Snapshot()
    {
        var values=new Dictionary<string,object>();
        foreach (var (_,state,value) in mappings) { values[state]=Bool(state); values[value]=Float(value); }
        values["ParametricEqState"]=Bool("ParametricEqState");
        values["CaptureState"]=Bool("CaptureState");values["CaptureParametricEqState"]=Bool("CaptureParametricEqState");
        values["AECState"]=Bool("AECState");
        for(var i=1;i<=10;i++)
        {
            var p=$"ParametricEqFilter{i}";
            values[p+"State"]=Bool(p+"State");
            foreach(var field in new[]{"FreqHz","Q","GainDb"}) values[p+field]=Float(p+field);
            values[p+"Type"]=Long(p+"Type");var cp="Capture"+p;values[cp+"State"]=Bool(cp+"State");foreach(var field in new[]{"FreqHz","Q","GainDb"})values[cp+field]=Float(cp+field);values[cp+"Type"]=Long(cp+"Type");
        }
        return values;
    }
    public void Restore(Dictionary<string,object> values)
    {
        foreach(var (key,value) in values)
            if(value is bool b) Set(key,b); else if(value is int i) Set(key,i); else Set(key,Convert.ToSingle(value));
    }
    public void Apply(Preset preset)
    {
        var before=Snapshot();var source=inputDevice?.ID;bool wasRunning=Running;var oldFun=funPreset;
        try
        {
            var d=preset.Data;
            foreach(var (key,state,value) in mappings)
            {
                var item=d.GetProperty(key);
                Set(value,item.GetProperty("value").GetSingle());
                Set(state,item.GetProperty("enabled").GetBoolean());
            }
            if(d.TryGetProperty("acousticEchoCancelingState",out var aec)) Set("AECState",aec.GetBoolean());
            if(d.TryGetProperty("globalEnableState",out var global)) Set("CaptureState",global.GetBoolean());
            var eq=d.GetProperty("parametricEQ");
            for(var i=1;i<=10;i++)
            {
                var f=eq.GetProperty($"filter{i}"); var p=$"ParametricEqFilter{i}";
                Set(p+"FreqHz",f.GetProperty("frequency").GetSingle());
                Set(p+"Q",f.GetProperty("qFactor").GetSingle());
                Set(p+"GainDb",f.GetProperty("gain").GetSingle());
                var type=Array.FindIndex(FilterTypes,t=>t.Equals(f.GetProperty("type").GetString(),StringComparison.OrdinalIgnoreCase));
                if(type<0) throw new InvalidDataException("Unknown EQ filter type.");
                Set(p+"Type",type); Set(p+"State",f.GetProperty("enabled").GetBoolean());
            }
            Set("ParametricEqState",eq.GetProperty("enabled").GetBoolean());
            funPreset=d.TryGetProperty("yappggEffect",out var effect)&&effect.ValueKind==JsonValueKind.Object?d.Clone():null;
            if(fun!=null){MirrorCaptureEq();fun.ChangeEffect(afterEffect??funPreset);}else if(wasRunning&&source!=null&&(oldFun.HasValue||funPreset.HasValue||afterEffect.HasValue||currentGain>1))Start(source);
        }
        catch { funPreset=oldFun;Restore(before);throw; }
    }
    public Preset SavePreset(string name)
    {
        var d=new Dictionary<string,object>();
        foreach(var (key,state,value) in mappings) d[key]=new { enabled=Bool(state),value=Float(value) };
        d["acousticEchoCancelingState"]=Bool("AECState");
        d["globalEnableState"]=Bool("CaptureState");
        var eq=new Dictionary<string,object>{{"enabled",Bool("ParametricEqState")}};
        for(var i=1;i<=10;i++) { var p=$"ParametricEqFilter{i}"; eq[$"filter{i}"]=new {enabled=Bool(p+"State"),frequency=Float(p+"FreqHz"),qFactor=Float(p+"Q"),gain=Float(p+"GainDb"),type=FilterTypes[Long(p+"Type")]}; }
        d["parametricEQ"]=eq;
        return new(Guid.NewGuid().ToString(),name,false,false,JsonSerializer.SerializeToElement(d));
    }
    public void Dispose()
    {
        Stop();
        if(stream!=null) Marshal.FinalReleaseComObject(stream);
        foreach(var s in settings.Values) Marshal.FinalReleaseComObject(s);
        Marshal.FinalReleaseComObject(store); Marshal.FinalReleaseComObject(control);
        visibility?.Dispose();
        inputDevice?.Dispose();processedDevice?.Dispose();
    }
}
