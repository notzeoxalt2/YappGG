using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using NAudio.Dsp;

namespace MicOnly;

// Shared WASAPI capture and a separate cable render endpoint. No Sonar COM,
// registry settings, APOs, copy output or global Windows default changes.
sealed class IndependentEngine : IDisposable
{
    WasapiCapture? capture; WasapiOut? output; MMDevice? inputDevice,outputDevice;
    BufferedWaveProvider? queue; VoiceProcessor? processor; Thread? testPump;
    YappGGFeed? nativeFeed; volatile bool running; JsonElement configuration; float gain=1; bool muted;
    public bool Running=>running;
    public static bool IsCable(MMDevice d){try{return d.FriendlyName.StartsWith("YappGG Microphone",StringComparison.OrdinalIgnoreCase)||(d.FriendlyName.Contains("VB-Audio",StringComparison.OrdinalIgnoreCase)&&d.FriendlyName.Contains("Cable",StringComparison.OrdinalIgnoreCase));}catch(System.Runtime.InteropServices.COMException){return false;}}
    public static object CaptureCable(string path,int milliseconds){using var e=new MMDeviceEnumerator();using var device=e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).First(IsCable);using var capture=new WasapiCapture(device,false,20);using var writer=new WaveFileWriter(path,capture.WaveFormat);long bytes=0;capture.DataAvailable+=(_,a)=>{writer.Write(a.Buffer,0,a.BytesRecorded);bytes+=a.BytesRecorded;};capture.StartRecording();Thread.Sleep(milliseconds);capture.StopRecording();return new{path,bytes,name=device.FriendlyName,format=capture.WaveFormat.ToString()};}
    public static object Devices(){using var e=new MMDeviceEnumerator();return new{render=e.EnumerateAudioEndPoints(DataFlow.Render,DeviceState.Active).Where(IsCable).Select(d=>new{id=d.ID,name=d.FriendlyName}).ToArray(),capture=e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).Where(IsCable).Select(d=>new{id=d.ID,name=d.FriendlyName}).ToArray()};}
    public void Apply(JsonElement data){configuration=data.Clone();processor?.Configure(configuration);}
    public void Gain(float value,bool mute){if(!float.IsFinite(value)||value<0||value>2)throw new ArgumentOutOfRangeException(nameof(value));gain=value;muted=mute;if(processor!=null){processor.Gain=value;processor.Muted=mute;}}
    public void Start(string inputId,bool testOnly=false,bool cableTest=false,bool allowSonar=false)
    {
        Stop();using var e=new MMDeviceEnumerator();inputDevice=e.GetDevice(inputId);
        if(inputDevice.DataFlow!=DataFlow.Capture||inputDevice.State!=DeviceState.Active||(!allowSonar&&AudioDevices.IsSonarMic(inputDevice))||IsCable(inputDevice))throw new InvalidOperationException("Choose a physical microphone for YappGG input.");
        if(!testOnly&&!cableTest)nativeFeed=new YappGGFeed();
        if(cableTest){outputDevice=e.EnumerateAudioEndPoints(DataFlow.Render,DeviceState.Active).Where(IsCable).OrderBy(d=>d.FriendlyName.Contains("16ch",StringComparison.OrdinalIgnoreCase)?1:0).FirstOrDefault()??throw new InvalidOperationException("Install the separate VB-CABLE microphone driver, then retry. GG can remain open.");}
        capture=new WasapiCapture(inputDevice,false,20);
        queue=new BufferedWaveProvider(capture.WaveFormat){BufferDuration=TimeSpan.FromMilliseconds(250),DiscardOnBufferOverflow=true,ReadFully=true};
        ISampleProvider source=queue.ToSampleProvider();
        if(source.WaveFormat.Channels==2)source=new StereoToMonoSampleProvider(source){LeftVolume=.5f,RightVolume=.5f};
        if(source.WaveFormat.Channels!=1)throw new InvalidOperationException("This microphone channel format is unsupported.");
        source=new WdlResamplingSampleProvider(source,48000);processor=new VoiceProcessor(source);processor.Configure(configuration);Gain(gain,muted);
        capture.DataAvailable+=(_,a)=>queue.AddSamples(a.Buffer,0,a.BytesRecorded);
        capture.RecordingStopped+=(_,a)=>{if(a.Exception!=null){Error=a.Exception.Message;running=false;}};
        running=true;Error=null;capture.StartRecording();
        if(testOnly||nativeFeed!=null){testPump=new Thread(()=>{try{var block=new float[480];while(running){int count=processor.Read(block,0,block.Length);nativeFeed?.Write(block,count);Thread.Sleep(10);}}catch(Exception error){Error=error.Message;running=false;}}){IsBackground=true};testPump.Start();}
        else{output=new WasapiOut(outputDevice!,AudioClientShareMode.Shared,true,30);output.PlaybackStopped+=(_,a)=>{if(a.Exception!=null){Error=a.Exception.Message;running=false;}};output.Init(processor.ToWaveProvider());output.Play();}
    }
    public string? Error;
    public object Status()=>new{running=Running,inputId=inputDevice?.ID,inputPeak=processor?.InputPeak??0,outputPeak=processor?.OutputPeak??0,recording=processor?.Recording??false,outputName=nativeFeed!=null?"YappGG Microphone":outputDevice?.FriendlyName,mode="independent",routingError=Error,gain,muted};
    public object Snapshot()=>configuration;
    public void RecordStart(string path){if(!running||processor==null)throw new InvalidOperationException("Start processing first.");processor.RecordStart(path);}
    public object RecordStop()=>processor?.RecordStop()??new{path="",bytes=0,samples=0,peak=0,rms=0};
    public void Stop(){running=false;capture?.StopRecording();output?.Stop();testPump?.Join(1000);testPump=null;nativeFeed?.Dispose();nativeFeed=null;processor?.RecordStop();capture?.Dispose();output?.Dispose();inputDevice?.Dispose();outputDevice?.Dispose();capture=null;output=null;inputDevice=outputDevice=null;processor=null;queue=null;}
    public void Dispose()=>Stop();
    public static int Server(){using var engine=new IndependentEngine();Console.WriteLine(JsonSerializer.Serialize(new{ready=true,mode="independent",running=false}));string? line;while((line=Console.ReadLine())!=null){using var doc=JsonDocument.Parse(line);var m=doc.RootElement;int id=m.GetProperty("id").GetInt32();try{object? extra=null;switch(m.GetProperty("command").GetString()){
      case "apply":engine.Apply(m.GetProperty("data"));break;
      case "start":engine.Start(m.GetProperty("inputId").GetString()!,m.TryGetProperty("testOnly",out var test)&&test.GetBoolean(),m.TryGetProperty("cableTest",out var cableTest)&&cableTest.GetBoolean(),m.TryGetProperty("allowSonar",out var allowSonar)&&allowSonar.GetBoolean());break;
      case "stop":engine.Stop();break;
      case "gain":engine.Gain(m.GetProperty("value").GetSingle(),m.TryGetProperty("muted",out var mute)&&mute.GetBoolean());break;
      case "status":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,status=engine.Status()}));continue;
      case "snapshot":extra=engine.Snapshot();Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,settings=extra}));continue;
      case "record-start":engine.RecordStart(m.GetProperty("path").GetString()!);break;
      case "record-stop":extra=engine.RecordStop();Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,recording=extra}));continue;
      default:throw new InvalidOperationException("Unknown independent audio command.");
    }Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,running=engine.Running}));}catch(Exception error){engine.Error=error.Message;Console.WriteLine(JsonSerializer.Serialize(new{id,ok=false,error=error.Message}));}}return 0;}
}

