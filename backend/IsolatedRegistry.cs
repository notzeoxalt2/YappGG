using Microsoft.Win32;
using System.Runtime.InteropServices;

namespace MicOnly;

// The native dependency uses HKLM. Redirect only this process to a private copy.
// Never redirect the system audio service or edit the original Sonar keys.
sealed class IsolatedRegistry : IDisposable
{
    readonly RegistryKey isolated;
    [DllImport("advapi32.dll")] static extern int RegOverridePredefKey(nint key,nint replacement);
    static readonly nint HKLM=unchecked((nint)(int)0x80000002);
    public IsolatedRegistry()
    {
        isolated=Registry.CurrentUser.CreateSubKey(@"Software\SonarMicStandalone\NativeRegistry");
        const string source=@"SOFTWARE\SteelSeries ApS\Sonar.APO";
        using(var original=Registry.LocalMachine.OpenSubKey(source)??throw new InvalidOperationException("Original native Sonar registry unavailable."))
        using(var destination=isolated.CreateSubKey(source))
            Copy(original,destination);
        // COM marshaling also reads the machine registration through HKLM.
        // Mirror registration metadata only; the binaries stay in their original locations.
        foreach(var branch in new[]{@"SOFTWARE\Classes\Interface",@"SOFTWARE\Classes\TypeLib"})
        {
            using var original=Registry.LocalMachine.OpenSubKey(branch);
            using var destination=isolated.CreateSubKey(branch);
            if(original!=null)Copy(original,destination);
        }
        foreach(var id in new[]{"{00000320-0000-0000-C000-000000000046}","{00020420-0000-0000-C000-000000000046}","{00020424-0000-0000-C000-000000000046}"})
        {
            var branch=@"SOFTWARE\Classes\CLSID\"+id;
            using var original=Registry.LocalMachine.OpenSubKey(branch);using var destination=isolated.CreateSubKey(branch);
            if(original!=null)Copy(original,destination);
        }
        var error=RegOverridePredefKey(HKLM,isolated.Handle.DangerousGetHandle());
        if(error!=0)throw new System.ComponentModel.Win32Exception(error);
    }
    static void Copy(RegistryKey source,RegistryKey destination)
    {
        foreach(var name in source.GetValueNames())destination.SetValue(name,source.GetValue(name,null,RegistryValueOptions.DoNotExpandEnvironmentNames)!,source.GetValueKind(name));
        foreach(var name in source.GetSubKeyNames())
        {
            if(name=="NotificationClients")continue;
            using var child=source.OpenSubKey(name);using var target=destination.CreateSubKey(name);if(child!=null)Copy(child,target);
        }
    }
    public void Dispose(){RegOverridePredefKey(HKLM,0);isolated.Dispose();}
}
