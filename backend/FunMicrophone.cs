using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.Dsp;
using NAudio.Wave;
namespace MicOnly;

// Deliberately degraded voice: band limiting, hard clipping, sample-and-hold,
// and reduced bit depth. Clean presets continue using the native ClearCast path.
sealed class FunDsp
{
    readonly List<BiQuadFilter> filters = new();
    readonly float drive, ceiling, levels;
    readonly int holdFrames;
    int heldFor;
    float held;
    public string Name { get; }
    public FunDsp(JsonElement data, int sampleRate)
    {
        var effect = data.GetProperty("yappggEffect");
        Name = effect.GetProperty("name").GetString()!;
        drive = Math.Clamp(effect.GetProperty("drive").GetSingle(), 1, 80);
        ceiling = Math.Clamp(effect.GetProperty("clip").GetSingle(), .1f, 1);
        levels = (1 << Math.Clamp(effect.GetProperty("bits").GetInt32(), 4, 16)) / 2f;
        holdFrames = Math.Max(1, sampleRate / Math.Clamp(effect.GetProperty("rate").GetInt32(), 4000, sampleRate));
        filters.Add(BiQuadFilter.HighPassFilter(sampleRate, effect.GetProperty("lowCut").GetSingle(), .707f));
        filters.Add(BiQuadFilter.LowPassFilter(sampleRate, Math.Min(effect.GetProperty("highCut").GetSingle(), sampleRate*.45f), .707f));
        var eq = data.GetProperty("parametricEQ");
        if (eq.GetProperty("enabled").GetBoolean()) for (int i=1;i<=10;i++)
        {
            var f=eq.GetProperty("filter"+i);if(!f.GetProperty("enabled").GetBoolean())continue;
            float hz=Math.Min(f.GetProperty("frequency").GetSingle(),sampleRate*.45f),q=f.GetProperty("qFactor").GetSingle(),db=f.GetProperty("gain").GetSingle();
            filters.Add(f.GetProperty("type").GetString() switch {
                "lowShelving"=>BiQuadFilter.LowShelf(sampleRate,hz,1,db),
                "highShelving"=>BiQuadFilter.HighShelf(sampleRate,hz,1,db),
                "highPass"=>BiQuadFilter.HighPassFilter(sampleRate,hz,q),
                "lowPass"=>BiQuadFilter.LowPassFilter(sampleRate,hz,q),
                _=>BiQuadFilter.PeakingEQ(sampleRate,hz,q,db)
            });
        }
    }
    public float Process(float sample)
    {
        foreach(var f in filters)sample=f.Transform(sample);
        if(heldFor++ % holdFrames==0)held=MathF.Round(Math.Clamp(sample*drive,-ceiling,ceiling)/ceiling*levels)/levels*.92f;
        return held;
    }
    public static object Measure(JsonElement data)
    {
        const int rate=48000;var dsp=new FunDsp(data,rate);double sum=0,inputSum=0;float peak=0;
        int saturated=0;var levels=new HashSet<float>();
        for(int i=0;i<rate;i++){
            var input=.01f*MathF.Sin(2*MathF.PI*1000*i/rate);var output=dsp.Process(input);
            if(i<rate/2)continue;
            sum+=output*output;inputSum+=input*input;peak=Math.Max(peak,Math.Abs(output));
            if(Math.Abs(output)>.9)saturated++;levels.Add(output);
        }
        return new{name=dsp.Name,inputRms=Math.Sqrt(inputSum/(rate/2)),outputRms=Math.Sqrt(sum/(rate/2)),peak,saturatedFraction=(double)saturated/(rate/2),distinctLevels=levels.Count};
    }
}
sealed class FunMicrophone : IDisposable
{
    readonly WasapiCapture capture;
    readonly WasapiOut output;
    readonly BufferedWaveProvider buffer;
    volatile FunDsp? dsp;
    readonly NativeCleanup? cleanup;
    readonly float[] board=new float[4096];
    volatile float gain=1;
    volatile bool muted, closing;
    public bool Running { get; private set; }
    public string? Error { get; private set; }
    public string? Name=>dsp?.Name;
    public bool CleanFirst=>cleanup!=null;
    public FunMicrophone(MMDevice input,MMDevice target,JsonElement? preset,string? cleanedCaptureId=null,SoundboardMixer? soundboard=null)
    {
        capture=new WasapiCapture(input,true,20);
        if(soundboard!=null)soundboard.SampleRate=capture.WaveFormat.SampleRate;
        dsp=preset.HasValue?new FunDsp(preset.Value,capture.WaveFormat.SampleRate):null;
        if(cleanedCaptureId!=null)cleanup=new NativeCleanup(cleanedCaptureId,capture.WaveFormat.SampleRate);
        buffer=new BufferedWaveProvider(WaveFormat.CreateIeeeFloatWaveFormat(capture.WaveFormat.SampleRate,2)){BufferDuration=TimeSpan.FromMilliseconds(250),DiscardOnBufferOverflow=true,ReadFully=true};
        output=new WasapiOut(target,AudioClientShareMode.Shared,false,40);
        output.Init(buffer);
        capture.DataAvailable+=(_,a)=>{
            var format=capture.WaveFormat;int bytes=format.BitsPerSample/8,channels=format.Channels,frames=a.BytesRecorded/format.BlockAlign;
            var result=new byte[frames*8];
            bool floating=format.Encoding==WaveFormatEncoding.IeeeFloat||(format is WaveFormatExtensible ext&&ext.SubFormat==new Guid("00000003-0000-0010-8000-00aa00389b71"));
            var activeDsp=dsp;
            try{for(int offset=0;offset<frames;offset+=4096){
                int count=Math.Min(4096,frames-offset);var clean=new float[count*2];
                for(int frame=0;frame<count;frame++){
                    float sample=0;for(int ch=0;ch<channels;ch++){int at=(frame+offset)*format.BlockAlign+ch*bytes;sample+=floating?BitConverter.ToSingle(a.Buffer,at):bytes==2?BitConverter.ToInt16(a.Buffer,at)/32768f:bytes==4?BitConverter.ToInt32(a.Buffer,at)/2147483648f:0;}
                    clean[frame*2]=clean[frame*2+1]=sample/channels;
                }
                cleanup?.Process(clean,count);
                soundboard?.Mix(board,count);
                for(int frame=0;frame<count;frame++){
                    float sample=(clean[frame*2]+clean[frame*2+1])*.5f;sample=activeDsp?.Process(sample)??sample;sample=muted?0:Math.Clamp(sample*gain+board[frame],-.98f,.98f);
                    BitConverter.TryWriteBytes(result.AsSpan((frame+offset)*8,4),sample);BitConverter.TryWriteBytes(result.AsSpan((frame+offset)*8+4,4),sample);
                }
            }}catch(Exception error){Error=error.Message;Running=false;return;}
            if(!closing)buffer.AddSamples(result,0,result.Length);
        };
        capture.RecordingStopped+=(_,a)=>{if(!closing&&a.Exception!=null){Error=a.Exception.Message;Running=false;}};
        output.PlaybackStopped+=(_,a)=>{if(!closing&&a.Exception!=null){Error=a.Exception.Message;Running=false;}};
    }
    public void Start(){capture.StartRecording();output.Play();Running=true;}
    public void ChangeEffect(JsonElement? preset){dsp=preset.HasValue?new FunDsp(preset.Value,capture.WaveFormat.SampleRate):null;}
    public void Gain(float value,bool mute){gain=value;muted=mute;}
    public void Dispose(){closing=true;Running=false;using var stopped=new ManualResetEventSlim();capture.RecordingStopped+=(_,_)=>stopped.Set();capture.StopRecording();stopped.Wait(2000);output.Stop();capture.Dispose();output.Dispose();cleanup?.Dispose();}
}