sealed class VoiceProcessor : ISampleProvider
{
    readonly ISampleProvider source;readonly object sync=new();BiQuadFilter[] filters=[];
    double envelope,compressEnvelope,noiseFloor=.0005,gateGain=1;bool gate,autoGate,compress,cleanup,ambient,impact,eq;
    double threshold=-60,strength,compression,ambientStrength,impactStrength;bool enabled=true;
    WaveFileWriter? writer;string? recordingPath;long samples;double squares;float peak;
    public float Gain=1;public bool Muted;public float InputPeak,OutputPeak;
    public WaveFormat WaveFormat=>source.WaveFormat;public bool Recording=>writer!=null;
    public VoiceProcessor(ISampleProvider source){this.source=source;}
    static bool On(JsonElement d,string key)=>d.TryGetProperty(key,out var s)&&s.TryGetProperty("enabled",out var v)&&v.GetBoolean();
    static double Value(JsonElement d,string key,double fallback=0)=>d.TryGetProperty(key,out var s)&&s.TryGetProperty("value",out var v)?v.GetDouble():fallback;
    public void Configure(JsonElement d){if(d.ValueKind!=JsonValueKind.Object)return;lock(sync){
      enabled=!d.TryGetProperty("globalEnableState",out var global)||global.GetBoolean();eq=On(d,"parametricEQ");
      gate=On(d,"noiseGateState");autoGate=On(d,"automaticNoiseGateState");threshold=Value(d,"noiseGateState",-60);
      cleanup=On(d,"noiseCancelingState");strength=Value(d,"noiseCancelingState");compress=On(d,"volumeStabilizerState");compression=Value(d,"volumeStabilizerState");
      ambient=On(d,"noiseReductionState");impact=On(d,"impactNoiseReductionState");ambientStrength=Value(d,"noiseReductionState");impactStrength=Value(d,"impactNoiseReductionState");
      var list=new List<BiQuadFilter>();if(eq&&d.TryGetProperty("parametricEQ",out var data))for(int i=1;i<=10;i++){if(!data.TryGetProperty("filter"+i,out var f)||!f.GetProperty("enabled").GetBoolean())continue;float freq=f.GetProperty("frequency").GetSingle(),q=f.GetProperty("qFactor").GetSingle(),g=f.GetProperty("gain").GetSingle();if(!float.IsFinite(freq)||!float.IsFinite(q)||!float.IsFinite(g)||freq<10||freq>=24000||q<=0)throw new ArgumentException("Invalid EQ band.");var filter=f.GetProperty("type").GetString() switch{
        "lowShelving"=>BiQuadFilter.LowShelf(48000,freq,1,g),"highShelving"=>BiQuadFilter.HighShelf(48000,freq,1,g),"peakingEQ"=>BiQuadFilter.PeakingEQ(48000,freq,q,g),
        "lowPass"=>BiQuadFilter.LowPassFilter(48000,freq,q),"highPass"=>BiQuadFilter.HighPassFilter(48000,freq,q),"notchFilter"=>BiQuadFilter.NotchFilter(48000,freq,q),"allPass"=>BiQuadFilter.AllPassFilter(48000,freq,q),"bandPassPeakQ"=>BiQuadFilter.BandPassFilterConstantSkirtGain(48000,freq,q),"bandPassPeak0dB"=>BiQuadFilter.BandPassFilterConstantPeakGain(48000,freq,q),"byPass"=>null,_=>throw new ArgumentException("Unsupported EQ filter.")};if(filter!=null)list.Add(filter);}
      filters=list.ToArray();}}
    public int Read(float[] buffer,int offset,int count){int read=source.Read(buffer,offset,count);float inPeak=0,outPeak=0;lock(sync){for(int n=offset;n<offset+read;n++){
      double x=buffer[n];if(!double.IsFinite(x))x=0;inPeak=Math.Max(inPeak,(float)Math.Abs(x));
      double abs=Math.Abs(x);envelope+=(abs>envelope?.006:.0004)*(abs-envelope);
      if(envelope<noiseFloor*3)noiseFloor+=(envelope-noiseFloor)*.00002;
      noiseFloor=Math.Clamp(noiseFloor,.00001,.015);
      if(enabled){if(cleanup||ambient){double level=cleanup?strength:ambientStrength;double floor=noiseFloor*(1.5+level*4);double expansion=envelope>=floor?1:Math.Pow(Math.Max(envelope/floor,.05),1+level);x*=expansion;}
        if(gate){double floor=autoGate?Math.Max(noiseFloor*4,.0001):Math.Pow(10,threshold/20);double target=envelope>floor?1:0;gateGain+=(target-gateGain)*(target>gateGain?.01:.0002);x*=gateGain;}
        if(impact&&!cleanup&&abs>Math.Max(envelope*5,.25))x*=1-impactStrength*.7;
        foreach(var filter in filters)x=filter.Transform((float)x);
        if(compress){double loud=Math.Abs(x);compressEnvelope+=(loud>compressEnvelope?.004:.0001)*(loud-compressEnvelope);double db=20*Math.Log10(Math.Max(compressEnvelope,.000001)),knee=-10-compression*14,ratio=1+compression*5;if(db>knee)x*=Math.Pow(10,(knee+(db-knee)/ratio-db)/20);x*=Math.Pow(10,compression*6/20);}
      }
      x=Muted?0:x*Gain;x=Math.Clamp(x,-1,1);buffer[n]=(float)x;outPeak=Math.Max(outPeak,(float)Math.Abs(x));
      if(writer!=null){samples++;squares+=x*x;peak=Math.Max(peak,(float)Math.Abs(x));}
    }writer?.WriteSamples(buffer,offset,read);}InputPeak=inPeak;OutputPeak=outPeak;return read;}
    public void RecordStart(string path){lock(sync){RecordStop();recordingPath=Path.GetFullPath(path);Directory.CreateDirectory(Path.GetDirectoryName(recordingPath)!);writer=new WaveFileWriter(recordingPath,WaveFormat);samples=0;squares=0;peak=0;}}
    public object RecordStop(){lock(sync){writer?.Dispose();writer=null;return new{path=recordingPath,bytes=samples*4,samples,peak,rms=samples>0?Math.Sqrt(squares/samples):0};}}
}
