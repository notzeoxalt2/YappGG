using System.Diagnostics;
using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
namespace MicOnly;

[ComImport,Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface AsyncAudioOperation{[PreserveSig]int GetActivateResult(out int result,[MarshalAs(UnmanagedType.IUnknown)]out object audio);}
[ComVisible(true),Guid("41D949AB-9862-444A-80F6-C261334DA5EB"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface AudioActivationCallback{[PreserveSig]int ActivateCompleted(AsyncAudioOperation operation);}
[ComVisible(true),Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface AgileAudioCallback{}
[ComImport,Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface ProcessAudioClient{
 [PreserveSig]int Initialize(int mode,uint flags,long duration,long periodicity,nint format,nint session);[PreserveSig]int GetBufferSize(out uint frames);[PreserveSig]int GetStreamLatency(out long latency);[PreserveSig]int GetCurrentPadding(out uint padding);[PreserveSig]int IsFormatSupported(int mode,nint format,out nint closest);[PreserveSig]int GetMixFormat(out nint format);[PreserveSig]int GetDevicePeriod(out long normal,out long minimum);[PreserveSig]int Start();[PreserveSig]int Stop();[PreserveSig]int Reset();[PreserveSig]int SetEventHandle(nint handle);[PreserveSig]int GetService(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object service);
}
[ComImport,Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface ProcessCaptureClient{[PreserveSig]int GetBuffer(out nint data,out uint frames,out uint flags,out ulong devicePosition,out ulong qpc);[PreserveSig]int ReleaseBuffer(uint frames);[PreserveSig]int GetNextPacketSize(out uint frames);}

// Uses Windows process loopback, including the selected application's children.
// No fallback to whole-system audio: unrelated applications stay out of the mic.
public sealed class ApplicationAudio:IDisposable{
 [StructLayout(LayoutKind.Explicit,Size=24)]struct Blob{[FieldOffset(0)]public ushort type;[FieldOffset(8)]public uint length;[FieldOffset(16)]public nint data;}
 [DllImport("Mmdevapi.dll",CharSet=CharSet.Unicode)]static extern int ActivateAudioInterfaceAsync(string path,ref Guid id,ref Blob parameters,AudioActivationCallback callback,out AsyncAudioOperation operation);
 [ComVisible(true),ClassInterface(ClassInterfaceType.None)]public sealed class Callback:AudioActivationCallback,AgileAudioCallback{public readonly ManualResetEventSlim Ready=new();public object? Audio;public int Result;public int ActivateCompleted(AsyncAudioOperation operation){try{Result=operation.GetActivateResult(out var result,out var audio);if(Result>=0){Result=result;Audio=audio;}}catch(Exception error){Result=error.HResult;}finally{Ready.Set();}return 0;}}
 readonly BufferedWaveProvider buffer=new(WaveFormat.CreateIeeeFloatWaveFormat(48000,1)){BufferDuration=TimeSpan.FromMilliseconds(250),DiscardOnBufferOverflow=true,ReadFully=true};
 readonly Thread worker;readonly ManualResetEventSlim ready=new();volatile bool closing;Exception? failure;ISampleProvider? provider;int targetRate;
 public int ProcessId{get;}public string? Error=>failure?.Message;
 public ApplicationAudio(int processId){if(Environment.OSVersion.Version.Build<20348)throw new InvalidOperationException("Application audio needs Windows 11 or Windows build 20348 or newer.");using var process=Process.GetProcessById(processId);if(process.ProcessName.StartsWith("Discord",StringComparison.OrdinalIgnoreCase)||process.ProcessName is "MicBackend" or "YappGG")throw new InvalidOperationException("Choose a music, video or game app instead of Discord or YappGG.");ProcessId=processId;worker=new Thread(Pump){IsBackground=true,Name="YappGG application audio"};worker.SetApartmentState(ApartmentState.MTA);worker.Start();if(!ready.Wait(12000)){closing=true;throw new TimeoutException("Windows did not activate application audio.");}if(failure!=null){closing=true;throw new InvalidOperationException("Cannot capture this application's audio: "+failure.Message,failure);}}
 static void Check(int result,string operation){if(result<0)throw new InvalidOperationException(operation+": "+Marshal.GetExceptionForHR(result)?.Message);}
 void Pump(){ProcessAudioClient? client=null;ProcessCaptureClient? capture=null;try{NativeEngine.CoInitializeEx(0,0);var parameters=Marshal.AllocHGlobal(12);var format=Marshal.AllocHGlobal(18);var callback=new Callback();try{Marshal.WriteInt32(parameters,0,1);Marshal.WriteInt32(parameters,4,ProcessId);Marshal.WriteInt32(parameters,8,0);var blob=new Blob{type=65,length=12,data=parameters};var iid=typeof(ProcessAudioClient).GUID;Check(ActivateAudioInterfaceAsync("VAD\\Process_Loopback",ref iid,ref blob,callback,out var operation),"Activate");if(!callback.Ready.Wait(10000))throw new TimeoutException("Audio activation timed out.");Check(callback.Result,"Activation result");client=(ProcessAudioClient)callback.Audio!;Marshal.FinalReleaseComObject(operation);
  // Shared PCM capture; conversion is handled by Windows, matching its loopback sample.
  Marshal.Copy(new byte[18],0,format,18);Marshal.WriteInt16(format,0,1);Marshal.WriteInt16(format,2,2);Marshal.WriteInt32(format,4,48000);Marshal.WriteInt32(format,8,192000);Marshal.WriteInt16(format,12,4);Marshal.WriteInt16(format,14,16);Check(client.Initialize(0,0x80060000,0,0,format,0),"Initialize");var captureId=typeof(ProcessCaptureClient).GUID;Check(client.GetService(ref captureId,out var service),"Capture service");capture=(ProcessCaptureClient)service;using var sampleReady=new AutoResetEvent(false);Check(client.SetEventHandle(sampleReady.SafeWaitHandle.DangerousGetHandle()),"Sample event");Check(client.Start(),"Start");ready.Set();var raw=new byte[192000];var output=new byte[192000];while(!closing){Marshal.ThrowExceptionForHR(capture.GetNextPacketSize(out var frames));if(frames==0){sampleReady.WaitOne(10);continue;}Marshal.ThrowExceptionForHR(capture.GetBuffer(out var data,out frames,out var flags,out _,out _));try{int bytes=checked((int)frames*4);if(raw.Length<bytes){raw=new byte[bytes];output=new byte[bytes];}if((flags&2)!=0)Array.Clear(output,0,bytes);else{Marshal.Copy(data,raw,0,bytes);for(int i=0;i<frames;i++){float sample=(BitConverter.ToInt16(raw,i*4)+BitConverter.ToInt16(raw,i*4+2))/65536f;BitConverter.TryWriteBytes(output.AsSpan(i*4,4),sample);}}buffer.AddSamples(output,0,bytes);}finally{Marshal.ThrowExceptionForHR(capture.ReleaseBuffer(frames));}}}
 finally{Marshal.FreeHGlobal(parameters);Marshal.FreeHGlobal(format);GC.KeepAlive(callback);}}
 catch(Exception error){Console.Error.WriteLine("Application audio: "+error);failure=error;ready.Set();}finally{client?.Stop();if(capture!=null)Marshal.FinalReleaseComObject(capture);if(client!=null)Marshal.FinalReleaseComObject(client);}}
 public void Mix(float[] samples,int frames,int sampleRate){if(provider==null||targetRate!=sampleRate){targetRate=sampleRate;provider=buffer.ToSampleProvider();if(sampleRate!=48000)provider=new WdlResamplingSampleProvider(provider,sampleRate);}var scratch=new float[frames];int count=provider.Read(scratch,0,frames);for(int i=0;i<count;i++)samples[i]+=scratch[i];}
 public void Dispose(){closing=true;worker.Join(2000);}
 public static object Apps(){
  var active=new HashSet<int>();using var devices=new MMDeviceEnumerator();
  foreach(var device in devices.EnumerateAudioEndPoints(DataFlow.Render,DeviceState.Active))using(device){
   if(AudioPolicy.IsGG(device)||AudioPolicy.IsTroll(device))continue;
   try{var manager=device.AudioSessionManager;manager.RefreshSessions();for(int i=0;i<manager.Sessions.Count;i++)using(var session=manager.Sessions[i]){try{if(session.GetProcessID>0)active.Add((int)session.GetProcessID);}catch{}}}catch(COMException){}
  }
  var rows=new List<(int pid,string name,string title,bool hasAudio)>();
  foreach(var process in Process.GetProcesses())using(process){try{
   var name=process.ProcessName;var title=process.MainWindowTitle.Trim();
   if(process.Id<=0||name.StartsWith("Discord",StringComparison.OrdinalIgnoreCase)||name is "YappGG" or "MicBackend" or "SteelSeriesSonar")continue;
   if(!active.Contains(process.Id)&&(process.MainWindowHandle==IntPtr.Zero||title.Length==0))continue;
   rows.Add((process.Id,name,title.Length>140?title[..140]+"…":title,active.Contains(process.Id)));
  }catch{}}
  return rows.OrderByDescending(r=>r.hasAudio).ThenBy(r=>r.title.Length>0?r.title:r.name,StringComparer.OrdinalIgnoreCase).Select(r=>new{r.pid,r.name,r.title,r.hasAudio}).ToArray();
 }
}
