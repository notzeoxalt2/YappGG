using System.Runtime.InteropServices;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
namespace MicOnly;

[ComImport,Guid("F8679F50-850A-41CF-9C72-430F290290C8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioPolicy
{
    void Slot0();void Slot1();void Slot2();void Slot3();void Slot4();void Slot5();void Slot6();void Slot7();void Slot8();
    void SetPropertyValue([MarshalAs(UnmanagedType.LPWStr)]string id,[MarshalAs(UnmanagedType.Bool)]bool fxStore,ref PropertyKey key,ref PropVariant value);
    void SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)]string id,Role role);
    void SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)]string id,[MarshalAs(UnmanagedType.I2)]short visible);
}
static class AudioPolicy
{
    public static object DiscordSetup(){SafeRoute();using var e=new MMDeviceEnumerator();using var mic=e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).FirstOrDefault(IsGG)??throw new InvalidOperationException("Install or repair the YappGG microphone driver first.");var policy=(IAudioPolicy)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9"))!)!;try{foreach(Role role in Enum.GetValues<Role>())policy.SetDefaultEndpoint(mic.ID,role);using var current=e.GetDefaultAudioEndpoint(DataFlow.Capture,Role.Communications);if(current.ID!=mic.ID)throw new InvalidOperationException("Windows did not apply the microphone default.");return new{configured=true,input=current.FriendlyName,discord="Select Default or YappGG Microphone in Discord. A manually selected input is not overwritten."};}finally{Marshal.FinalReleaseComObject(policy);}}
    public static bool IsGG(MMDevice d){try{return d.FriendlyName.StartsWith("YappGG Microphone")||d.FriendlyName.StartsWith("YappEQ Mic")||(d.FriendlyName.Contains("SteelSeries Sonar")&&d.FriendlyName.Contains("Microphone"))||(d.DeviceFriendlyName.Contains("SteelSeries Sonar")&&d.DeviceFriendlyName.Contains("Microphone"));}catch(COMException){return false;}}
    public static object SafeRoute(){using var e=new MMDeviceEnumerator();var policy=(IAudioPolicy)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9"))!)!;try{
        var changed=new List<object>();
        using var output=e.EnumerateAudioEndPoints(DataFlow.Render,DeviceState.Active).FirstOrDefault(d=>{try{return !d.FriendlyName.Contains("SteelSeries Sonar",StringComparison.OrdinalIgnoreCase)&&!IsGG(d)&&!IndependentEngine.IsCable(d);}catch(COMException){return false;}});
        if(output!=null)foreach(Role role in Enum.GetValues<Role>()){using var current=e.GetDefaultAudioEndpoint(DataFlow.Render,role);bool invalid;try{invalid=IsGG(current)||IndependentEngine.IsCable(current);}catch(COMException){invalid=true;}if(invalid){policy.SetDefaultEndpoint(output.ID,role);changed.Add(new{role=role.ToString(),output=output.FriendlyName});}}
        foreach(var mic in e.EnumerateAudioEndPoints(DataFlow.All,DeviceState.Active).Where(IsGG))using(mic){
            var label=mic.DataFlow==DataFlow.Capture?"YappGG Microphone":"YappGG Microphone Feed";
            foreach(var pair in new[]{(new PropertyKey(new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),2),label),(new PropertyKey(new Guid("b3f8fa53-0004-438e-9003-51a46e139bfc"),6),label)}){
                var key=pair.Item1;var value=new PropVariant{vt=31,pointerValue=Marshal.StringToCoTaskMemUni(pair.Item2)};
                try{policy.SetPropertyValue(mic.ID,false,ref key,ref value);}finally{Marshal.FreeCoTaskMem(value.pointerValue);}
            }
            changed.Add(new{microphoneId=mic.ID,name=label});
        }
        if(System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length==0)
            foreach(var extra in e.EnumerateAudioEndPoints(DataFlow.All,DeviceState.Active))using(extra){try{if(extra.FriendlyName.StartsWith("SteelSeries Sonar - ")&&!IsGG(extra)){policy.SetEndpointVisibility(extra.ID,0);changed.Add(new{hiddenExtraEndpoint=extra.ID});}}catch(COMException){}}
        return changed;
    }finally{Marshal.FinalReleaseComObject(policy);}}
}
