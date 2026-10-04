using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]public struct Uncompressed{public Guid Type;public uint Channels,Bytes,Bits;public float Rate;public uint Mask;}
[ComVisible(true),Guid("4E997F73-B71F-4798-873B-ED7DFCF15B4D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface Media{
 [PreserveSig]int Compressed([MarshalAs(UnmanagedType.Bool)]out bool compressed);
 [PreserveSig]int Equal(nint other,out uint flags);
 [PreserveSig]nint Format();
 [PreserveSig]int Uncompressed(out Uncompressed format);
}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]public sealed class FloatMedia:Media,IDisposable{
 readonly nint wave;readonly uint channels;
 public FloatMedia(uint channels){this.channels=channels;var b=new byte[18];BitConverter.GetBytes((ushort)3).CopyTo(b,0);BitConverter.GetBytes((ushort)channels).CopyTo(b,2);BitConverter.GetBytes(48000u).CopyTo(b,4);BitConverter.GetBytes(48000u*channels*4).CopyTo(b,8);BitConverter.GetBytes((ushort)(channels*4)).CopyTo(b,12);BitConverter.GetBytes((ushort)32).CopyTo(b,14);wave=Marshal.AllocHGlobal(b.Length);Marshal.Copy(b,0,wave,b.Length);}
 public int Compressed(out bool compressed){compressed=false;return 0;}
 public int Equal(nint other,out uint flags){flags=6;return 0;}
 public nint Format()=>wave;
 public int Uncompressed(out Uncompressed format){format=new(){Type=new Guid("00000003-0000-0010-8000-00aa00389b71"),Channels=channels,Bytes=4,Bits=32,Rate=48000,Mask=channels==1?4u:3u};return 0;}
 public void Dispose()=>Marshal.FreeHGlobal(wave);
}
[ComImport,Guid("0E5ED805-ABA6-49c3-8F9A-2B8C889C4FA8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Configure{
 [PreserveSig]int Lock(uint inputs,nint input,uint outputs,nint output);[PreserveSig]int Unlock();
}
[ComImport,Guid("9E1D6A6D-DDBC-4E95-A4C7-AD64BA37846C"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface ProcessApo{
 [PreserveSig]void Process(uint inputs,nint input,uint outputs,nint output);[PreserveSig]uint InputFrames(uint frames);[PreserveSig]uint OutputFrames(uint frames);
}
[StructLayout(LayoutKind.Sequential)]struct Descriptor{public int Type;public nint Buffer;public uint Frames;public nint Format;public uint Signature;}
[StructLayout(LayoutKind.Sequential)]struct Connection{public nint Buffer;public uint Frames,Flags,Signature;}
static class AudioTest{
 public static object Run(object instance,uint channels){
  using var media=new FloatMedia(channels);var type=Marshal.GetComInterfaceForObject(media,typeof(Media));
  var input=Marshal.AllocHGlobal((int)(4096*channels*4));var output=Marshal.AllocHGlobal((int)(4096*channels*4));
  var inDesc=Marshal.AllocHGlobal(Marshal.SizeOf<Descriptor>());var outDesc=Marshal.AllocHGlobal(Marshal.SizeOf<Descriptor>());
  var inArray=Marshal.AllocHGlobal(8);var outArray=Marshal.AllocHGlobal(8);
  Marshal.StructureToPtr(new Descriptor{Type=1,Buffer=input,Frames=4096,Format=type,Signature=0x41434453},inDesc,false);
  Marshal.StructureToPtr(new Descriptor{Type=1,Buffer=output,Frames=4096,Format=type,Signature=0x41434453},outDesc,false);
  Marshal.WriteIntPtr(inArray,inDesc);Marshal.WriteIntPtr(outArray,outDesc);var configure=(Configure)instance;var hr=configure.Lock(1,inArray,1,outArray);
  object result=new{channels,lockHr=$"0x{hr:X8}"};
  if(hr>=0){
   var inProp=Marshal.AllocHGlobal(Marshal.SizeOf<Connection>());var outProp=Marshal.AllocHGlobal(Marshal.SizeOf<Connection>());
   var values=new float[480*channels];for(int i=0;i<values.Length;i++)values[i]=.1f*MathF.Sin(2*MathF.PI*500*(i/channels)/48000);
   Marshal.Copy(values,0,input,values.Length);
   var rt=(ProcessApo)instance;
   for(int i=0;i<40;i++){
    Marshal.StructureToPtr(new Connection{Buffer=input,Frames=480,Flags=1,Signature=0x41435053},inProp,false);
    Marshal.Copy(values,0,input,values.Length);
    Marshal.StructureToPtr(new Connection{Buffer=input,Frames=0,Flags=0,Signature=0x41435053},outProp,false);
    Marshal.WriteIntPtr(inArray,inProp);Marshal.WriteIntPtr(outArray,outProp);rt.Process(1,inArray,1,outArray);
   }
   var returned=Marshal.PtrToStructure<Connection>(outProp);Marshal.Copy(returned.Buffer,values,0,values.Length);
   result=new{channels,lockHr=$"0x{hr:X8}",frames=returned.Frames,flags=returned.Flags,peak=values.Max(x=>Math.Abs(x)),rms=Math.Sqrt(values.Select(x=>x*x).Average())};configure.Unlock();Marshal.FreeHGlobal(inProp);Marshal.FreeHGlobal(outProp);
  }
  foreach(var p in new[]{input,output,inDesc,outDesc,inArray,outArray})Marshal.FreeHGlobal(p);Marshal.Release(type);return result;
 }
}
