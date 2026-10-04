using System.Runtime.InteropServices;

namespace MicOnly;

// Recovered Sonar PolicyConfig interface/vtable. Only visibility is invoked.
[ComImport,Guid("F8679F50-850A-41CF-9C72-430F290290C8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig
{
    void Unused1();void Unused2();void Unused3();void Unused4();void Unused5();void Unused6();void Unused7();void Unused8();
    void Unused9();void Unused10();void Unused11();
    void SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)]string deviceId,[MarshalAs(UnmanagedType.I2)]short visible);
}
static class DeviceBranding
{
 public static object Rename(){
  using var devices=new NAudio.CoreAudioApi.MMDeviceEnumerator();
  var changed=new List<object>();
  foreach(var device in devices.EnumerateAudioEndPoints(NAudio.CoreAudioApi.DataFlow.All,NAudio.CoreAudioApi.DeviceState.Active|NAudio.CoreAudioApi.DeviceState.Disabled).Where(d=>d.DataFlow==NAudio.CoreAudioApi.DataFlow.Capture&&IndependentEngine.IsCable(d))){
   using(device){var label="YappGG Microphone";
    try{device.GetPropertyInformation(NAudio.CoreAudioApi.Interfaces.StorageAccessMode.ReadWrite);
     var value=new NAudio.CoreAudioApi.Interfaces.PropVariant{vt=31,pointerValue=Marshal.StringToCoTaskMemUni(label)};
     try{device.Properties.SetValue(new NAudio.CoreAudioApi.PropertyKey(new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),14),value);device.Properties.Commit();}finally{Marshal.FreeCoTaskMem(value.pointerValue);}
     changed.Add(new{id=device.ID,name=label,renamed=true});
    }catch(Exception error){changed.Add(new{id=device.ID,name=label,renamed=false,error=error.Message});}
   }
  }return changed;
 }
}
sealed class EndpointVisibility : IDisposable
{
    readonly IPolicyConfig policy=(IPolicyConfig)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9"))!)!;
    readonly HashSet<string> changed=new();
    readonly bool keepEnabled;
    public EndpointVisibility(bool keepEnabled=false){this.keepEnabled=keepEnabled;}
    public void Enable(string id,bool alreadyVisible){if(!alreadyVisible){policy.SetEndpointVisibility(id,1);changed.Add(id);}}
    public void Dispose(){if(!keepEnabled)foreach(var id in changed)try{policy.SetEndpointVisibility(id,0);}catch{}Marshal.FinalReleaseComObject(policy);}
}
