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
        while((read=source.Read(samples,0,samples.Length))>0){total+=read;if(total>48000L*1800)throw new InvalidDataException("Sounds can be up to 30 minutes long.");writer.WriteSamples(samples,0,read);}
        if(total==0)throw new InvalidDataException("This file has no playable audio track.");
        return new{durationSeconds=total/48000.0,sampleRate=48000};
    }
}
sealed class SoundboardMixer:IDisposable
{
    sealed record Voice(string Id,WaveFileReader Reader,ISampleProvider Provider,float Volume);
    readonly object gate=new();readonly List<Voice> voices=[];readonly float[] scratch=new float[4096];
    public int SampleRate { get; set; }=48000;
    public string[] Playing { get {lock(gate)return voices.Select(v=>v.Id).ToArray();} }
    public void Play(string id,string path,float volume){
        if(!float.IsFinite(volume)||volume<0||volume>1)throw new ArgumentOutOfRangeException(nameof(volume));
        var reader=new WaveFileReader(path);try{ISampleProvider provider=new MonoMixProvider(reader.ToSampleProvider());if(provider.WaveFormat.SampleRate!=SampleRate)provider=new WdlResamplingSampleProvider(provider,SampleRate);
            lock(gate){for(int i=voices.Count-1;i>=0;i--)if(voices[i].Id==id){voices[i].Reader.Dispose();voices.RemoveAt(i);}if(voices.Count>=8){voices[0].Reader.Dispose();voices.RemoveAt(0);}voices.Add(new(id,reader,provider,volume));}
        }catch{reader.Dispose();throw;}
    }
    public void Mix(float[] destination,int frames){
        lock(gate){Array.Clear(destination,0,frames);for(int i=voices.Count-1;i>=0;i--){var voice=voices[i];int read=voice.Provider.Read(scratch,0,frames);for(int frame=0;frame<read;frame++)destination[frame]+=scratch[frame]*voice.Volume;if(read<frames){voice.Reader.Dispose();voices.RemoveAt(i);}}}
    }
    public void Stop(string? id=null){lock(gate){for(int i=voices.Count-1;i>=0;i--)if(id==null||voices[i].Id==id){voices[i].Reader.Dispose();voices.RemoveAt(i);}}}
    public void Dispose()=>Stop();
}
