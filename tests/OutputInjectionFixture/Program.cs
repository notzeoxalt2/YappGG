using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using var e = new MMDeviceEnumerator();
using var device = e.GetDevice(args[0]);
using var output = new WasapiOut(device, AudioClientShareMode.Shared, false, 100);
output.Init(args.Contains("--tone")?new SignalGenerator(48000,2){Gain=.05,Frequency=1000,Type=SignalGeneratorType.Sin}.ToWaveProvider():new SilenceProvider(WaveFormat.CreateIeeeFloatWaveFormat(48000, 2)));
output.Play();
Thread.Sleep(200);
device.AudioSessionManager.RefreshSessions();
for(int i=0;i<device.AudioSessionManager.Sessions.Count;i++)
using(var session=device.AudioSessionManager.Sessions[i])
    if(session.GetProcessID==Environment.ProcessId)session.SimpleAudioVolume.Mute=false;
Console.WriteLine("ready");
Console.ReadLine();
