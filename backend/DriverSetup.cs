using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Security.Principal;
using Microsoft.Win32;
namespace MicOnly;
static class DriverSetup
{
 const string HardwareId=@"ROOT\VEN_SSGG&DEV_0001";
 public static bool Installed(){using var root=Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\ROOT\MEDIA");if(root==null)return false;foreach(var name in root.GetSubKeyNames()){using var device=root.OpenSubKey(name);if(device?.GetValue("HardwareID") is string[] ids&&ids.Contains(HardwareId,StringComparer.OrdinalIgnoreCase))return true;}return false;}
 [StructLayout(LayoutKind.Sequential)]struct DeviceInfo{public uint size;public Guid classGuid;public uint devInst;public nint reserved;}
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiGetINFClass(string path,out Guid guid,System.Text.StringBuilder name,uint nameSize,out uint required);
 [DllImport("setupapi.dll",SetLastError=true)]static extern nint SetupDiCreateDeviceInfoList(ref Guid guid,nint parent);
 [DllImport("setupapi.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetupDiCreateDeviceInfo(nint set,string name,ref Guid guid,string description,nint parent,uint flags,ref DeviceInfo info);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiSetDeviceRegistryProperty(nint set,ref DeviceInfo info,uint property,byte[] buffer,uint length);
 [DllImport("setupapi.dll",SetLastError=true)]static extern bool SetupDiCallClassInstaller(uint installFunction,nint set,ref DeviceInfo info);
 [DllImport("setupapi.dll")]static extern bool SetupDiDestroyDeviceInfoList(nint set);
 [DllImport("newdev.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool UpdateDriverForPlugAndPlayDevices(nint parent,string hardwareId,string inf,uint flags,out bool reboot);
 static void Check(bool result){if(!result)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
 static void Run(string executable,params string[] args){var start=new ProcessStartInfo(executable){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};foreach(var argument in args)start.ArgumentList.Add(argument);using var process=Process.Start(start)!;var output=process.StandardOutput.ReadToEndAsync();var error=process.StandardError.ReadToEndAsync();process.WaitForExit();Console.Error.WriteLine(output.GetAwaiter().GetResult()+error.GetAwaiter().GetResult());if(process.ExitCode!=0&&process.ExitCode!=3010)throw new InvalidOperationException($"{Path.GetFileName(executable)} exited {process.ExitCode}.");}
 public static object Install()
 {
  if(Installed())return new{installed=true,alreadyInstalled=true,reboot=false};
  using var identity=WindowsIdentity.GetCurrent();if(!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator))throw new InvalidOperationException("Installing the signed Sonar microphone driver requires administrator rights.");
  var driver=Path.Combine(AppContext.BaseDirectory,"driver");var vad=Path.Combine(driver,"vad","SteelSeries-Sonar-VAD.inf");var extension=Path.Combine(driver,"vad","SteelSeries-Sonar-VAD-Extension.inf");var apo=Path.Combine(driver,"apoDriverPackage","Sonar.Apo.inf");
  foreach(var path in new[]{vad,extension,apo})if(!File.Exists(path))throw new FileNotFoundException("Driver package is incomplete.",path);
  Run(Path.Combine(driver,"apoDriverPackage","Sonar.AgsSetup.exe"),"--company=SteelSeries ApS","--apo=Sonar.APO","ChatCapture");
  foreach(var path in new[]{apo,extension,vad})Run(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","pnputil.exe"),"/add-driver",path,"/install");
  var className=new System.Text.StringBuilder(128);Check(SetupDiGetINFClass(vad,out var guid,className,128,out _));
  var set=SetupDiCreateDeviceInfoList(ref guid,0);if(set==-1)throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  bool reboot;
  try{var info=new DeviceInfo{size=(uint)Marshal.SizeOf<DeviceInfo>()};Check(SetupDiCreateDeviceInfo(set,className.ToString(),ref guid,"SteelSeries Sonar microphone driver",0,1,ref info));var hardware=System.Text.Encoding.Unicode.GetBytes(HardwareId+"\0\0");Check(SetupDiSetDeviceRegistryProperty(set,ref info,1,hardware,(uint)hardware.Length));Check(SetupDiCallClassInstaller(0x19,set,ref info));Check(UpdateDriverForPlugAndPlayDevices(0,HardwareId,vad,1,out reboot));}
  finally{SetupDiDestroyDeviceInfoList(set);}
  return new{installed=Installed(),alreadyInstalled=false,reboot};
 }
}
