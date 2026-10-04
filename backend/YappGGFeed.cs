using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace MicOnly;

// Private producer port; it is not a Windows playback audio device.
sealed class YappGGFeed : IDisposable
{
    readonly SafeFileHandle handle;
    const uint WritePcm=0x22a004,ResetPcm=0x22a008;
    readonly byte[] pcm=new byte[1920];
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle CreateFile(string path,uint access,uint share,nint security,uint disposition,uint flags,nint template);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool DeviceIoControl(SafeFileHandle device,uint command,byte[] input,int length,nint output,int outputLength,out int returned,nint overlapped);
    public YappGGFeed(){handle=CreateFile(@"\\.\YappGGMicFeed",0x40000000,0,0,3,0,0);if(handle.IsInvalid){handle.Dispose();throw new InvalidOperationException("The dedicated YappGG Microphone driver is not installed. This development build requires a signed driver package.");}if(!DeviceIoControl(handle,ResetPcm,pcm,0,0,0,out _,0))throw new Win32Exception(Marshal.GetLastWin32Error());}
    public void Write(float[] samples,int count){if(count<0||count>960)throw new ArgumentOutOfRangeException(nameof(count));for(int i=0;i<count;i++){float sample=float.IsFinite(samples[i])?Math.Clamp(samples[i],-1,1):0;short value=(short)Math.Clamp((int)Math.Round(sample*32767),-32768,32767);pcm[i*2]=(byte)value;pcm[i*2+1]=(byte)(value>>8);}if(!DeviceIoControl(handle,WritePcm,pcm,count*2,0,0,out _,0))throw new Win32Exception(Marshal.GetLastWin32Error());}
    public void Dispose(){if(!handle.IsInvalid&&!handle.IsClosed)DeviceIoControl(handle,ResetPcm,pcm,0,0,0,out _,0);handle.Dispose();}
}
