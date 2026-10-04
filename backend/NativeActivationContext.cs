using System.Runtime.InteropServices;
namespace MicOnly;
sealed class NativeActivationContext : IDisposable
{
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Activation
    {
        public uint size,flags;
        public string source;
        public ushort architecture,language;
        public string directory;
        public nint resource,application,module;
    }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern nint CreateActCtx(ref Activation context);
    [DllImport("kernel32.dll",SetLastError=true)]static extern bool ActivateActCtx(nint context,out nuint cookie);
    [DllImport("kernel32.dll")]static extern bool DeactivateActCtx(uint flags,nuint cookie);
    [DllImport("kernel32.dll")]static extern void ReleaseActCtx(nint context);
    readonly nint handle;readonly nuint cookie;
    public NativeActivationContext()
    {
        var context=new Activation{size=(uint)Marshal.SizeOf<Activation>(),flags=4,source=Path.Combine(NativeEngine.SonarPath,"sonar-mic.manifest"),directory=NativeEngine.SonarPath};
        handle=CreateActCtx(ref context);if(handle==-1)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        if(!ActivateActCtx(handle,out cookie))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    public void Dispose(){DeactivateActCtx(0,cookie);ReleaseActCtx(handle);}
}
