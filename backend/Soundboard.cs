using NAudio.Wave;
using NAudio.Wave.SampleProviders;
namespace MicOnly;

sealed class MonoMixProvider(ISampleProvider source):ISampleProvider
{
    public WaveFormat WaveFormat { get; }=WaveFormat.CreateIeeeFloatWaveFormat(source.WaveFormat.SampleRate,1);
    float[] scratch=[];
    public int Read(float[] buffer,int offset,int count){int channels=source.WaveFormat.Channels;if(scratch.Length<count*channels)scratch=new float[count*channels];int frames=source.Read(scratch,0,count*channels)/channels;for(int i=0;i<frames;i++){float sum=0;for(int ch=0;ch<channels;ch++)sum+=scratch[i*channels+ch];buffer[offset+i]=sum/channels;}return frames;}
}
static class MediaImport
{
    public static object Decode(string input,string target){
        using var reader=new MediaFoundationReader(input);
        ISampleProvider source=new MonoMixProvider(reader.ToSampleProvider());
        if(source.WaveFormat.SampleRate!=48000)source=new WdlResamplingSampleProvider(source,48000);
        using var writer=new WaveFileWriter(target,WaveFormat.CreateIeeeFloatWaveFormat(48000,1));
        var samples=new float[4800];long total=0;int read;
        while((read=source.Read(samples,0,samples.Length))>0){total+=read;writer.WriteSamples(samples,0,read);}
        if(total==0)throw new InvalidDataException("This file has no playable audio track.");
        return new{durationSeconds=total/48000.0,sampleRate=48000};
    }
}
// Disk/decoder work belongs to the producer, never the microphone callback.
sealed class SoundboardMixer:IDisposable
{
    sealed class Voice(string id,IDisposable owner,ISampleProvider provider,float volume,int capacity)
    {
        public readonly string Id=id;public readonly IDisposable Owner=owner;public readonly ISampleProvider Provider=provider;
        public readonly float[] Samples=new float[capacity];public readonly object Gate=new();
        public int Head,Count;public volatile float Volume=volume;public volatile bool Paused,Stopped,Ended;
    }
    readonly object controls=new();readonly AutoResetEvent wake=new(false);readonly Thread producer;
    Voice[] voices=[];readonly List<Voice> retired=[];volatile bool disposed;
    long underruns;public long Underruns=>Interlocked.Read(ref underruns);public string? Error{get;private set;}
    public int SampleRate {get;set;}=48000;
    public SoundboardMixer(){producer=new Thread(Fill){IsBackground=true,Name="YappGG media prefetch",Priority=ThreadPriority.BelowNormal};producer.Start();}
    Voice[] Snapshot()=>Volatile.Read(ref voices);
    public string[] Playing=>Snapshot().Where(v=>!v.Stopped&&(!v.Ended||Volatile.Read(ref v.Count)>0)).Select(v=>v.Id).ToArray();
    public string[] Paused=>Snapshot().Where(v=>!v.Stopped&&v.Paused).Select(v=>v.Id).ToArray();
    static void CheckVolume(float value){if(!float.IsFinite(value)||value<0||value>1)throw new ArgumentOutOfRangeException(nameof(value));}
    public void Volume(string id,float value){CheckVolume(value);var voice=Snapshot().FirstOrDefault(v=>v.Id==id);if(voice!=null)voice.Volume=value;}
    public void Pause(string id,bool paused){var voice=Snapshot().FirstOrDefault(v=>v.Id==id&&!v.Stopped)??throw new InvalidOperationException("This sound is not playing.");voice.Paused=paused;wake.Set();}
    public void PauseAll(){var current=Snapshot();bool value=current.Any(v=>!v.Paused);foreach(var voice in current)voice.Paused=value;wake.Set();}
    public void Play(string id,string path,float volume){CheckVolume(volume);var reader=new WaveFileReader(path);try{ISampleProvider provider=new MonoMixProvider(reader.ToSampleProvider());if(provider.WaveFormat.SampleRate!=SampleRate)provider=new WdlResamplingSampleProvider(provider,SampleRate);PlaySource(id,reader,provider,volume);}catch{reader.Dispose();throw;}}
    internal void PlaySource(string id,IDisposable owner,ISampleProvider provider,float volume){
        CheckVolume(volume);var voice=new Voice(id,owner,provider,volume,Math.Max(8192,SampleRate/4));
        lock(controls){if(disposed)throw new ObjectDisposedException(nameof(SoundboardMixer));var current=Snapshot().ToList();for(int i=current.Count-1;i>=0;i--)if(current[i].Id==id){Retire(current[i]);current.RemoveAt(i);}if(current.Count>=8){Retire(current[0]);current.RemoveAt(0);}current.Add(voice);Volatile.Write(ref voices,current.ToArray());}wake.Set();
    }
    void Retire(Voice voice){voice.Stopped=true;retired.Add(voice);}
    // A contended ring is skipped, rather than making live voice wait.
    public void Mix(float[] destination,int frames){
        if(frames<0||frames>destination.Length)throw new ArgumentOutOfRangeException(nameof(frames));Array.Clear(destination,0,frames);
        var active=Snapshot();foreach(var voice in active){
            if(voice.Stopped||voice.Paused)continue;
            if(!Monitor.TryEnter(voice.Gate)){Interlocked.Increment(ref underruns);continue;}
            try{int available=Math.Min(frames,voice.Count);float volume=voice.Volume;for(int i=0;i<available;i++)destination[i]+=voice.Samples[(voice.Head+i)%voice.Samples.Length]*volume;voice.Head=(voice.Head+available)%voice.Samples.Length;voice.Count-=available;if(available<frames&&!voice.Ended)Interlocked.Increment(ref underruns);}finally{Monitor.Exit(voice.Gate);}
        }
        if(active.Length>0)wake.Set();
    }
    void Fill(){var scratch=new float[4096];try{while(!disposed){bool worked=false;
        foreach(var voice in Snapshot()){
            if(voice.Stopped||voice.Ended)continue;int room;lock(voice.Gate)room=voice.Samples.Length-voice.Count;if(room<scratch.Length)continue;
            try{int read=voice.Provider.Read(scratch,0,scratch.Length);worked=true;lock(voice.Gate){for(int i=0;i<read;i++)voice.Samples[(voice.Head+voice.Count+i)%voice.Samples.Length]=scratch[i];voice.Count+=read;}if(read<scratch.Length)voice.Ended=true;}
            catch(Exception error){Error=error.Message;voice.Ended=true;}
        }
        List<Voice> release=[];lock(controls){var current=Snapshot();var finished=current.Where(v=>v.Ended&&Volatile.Read(ref v.Count)==0).ToArray();if(finished.Length>0){foreach(var voice in finished)Retire(voice);Volatile.Write(ref voices,current.Except(finished).ToArray());}release.AddRange(retired);retired.Clear();}foreach(var voice in release)voice.Owner.Dispose();
        if(!worked)wake.WaitOne();
    }}finally{lock(controls){foreach(var voice in Snapshot().Concat(retired).Distinct())voice.Owner.Dispose();voices=[];retired.Clear();}wake.Dispose();}}
    public void Stop(string? id=null){lock(controls){var current=Snapshot();foreach(var voice in current)if(id==null||voice.Id==id)Retire(voice);Volatile.Write(ref voices,current.Where(v=>!v.Stopped).ToArray());}wake.Set();}
    public void Dispose(){if(disposed)return;disposed=true;wake.Set();producer.Join(2000);}
}
