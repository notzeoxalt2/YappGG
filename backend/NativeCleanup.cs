using System.Runtime.InteropServices;
namespace MicOnly;

[ComImport,Guid("FD7F2B29-24D0-4b5c-B177-592C39F9CA10"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface StandardApo {
 [PreserveSig]int Reset();[PreserveSig]int GetLatency(out long time);[PreserveSig]int GetRegistrationProperties(out nint props);
 [PreserveSig]int Initialize(uint size,nint data);[PreserveSig]int IsInputFormatSupported(nint opposite,nint requested,out nint supported);
 [PreserveSig]int IsOutputFormatSupported(nint opposite,nint requested,out nint supported);[PreserveSig]int GetInputChannelCount(out uint channels);
}
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupDevices {void Enumerate(int flow,uint state,[MarshalAs(UnmanagedType.Interface)]out object collection);void Default(int flow,int role,out CleanupDevice device);void Get([MarshalAs(UnmanagedType.LPWStr)]string id,out CleanupDevice device);}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupDevice {void Activate(ref Guid id,uint context,nint parameters,[MarshalAs(UnmanagedType.Interface)]out object result);void OpenProperties(uint access,[MarshalAs(UnmanagedType.Interface)]out object properties);void Id([MarshalAs(UnmanagedType.LPWStr)]out string id);void State(out uint state);}
[ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupProperties {}
[ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupCollection {}
[ComImport,Guid("0E5ED805-ABA6-49c3-8F9A-2B8C889C4FA8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupConfigure {
 [PreserveSig]int Lock(uint inputs,nint input,uint outputs,nint output);[PreserveSig]int Unlock();
}
[ComImport,Guid("9E1D6A6D-DDBC-4E95-A4C7-AD64BA37846C"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface CleanupRealtime {
 [PreserveSig]void Process(uint inputs,nint input,uint outputs,nint output);[PreserveSig]uint InputFrames(uint frames);[PreserveSig]uint OutputFrames(uint frames);
}
[StructLayout(LayoutKind.Sequential)]public struct CleanupFormat {public Guid Type;public uint Channels,Bytes,Bits;public float Rate;public uint Mask;}
[ComVisible(true),Guid("4E997F73-B71F-4798-873B-ED7DFCF15B4D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface CleanupMedia {
 [PreserveSig]int Compressed([MarshalAs(UnmanagedType.Bool)]out bool compressed);[PreserveSig]int Equal(nint other,out uint flags);
 [PreserveSig]nint Format();[PreserveSig]int Uncompressed(out CleanupFormat format);
}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]public sealed class CleanupFloatMedia : CleanupMedia,IDisposable {
 readonly nint wave;readonly int rate;
 public CleanupFloatMedia(int rate){this.rate=rate;var b=new byte[18];BitConverter.GetBytes((ushort)3).CopyTo(b,0);BitConverter.GetBytes((ushort)2).CopyTo(b,2);BitConverter.GetBytes(rate).CopyTo(b,4);BitConverter.GetBytes(rate*8).CopyTo(b,8);BitConverter.GetBytes((ushort)8).CopyTo(b,12);BitConverter.GetBytes((ushort)32).CopyTo(b,14);wave=Marshal.AllocHGlobal(b.Length);Marshal.Copy(b,0,wave,b.Length);}
 public int Compressed(out bool compressed){compressed=false;return 0;}public int Equal(nint other,out uint flags){flags=6;return 0;}
 public nint Format()=>wave;public int Uncompressed(out CleanupFormat format){format=new(){Type=new Guid("00000003-0000-0010-8000-00aa00389b71"),Channels=2,Bytes=4,Bits=32,Rate=rate,Mask=3};return 0;}
 public void Dispose()=>Marshal.FreeHGlobal(wave);
}
// Invoke the native microphone APO on stereo buffers, then pass its output to
// YappGG's own after-effect. Nothing is rendered between these two stages.
sealed class NativeCleanup : IDisposable {
 [StructLayout(LayoutKind.Sequential)]struct Init{public uint Size;public Guid ClassId;}
 [StructLayout(LayoutKind.Sequential)]struct Descriptor{public int Type;public nint Buffer;public uint Frames;public nint Format;public uint Signature;}
 [StructLayout(LayoutKind.Sequential)]struct Connection{public nint Buffer;public uint Frames,Flags,Signature;}
 readonly StandardApo apo;readonly CleanupConfigure configure;readonly CleanupRealtime realtime;
 readonly CleanupFloatMedia media;readonly nint type,input,output,inDescriptor,outDescriptor,inConnection,outConnection,inArray,outArray;
 bool locked,disposed;public double LatencyMs {get;}
 public NativeCleanup(string captureId,int sampleRate){
  media=new(sampleRate);apo=NativeEngine.Create<StandardApo>(Path.Combine(AppContext.BaseDirectory,"driver","apoDriverPackage","Sonar.APO.dll"),"4B7758C2-9361-4F88-83E9-44D8F05184EF");
  var devices=(CleanupDevices)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"))!)!;
  devices.Get(captureId,out var device);device.OpenProperties(0,out var properties);devices.Enumerate(1,1,out var collection);
  var props=Marshal.GetComInterfaceForObject(properties,typeof(CleanupProperties));var items=Marshal.GetComInterfaceForObject(collection,typeof(CleanupCollection));var initialization=Marshal.AllocHGlobal(88);
  try{Marshal.Copy(new byte[88],0,initialization,88);Marshal.StructureToPtr(new Init{Size=88,ClassId=new Guid("4B7758C2-9361-4F88-83E9-44D8F05184EF")},initialization,false);
   Marshal.WriteIntPtr(initialization,24,props);Marshal.WriteIntPtr(initialization,32,props);Marshal.WriteIntPtr(initialization,48,items);Marshal.StructureToPtr(new Guid("C18E2F7E-933D-4965-B7D1-1EEF228D2AF3"),initialization+64,false);
   Marshal.ThrowExceptionForHR(apo.Initialize(88,initialization));
  }finally{Marshal.FreeHGlobal(initialization);Marshal.Release(props);Marshal.Release(items);Marshal.FinalReleaseComObject(collection);Marshal.FinalReleaseComObject(properties);Marshal.FinalReleaseComObject(device);Marshal.FinalReleaseComObject(devices);}
  configure=(CleanupConfigure)apo;realtime=(CleanupRealtime)apo;type=Marshal.GetComInterfaceForObject(media,typeof(CleanupMedia));
  input=Marshal.AllocHGlobal(4096*8);output=Marshal.AllocHGlobal(4096*8);inDescriptor=Marshal.AllocHGlobal(Marshal.SizeOf<Descriptor>());outDescriptor=Marshal.AllocHGlobal(Marshal.SizeOf<Descriptor>());
  inConnection=Marshal.AllocHGlobal(Marshal.SizeOf<Connection>());outConnection=Marshal.AllocHGlobal(Marshal.SizeOf<Connection>());inArray=Marshal.AllocHGlobal(8);outArray=Marshal.AllocHGlobal(8);
  Marshal.StructureToPtr(new Descriptor{Type=1,Buffer=input,Frames=4096,Format=type,Signature=0x41434453},inDescriptor,false);Marshal.StructureToPtr(new Descriptor{Type=1,Buffer=output,Frames=4096,Format=type,Signature=0x41434453},outDescriptor,false);
  Marshal.WriteIntPtr(inArray,inDescriptor);Marshal.WriteIntPtr(outArray,outDescriptor);Marshal.ThrowExceptionForHR(configure.Lock(1,inArray,1,outArray));locked=true;
  apo.GetLatency(out var latency);LatencyMs=latency/10000.0;
 }
 public void Process(float[] samples,int frames){
  if(disposed||frames<0||frames>4096||samples.Length<frames*2)throw new ArgumentOutOfRangeException(nameof(frames));
  Marshal.Copy(samples,0,input,frames*2);Marshal.StructureToPtr(new Connection{Buffer=input,Frames=(uint)frames,Flags=1,Signature=0x41435053},inConnection,false);
  Marshal.StructureToPtr(new Connection{Buffer=output,Flags=0,Signature=0x41435053},outConnection,false);Marshal.WriteIntPtr(inArray,inConnection);Marshal.WriteIntPtr(outArray,outConnection);
  realtime.Process(1,inArray,1,outArray);var returned=Marshal.PtrToStructure<Connection>(outConnection);
  if(returned.Flags==2)Array.Clear(samples,0,frames*2);else if(returned.Flags==1&&returned.Frames==frames)Marshal.Copy(returned.Buffer,samples,0,frames*2);else throw new InvalidOperationException("Native cleanup returned an invalid audio buffer.");
 }
 public void Dispose(){if(disposed)return;disposed=true;if(locked)configure.Unlock();foreach(var p in new[]{input,output,inDescriptor,outDescriptor,inConnection,outConnection,inArray,outArray})if(p!=0)Marshal.FreeHGlobal(p);if(type!=0)Marshal.Release(type);media.Dispose();Marshal.FinalReleaseComObject(apo);}
}
