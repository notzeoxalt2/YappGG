using MicOnly;using NAudio.Wave;using System.Diagnostics;
static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
using(var mixer=new SoundboardMixer()){
 var slow=new Slow();mixer.PlaySource("slow",slow,slow,1);Check(slow.Entered.Wait(2000),"Prefetch did not start");
 var output=new float[960];var watch=Stopwatch.StartNew();mixer.Mix(output,output.Length);Check(watch.ElapsedMilliseconds<100,"Microphone mix waited for disk/decoder");
 long before=GC.GetAllocatedBytesForCurrentThread();for(int i=0;i<1000;i++)mixer.Mix(output,output.Length);long allocated=GC.GetAllocatedBytesForCurrentThread()-before;Check(allocated<1024,"Repeated mix allocated "+allocated);
 watch.Restart();mixer.Stop("slow");Check(watch.ElapsedMilliseconds<100,"Stop waited for decoder");slow.Release.Set();
}
using(var mixer=new SoundboardMixer()){
 var sequence=new Sequence();mixer.PlaySource("voice",sequence,sequence,1);Thread.Sleep(50);var buffer=new float[4];mixer.Mix(buffer,4);Check(buffer.SequenceEqual(new float[]{0,1,2,3}),"Prefetch changed sample order");
 mixer.Pause("voice",true);mixer.Mix(buffer,4);Check(buffer.All(v=>v==0),"Paused clip emitted samples");mixer.Pause("voice",false);mixer.Volume("voice",.5f);mixer.Mix(buffer,4);Check(buffer.SequenceEqual(new float[]{2,2.5f,3,3.5f}),"Pause lost position or live volume failed");
 mixer.PlaySource("voice",new Sequence(),new Sequence(),1);Thread.Sleep(50);mixer.Mix(buffer,4);Check(buffer.SequenceEqual(new float[]{0,1,2,3}),"Restart did not start from beginning");
 mixer.Stop();Check(mixer.Playing.Length==0,"Stop all left voices");
}
Console.WriteLine("PASS: blocked decoder never blocks microphone mix/stop; mix allocation budget, ordered samples, pause position, volume and restart. No audio endpoints or playback.");
sealed class Slow:ISampleProvider,IDisposable{public WaveFormat WaveFormat=>WaveFormat.CreateIeeeFloatWaveFormat(48000,1);public readonly ManualResetEventSlim Entered=new(),Release=new();public int Read(float[] buffer,int offset,int count){Entered.Set();Release.Wait();Array.Clear(buffer,offset,count);return count;}public void Dispose(){Release.Set();}}
sealed class Sequence:ISampleProvider,IDisposable{int next;public WaveFormat WaveFormat=>WaveFormat.CreateIeeeFloatWaveFormat(48000,1);public int Read(float[] buffer,int offset,int count){for(int i=0;i<count;i++)buffer[offset+i]=next++;return count;}public void Dispose(){}}
