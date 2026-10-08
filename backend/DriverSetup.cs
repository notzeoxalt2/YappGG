using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Security.Principal;
using Microsoft.Win32;
namespace MicOnly;
static class DriverSetup
{
 const string HardwareId=@"ROOT\VEN_SSGG&DEV_0001";
 public static bool Installed(){var set=SetupDiGetClassDevs(0,null,0,6);if(set==-1)return false;try{for(uint index=0;;index++){var info=new DeviceInfo{size=(uint)Marshal.SizeOf<DeviceInfo>()};if(!SetupDiEnumDeviceInfo(set,index,ref info))break;var buffer=new byte[8192];if(SetupDiGetDeviceRegistryProperty(set,ref info,1,out _,buffer,(uint)buffer.Length,out _)&&System.Text.Encoding.Unicode.GetString(buffer).Split('\0').Contains(HardwareId,StringComparer.OrdinalIgnoreCase))return true;}return false;}finally{SetupDiDestroyDeviceInfoList(set);}}
 [StructLayout(LayoutKind.Sequential)]struct DeviceInfo{public uint size;public Guid classGuid;public uint devInst;public nint reserved;}
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern nint SetupDiGetClassDevs(nint classGuid,string? enumerator,nint parent,uint flags);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiEnumDeviceInfo(nint set,uint index,ref DeviceInfo info);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiGetDeviceRegistryProperty(nint set,ref DeviceInfo info,uint property,out uint type,byte[] buffer,uint length,out uint required);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiGetINFClass(string path,out Guid guid,System.Text.StringBuilder name,uint nameSize,out uint required);
 [DllImport("setupapi.dll",SetLastError=true)]static extern nint SetupDiCreateDeviceInfoList(ref Guid guid,nint parent);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiCreateDeviceInfo(nint set,string name,ref Guid guid,string description,nint parent,uint flags,ref DeviceInfo info);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiSetDeviceRegistryProperty(nint set,ref DeviceInfo info,uint property,byte[] buffer,uint length);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiCallClassInstaller(uint installFunction,nint set,ref DeviceInfo info);
 [DllImport("setupapi.dll")]static extern bool SetupDiDestroyDeviceInfoList(nint set);
 [DllImport("newdev.dll",SetLastError=true)]static extern bool DiInstallDevice(nint parent,nint set,ref DeviceInfo info,nint driverInfo,uint flags,out bool reboot);
 static void Check(bool result,string step){if(!result){var code=Marshal.GetLastWin32Error();throw new System.ComponentModel.Win32Exception(code,$"{step} failed (0x{code:X8}). See Windows INF/setupapi.dev.log for device installation details.");}}
 static void Run(string executable,params string[] args){var start=new ProcessStartInfo(executable){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};foreach(var argument in args)start.ArgumentList.Add(argument);using var process=Process.Start(start)!;var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();process.WaitForExit();Console.Error.WriteLine(output.GetAwaiter().GetResult()+error.GetAwaiter().GetResult());if(process.ExitCode!=0&&process.ExitCode!=3010&&!(Path.GetFileName(executable).Equals("pnputil.exe",StringComparison.OrdinalIgnoreCase)&&process.ExitCode==259))throw new InvalidOperationException($"{Path.GetFileName(executable)} exited {process.ExitCode}.");}
 public static object Install()
 {
  if(RuntimeInformation.OSArchitecture!=Architecture.X64 || Environment.OSVersion.Version<new Version(10,0,17763))throw new PlatformNotSupportedException("YappGG requires Windows 10 1809 or newer on an x64 PC.");
  using var identity=WindowsIdentity.GetCurrent();if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw new InvalidOperationException("Installing the microphone driver requires administrator rights.");
  var driver=Path.Combine(AppContext.BaseDirectory,"driver");var vad=Path.Combine(driver,"vad","SteelSeries-Sonar-VAD.inf");var extension=Path.Combine(driver,"vad","SteelSeries-Sonar-VAD-Extension.inf");var apo=Path.Combine(driver,"apoDriverPackage","Sonar.Apo.inf");
  foreach(var path in new[]{vad,extension,apo})if(!File.Exists(path))throw new FileNotFoundException("Driver package is incomplete.",path);
  Run(Path.Combine(driver,"apoDriverPackage","Sonar.AgsSetup.exe"),"--company=SteelSeries ApS","--apo=Sonar.APO","ChatCapture");
  // Stage packages first. /install starts a second asynchronous installation and
  // can race the explicit root-device registration/binding below.
  foreach(var path in new[]{apo,extension,vad})Run(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","pnputil.exe"),"/add-driver",path);
  var set=SetupDiGetClassDevs(0,null,0,6);if(set==-1)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  try{
   DeviceInfo target=default;bool existing=false;
   for(uint index=0;;index++){
    var candidate=new DeviceInfo{size=(uint)Marshal.SizeOf<DeviceInfo>()};if(!SetupDiEnumDeviceInfo(set,index,ref candidate))break;
    var hardware=new byte[8192];if(SetupDiGetDeviceRegistryProperty(set,ref candidate,1,out _,hardware,(uint)hardware.Length,out _)&&System.Text.Encoding.Unicode.GetString(hardware).Split('\0').Contains(HardwareId,StringComparer.OrdinalIgnoreCase)){target=candidate;existing=true;break;}
   }
   if(!existing){
    // Create in a class-specific set, matching Microsoft's root-device recipe.
    SetupDiDestroyDeviceInfoList(set);set=-1;
    var name=new System.Text.StringBuilder(128);Check(SetupDiGetINFClass(vad,out var guid,name,128,out _),"Read microphone INF class");
    set=SetupDiCreateDeviceInfoList(ref guid,0);if(set==-1)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    target=new DeviceInfo{size=(uint)Marshal.SizeOf<DeviceInfo>()};
    Check(SetupDiCreateDeviceInfo(set,name.ToString(),ref guid,"YappGG Audio",0,1,ref target),"Create microphone device");
    var hardware=System.Text.Encoding.Unicode.GetBytes(HardwareId+"\0\0");Check(SetupDiSetDeviceRegistryProperty(set,ref target,1,hardware,(uint)hardware.Length),"Set microphone hardware ID");
    Check(SetupDiCallClassInstaller(0x19,set,ref target),"Register microphone device");
   }
   // Bind the exact registered devnode rather than scanning globally for a
   // freshly created device via UpdateDriverForPlugAndPlayDevices.
   Check(DiInstallDevice(0,set,ref target,0,0,out var reboot),"Bind signed microphone driver");
   var service=new byte[1024];Check(SetupDiGetDeviceRegistryProperty(set,ref target,4,out _,service,(uint)service.Length,out _),"Verify microphone driver service");
   if(string.IsNullOrWhiteSpace(System.Text.Encoding.Unicode.GetString(service).Trim('\0')))throw new InvalidOperationException("Windows did not bind a compatible microphone driver. Use Settings > Repair microphone after restarting Windows.");
   if(!Installed()&&!reboot)throw new InvalidOperationException("Windows has not made the microphone device available. Restart Windows, then use Repair microphone in YappGG Settings.");
   return new{installed=Installed(),alreadyInstalled=existing,reboot};
  }finally{if(set!=-1)SetupDiDestroyDeviceInfoList(set);}
 }
}
