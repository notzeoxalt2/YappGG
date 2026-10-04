using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using var e = new MMDeviceEnumerator();
if(args[0]=="--record"){
 using var source=e.GetDevice(args[1]);using var recording=new WasapiLoopbackCapture(source);using var writer=new WaveFileWriter(args[2],recording.WaveFormat);recording.DataAvailable+=(_,eventArgs)=>writer.Write(eventArgs.Buffer,0,eventArgs.BytesRecorded);recording.StartRecording();Console.WriteLine("ready");Console.ReadLine();using var stopped=new ManualResetEventSlim();recording.RecordingStopped+=(_,_)=>stopped.Set();recording.StopRecording();stopped.Wait(2000);return;
}
using var device = e.GetDevice(args[0]);
using var output = new WasapiOut(device, AudioClientShareMode.Shared, false, 100);
output.Init(args.Contains("--tone")?new SignalGenerator(48000,2){Gain=.05,Frequency=args.Length>2?double.Parse(args[2]):1000,Type=SignalGeneratorType.Sin}.ToWaveProvider():new SilenceProvider(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2)));
output.Play();
Thread.Sleep(200);
device.AudioSessionManager.RefreshSessions();
for(int i=0;i<device.AudioSessionManager.Sessions.Count;i++)
using(var session=device.AudioSessionManager.Sessions[i])
    if(session.GetProcessID==Environment.ProcessId)session.SimpleAudioVolume.Mute=false;
Console.WriteLine("ready");
Console.ReadLine();
