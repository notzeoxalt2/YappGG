using System.Runtime.InteropServices;
using System.Text.Json;
using SonarAPOSettingsControl;
[ComImport,Guid("00000001-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Factory{
 void CreateInstance([MarshalAs(UnmanagedType.IUnknown)]object? outer,ref Guid iid,[MarshalAs(UnmanagedType.IUnknown)]out object instance);void LockServer(bool locked);
}
[ComImport,Guid("FD7F2B29-24D0-4b5c-B177-592C39F9CA10"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Apo{
 [PreserveSig]int Reset();[PreserveSig]int GetLatency(out long time);[PreserveSig]int GetRegistrationProperties(out nint props);
 [PreserveSig]int Initialize(uint size,nint data);[PreserveSig]int IsInputFormatSupported(nint opposite,nint requested,out nint supported);
 [PreserveSig]int IsOutputFormatSupported(nint opposite,nint requested,out nint supported);[PreserveSig]int GetInputChannelCount(out uint channels);
}
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface DeviceEnumerator{void Enumerate(int flow,uint state,[MarshalAs(UnmanagedType.Interface)]out object collection);void Default(int flow,int role,out Device device);void Get([MarshalAs(UnmanagedType.LPWStr)]string id,out Device device);}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Device{void Activate(ref Guid id,uint context,nint parameters,[MarshalAs(UnmanagedType.Interface)]out object result);void OpenProperties(uint access,[MarshalAs(UnmanagedType.Interface)]out object properties);void Id([MarshalAs(UnmanagedType.LPWStr)]out string id);void State(out uint state);}
[ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Properties{}
[ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Collection{}
[ComImport,Guid("F8679F50-850A-41CF-9C72-430F290290C8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface Policy{void S0();void S1();void S2();void S3();void S4();void S5();void S6();void S7();void S8();void S9();void S10();void Visibility([MarshalAs(UnmanagedType.LPWStr)]string id,[MarshalAs(UnmanagedType.I2)]short visible);}
static class Probe{
 [DllImport("kernel32",CharSet=CharSet.Unicode)]static extern bool SetDllDirectory(string path);
 [DllImport("ole32")]static extern int CoInitializeEx(nint reserved,uint flags);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetClass(ref Guid clsid,ref Guid iid,out nint value);
 [StructLayout(LayoutKind.Sequential)]struct Init{public uint Size;public Guid ClassId;}
 [MTAThread]static int Main(string[] args){try{
  CoInitializeEx(0,0);var folder=Path.GetFullPath(args[0]);SetDllDirectory(folder);Directory.SetCurrentDirectory(folder);
  var library=NativeLibrary.Load(Path.Combine(folder,"Sonar.APO.dll"));var get=Marshal.GetDelegateForFunctionPointer<GetClass>(NativeLibrary.GetExport(library,"DllGetClassObject"));
  var clsid=new Guid("4B7758C2-9361-4F88-83E9-44D8F05184EF");var factoryId=typeof(Factory).GUID;
  Marshal.ThrowExceptionForHR(get(ref clsid,ref factoryId,out var p));var factory=(Factory)Marshal.GetObjectForIUnknown(p);Marshal.Release(p);
  var iid=typeof(Apo).GUID;factory.CreateInstance(null,ref iid,out var instance);var apo=(Apo)instance;
  var hr=apo.Initialize(0,0);var init=new Init{Size=(uint)Marshal.SizeOf<Init>(),ClassId=clsid};var mem=Marshal.AllocHGlobal(Marshal.SizeOf<Init>());Marshal.StructureToPtr(init,mem,false);
  var baseHr=hr>=0?hr:apo.Initialize(init.Size,mem);Marshal.FreeHGlobal(mem);
  var variations=new List<object>();foreach(var size in new[]{56,88,96}){
   var block=Marshal.AllocHGlobal(size);Marshal.Copy(new byte[size],0,block,size);Marshal.WriteInt32(block,size);Marshal.StructureToPtr(new Init{Size=(uint)size,ClassId=clsid},block,false);
   if(size>=88)Marshal.StructureToPtr(new Guid("C18E2F7E-933D-4965-B7D1-1EEF228D2AF3"),block+64,false);
   var code=apo.Initialize((uint)size,block);variations.Add(new{size,hr=$"0x{code:X8}"});Marshal.FreeHGlobal(block);
  }Console.WriteLine(JsonSerializer.Serialize(variations));
  var devices=(DeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"))!)!;
  var micId="{0.0.1.00000000}.{943c2a2c-84c0-4d35-b7ea-2402157ebc1f}";devices.Get(micId,out var mic);mic.OpenProperties(0,out var properties);devices.Enumerate(1,1,out var collection);
  var propsPtr=Marshal.GetComInterfaceForObject(properties,typeof(Properties));var collPtr=Marshal.GetComInterfaceForObject(collection,typeof(Collection));
  var initialized=Marshal.AllocHGlobal(88);Marshal.Copy(new byte[88],0,initialized,88);Marshal.StructureToPtr(new Init{Size=88,ClassId=clsid},initialized,false);
  Marshal.WriteIntPtr(initialized,24,propsPtr);Marshal.WriteIntPtr(initialized,32,propsPtr);Marshal.WriteIntPtr(initialized,48,collPtr);Marshal.StructureToPtr(new Guid("C18E2F7E-933D-4965-B7D1-1EEF228D2AF3"),initialized+64,false);
  var propHr=apo.Initialize(88,initialized);Console.WriteLine(JsonSerializer.Serialize(new{propertyInitialize=$"0x{propHr:X8}"}));Marshal.FreeHGlobal(initialized);Marshal.Release(propsPtr);Marshal.Release(collPtr);
  if(args.Contains("--audio-test")){
   var apiLib=NativeLibrary.Load(Path.Combine(folder,"Sonar.APOAPI.dll"));var getApi=Marshal.GetDelegateForFunctionPointer<GetClass>(NativeLibrary.GetExport(apiLib,"DllGetClassObject"));
   var apiClass=new Guid("DEA05346-7BE3-4DB0-AE9F-14423648EA7B");Marshal.ThrowExceptionForHR(getApi(ref apiClass,ref factoryId,out var apiP));var apiFactory=(Factory)Marshal.GetObjectForIUnknown(apiP);Marshal.Release(apiP);
   var apiId=typeof(IBasicControl).GUID;apiFactory.CreateInstance(null,ref apiId,out var apiObject);var control=(IBasicControl)apiObject;control.Initialize("ChatCapture");control.OpenStore(out var store);
   var saved=new List<(ISetting Setting,bool Value)>();
   try{foreach(var key in new[]{"NoiseCancelingState","NoiseGateState","NoiseGateAutoThreshold","ParametricEqState","CaptureCompressorState","CaptureAmbientNoiseReductionState","ImpactNoiseReductionState"}){store.OpenSetting(Enum.Parse<ESetting>("kSet_"+key),out var s);s.GetBoolSetting(out var before);saved.Add((s,before));s.SetBoolSetting(false);}
    Console.WriteLine(JsonSerializer.Serialize(AudioTest.Run(instance,1)));Console.WriteLine(JsonSerializer.Serialize(AudioTest.Run(instance,2)));
   }finally{foreach(var item in saved)item.Setting.SetBoolSetting(item.Value);}
  }
  if(args.Contains("--visibility-test")){
   var id="{0.0.0.00000000}.{8ef8f5e6-ed55-4470-b338-aced9f7cc2ce}";devices.Get(id,out var render);render.State(out var before);
   var policy=(Policy)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9"))!)!;
   try{policy.Visibility(id,0);Thread.Sleep(500);render.State(out var hidden);Console.WriteLine(JsonSerializer.Serialize(new{before,hidden}));}finally{policy.Visibility(id,1);Marshal.FinalReleaseComObject(policy);}
  }
  Console.WriteLine(JsonSerializer.Serialize(new{initializeZero=$"0x{hr:X8}",initializeBase=$"0x{baseHr:X8}",latencyHr=$"0x{apo.GetLatency(out var latency):X8}",latency}));
  Marshal.FinalReleaseComObject(apo);Marshal.FinalReleaseComObject(factory);return 0;
 }catch(Exception error){Console.WriteLine(JsonSerializer.Serialize(new{error=error.Message}));return 1;}}
}
