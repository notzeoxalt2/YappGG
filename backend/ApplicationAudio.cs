using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using NAudio.Wasapi.CoreAudioApi.Interfaces;
using NAudio.Wave;
using System.Diagnostics;
using System.Runtime.InteropServices;
namespace MicOnly;

// Windows process-loopback includes the selected process's children (browser renderers).
// The live ring has a fixed capacity; microphone callbacks never wait for capture.
sealed class LiveAudioRing(int sampleRate):ISampleProvider
{
 readonly float[] samples=new float[sampleRate/5];readonly object gate=new();int head,count;
 public WaveFormat WaveFormat {get;}=WaveFormat.CreateIeeeFloatWaveFormat(sampleRate,1);
 public void Write(float[] input,int frames){lock(gate){for(int i=0;i<frames;i++){if(count==samples.Length){head=(head+1)%samples.Length;count--;}samples[(head+count)%samples.Length]=input[i];count++;}}}
 public int Read(float[] buffer,int offset,int length){Array.Clear(buffer,offset,length);if(!Monitor.TryEnter(gate))return length;try{int read=Math.Min(length,count);for(int i=0;i<read;i++)buffer[offset+i]=samples[(head+i)%samples.Length];head=(head+read)%samples.Length;count-=read;}finally{Monitor.Exit(gate);}return length;}
}
[ComVisible(true),Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B96"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IYappAgileObject {}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]
public sealed class ProcessAudioActivation:IActivateAudioInterfaceCompletionHandler,IYappAgileObject
{
 public readonly TaskCompletionSource<AudioClient> Completion=new(TaskCreationOptions.RunContinuationsAsynchronously);
 public void ActivateCompleted(IActivateAudioInterfaceAsyncOperation operation){try{operation.GetActivateResult(out int hr,out object value);Marshal.ThrowExceptionForHR(hr);var client=new AudioClient((IAudioClient)value);if(!Completion.TrySetResult(client))client.Dispose();}catch(Exception error){Completion.TrySetException(error);}}
}
sealed class ApplicationAudio:IDisposable
{
 [DllImport("Mmdevapi.dll",ExactSpelling=true,CharSet=CharSet.Unicode)]static extern int ActivateAudioInterfaceAsync(string path,[MarshalAs(UnmanagedType.LPStruct)]Guid iid,IntPtr activation,IActivateAudioInterfaceCompletionHandler completion,out IActivateAudioInterfaceAsyncOperation operation);
 [StructLayout(LayoutKind.Explicit,Size=24)]struct BlobVariant{[FieldOffset(0)]public ushort Type;[FieldOffset(8)]public uint Size;[FieldOffset(16)]public IntPtr Data;}
 [StructLayout(LayoutKind.Sequential)]struct Activation{public int Type;public uint ProcessId;public int Mode;}
 readonly Thread worker;readonly ManualResetEvent stop=new(false);readonly TaskCompletionSource ready=new(TaskCreationOptions.RunContinuationsAsynchronously);
 public readonly LiveAudioRing Ring;public readonly int ProcessId;public string? Error{get;private set;}public bool Running{get;private set;}
 public static bool Supported=>OperatingSystem.IsWindowsVersionAtLeast(10,0,20348);
 public static object Choices(){var rows=new List<object>();foreach(var process in Process.GetProcesses())using(process){try{if(process.Id==Environment.ProcessId||process.ProcessName.StartsWith("YappGG",StringComparison.OrdinalIgnoreCase)||process.ProcessName.Equals("MicBackend",StringComparison.OrdinalIgnoreCase))continue;if(process.MainWindowHandle!=IntPtr.Zero)rows.Add(new{pid=process.Id,name=process.ProcessName,title=process.MainWindowTitle});}catch{}}return new{supported=Supported,apps=rows};}
 public ApplicationAudio(int pid,int sampleRate){if(!Supported)throw new NotSupportedException("Selected-application audio needs Windows 11 or Windows build 20348 or newer.");using var process=Process.GetProcessById(pid);if(pid<=0||pid==Environment.ProcessId)throw new ArgumentException("Choose another application.");ProcessId=pid;Ring=new(sampleRate);worker=new Thread(()=>Capture(sampleRate)){IsBackground=true,Name="YappGG selected application audio",Priority=ThreadPriority.AboveNormal};worker.SetApartmentState(ApartmentState.MTA);worker.Start();try{ready.Task.WaitAsync(TimeSpan.FromSeconds(12)).GetAwaiter().GetResult();}catch{Dispose();throw;}}
 void Capture(int sampleRate){AudioClient? client=null;object? operation=null;try{
  var activation=new Activation{Type=1,ProcessId=(uint)ProcessId,Mode=0};var data=Marshal.AllocHGlobal(Marshal.SizeOf<Activation>());var variant=Marshal.AllocHGlobal(Marshal.SizeOf<BlobVariant>());var handler=new ProcessAudioActivation();
  try{Marshal.StructureToPtr(activation,data,false);Marshal.StructureToPtr(new BlobVariant{Type=65,Size=(uint)Marshal.SizeOf<Activation>(),Data=data},variant,false);Marshal.ThrowExceptionForHR(ActivateAudioInterfaceAsync("VAD\\Process_Loopback",new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),variant,handler,out var pending));operation=pending;client=handler.Completion.Task.WaitAsync(TimeSpan.FromSeconds(10)).GetAwaiter().GetResult();}finally{Marshal.FreeHGlobal(variant);Marshal.FreeHGlobal(data);}
  if(stop.WaitOne(0))return;
  var format=new WaveFormat(sampleRate,16,2);client.Initialize(AudioClientShareMode.Shared,AudioClientStreamFlags.Loopback|AudioClientStreamFlags.EventCallback|(AudioClientStreamFlags)0x80000000,0,0,format,Guid.Empty);
  using var available=new AutoResetEvent(false);client.SetEventHandle(available.SafeWaitHandle.DangerousGetHandle());var capture=client.AudioCaptureClient;var bytes=new byte[Math.Max(8192,client.BufferSize*4)];var mono=new float[bytes.Length/4];client.Start();Running=true;ready.TrySetResult();
  while(true){int signalled=WaitHandle.WaitAny([stop,available],100);if(signalled==0)break;if(signalled!=1)continue;while(capture.GetNextPacketSize()>0){var pointer=capture.GetBuffer(out int frames,out var flags);try{int length=frames*4;if(length>bytes.Length)throw new InvalidOperationException("Application audio packet exceeds its capture buffer.");if((flags&AudioClientBufferFlags.Silent)!=0)Array.Clear(mono,0,frames);else{Marshal.Copy(pointer,bytes,0,length);for(int i=0;i<frames;i++)mono[i]=(BitConverter.ToInt16(bytes,i*4)+BitConverter.ToInt16(bytes,i*4+2))/65536f;}Ring.Write(mono,frames);}finally{capture.ReleaseBuffer(frames);}}}
 }catch(Exception error){Error=error.Message;ready.TrySetException(error);}finally{Running=false;try{client?.Stop();}catch{}client?.Dispose();if(operation!=null&&Marshal.IsComObject(operation))Marshal.ReleaseComObject(operation);ready.TrySetException(new InvalidOperationException("Application audio capture stopped."));}}
 public void Dispose(){stop.Set();if(worker!=Thread.CurrentThread&&worker.Join(1500))stop.Dispose();}
}
