using System.Runtime.InteropServices;
using System.Text.Json;
using SonarAPOSettingsControl;
using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using Microsoft.Data.Sqlite;

namespace MicOnly;

[ComImport,Guid("00000001-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IClassFactory
{
    void CreateInstance([MarshalAs(UnmanagedType.IUnknown)]object? outer,ref Guid iid,[MarshalAs(UnmanagedType.IUnknown)]out object instance);
    void LockServer(bool locked);
}
static class NativeEngine
{
    public static string Repository="ChatCapture";
    public static IsolatedRegistry? Isolation;
    public static bool Isolate;
    public static string SonarPath=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"..","native-runtime"));
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]delegate int GetClassObject(ref Guid clsid,ref Guid iid,out IntPtr result);
    static readonly List<IntPtr> libraries=new();
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool SetDllDirectory(string directory);
    public static void PrepareRuntime()=>SetDllDirectory(SonarPath);
    [DllImport("ole32.dll")]public static extern int CoInitializeEx(nint reserved,uint flags);
    public static T Create<T>(string path,string clsid)
    {
        SetDllDirectory(SonarPath);
        var library=NativeLibrary.Load(path);libraries.Add(library);
        var getClass=Marshal.GetDelegateForFunctionPointer<GetClassObject>(NativeLibrary.GetExport(library,"DllGetClassObject"));
        var classId=new Guid(clsid);var factoryId=typeof(IClassFactory).GUID;
        Marshal.ThrowExceptionForHR(getClass(ref classId,ref factoryId,out var pointer));
        try {var factory=(IClassFactory)Marshal.GetObjectForIUnknown(pointer);try{var iid=typeof(T).GUID;factory.CreateInstance(null,ref iid,out var instance);return (T)instance;}finally{Marshal.FinalReleaseComObject(factory);}}
        finally{Marshal.Release(pointer);}
    }
    public static IBasicControl OpenMicrophone()
    {
        var control=Create<IBasicControl>(Path.Combine(SonarPath,"Sonar.APOAPI.dll"),"DEA05346-7BE3-4DB0-AE9F-14423648EA7B");
        if(Isolate)Isolation??=new IsolatedRegistry();
        if(Isolate)control.InitializeEx("SteelSeries ApS","Sonar.APO",Repository);else control.Initialize(Repository);return control;
    }
}
static class AudioDevices{public static bool IsSonarMic(MMDevice d)=>MicEngine.IsSonarMic(d);}
static class Program
{
    [MTAThread]static int Main(string[] args)
    {
        try
        {
            if(args.Contains("--decode-media")){var index=Array.IndexOf(args,"--decode-media");Console.WriteLine(JsonSerializer.Serialize(MediaImport.Decode(args[index+1],args[index+2])));return 0;}
            if(args.Contains("--cleanup-test")){NativeEngine.CoInitializeEx(0,0);NativeEngine.PrepareRuntime();using var context=new NativeActivationContext();Console.WriteLine(JsonSerializer.Serialize(CleanupTest.Run()));return 0;}
            if(args.Contains("--fun-test")){using var doc=JsonDocument.Parse(File.ReadAllText(args[Array.IndexOf(args,"--fun-test")+1]));Console.WriteLine(JsonSerializer.Serialize(FunDsp.Measure(doc.RootElement)));return 0;}
            if(args.Contains("--share-sessions")){using var guard=new ShareProtection();Console.WriteLine(JsonSerializer.Serialize(guard.Inspect(false)));return 0;}
            if(args.Contains("--brand-adapter")){Console.WriteLine(JsonSerializer.Serialize(DriverBranding.Rename()));return 0;}
            if(args.Contains("--gg-capture-server"))return GgCapture.Server();
            if(args.Contains("--engine-info")){Console.WriteLine(JsonSerializer.Serialize(new{ggRunning=System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length>0}));return 0;}
            if(args.Contains("--safe-route")){Console.WriteLine(JsonSerializer.Serialize(AudioPolicy.SafeRoute()));return 0;}
            if(args.Contains("--discord-setup")){Console.WriteLine(JsonSerializer.Serialize(AudioPolicy.DiscordSetup()));return 0;}
            if(args.Contains("--independent-server"))return IndependentEngine.Server();
            if(args.Contains("--capture-cable")){Console.WriteLine(JsonSerializer.Serialize(IndependentEngine.CaptureCable(args[1],4000)));return 0;}
            if(args.Contains("--cable-devices")){Console.WriteLine(JsonSerializer.Serialize(IndependentEngine.Devices()));return 0;}
            if(args.Contains("--mic-apps")){Console.WriteLine(JsonSerializer.Serialize(MicrophoneApps.Active()));return 0;}
            if(args.Contains("--driver-status")){Console.WriteLine(JsonSerializer.Serialize(new{installed=DriverSetup.Installed()}));return 0;}
            if(args.Contains("--brand-devices")){Console.WriteLine(JsonSerializer.Serialize(DeviceBranding.Rename()));return 0;}
            if(args.Contains("--routing-status")){
                using var devices=new MMDeviceEnumerator();
                using var playback=devices.GetDefaultAudioEndpoint(DataFlow.Render,Role.Multimedia);
                using var communications=devices.GetDefaultAudioEndpoint(DataFlow.Render,Role.Communications);
                Console.WriteLine(JsonSerializer.Serialize(new{playback=playback.FriendlyName,communicationsPlayback=communications.FriendlyName,virtualMicIsPlaybackDefault=MicEngine.IsSonarMic(playback)||MicEngine.IsSonarMic(communications),screenShare="Select a physical playback device or application-only sound. Whole-system capture may include the virtual microphone render stream."}));return 0;
            }
            if(args.Contains("--install-driver")){Console.WriteLine(JsonSerializer.Serialize(DriverSetup.Install()));return 0;}
            if(args.Contains("--import-presets"))
            {
                using var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=@"C:\ProgramData\SteelSeries\GG\apps\sonar\db\database.db",Mode=SqliteOpenMode.ReadOnly}.ToString());db.Open();
                using var query=db.CreateCommand();query.CommandText="SELECT id,name,is_preset,is_favorite,favorite_position,data,default_data,schema_version,image FROM configs WHERE vad=3";
                var configs=new List<object>();using(var rows=query.ExecuteReader())while(rows.Read())
                {
                    var schema=rows.GetInt32(7);if(schema is not(5 or 6))throw new InvalidDataException("Unsupported preset schema.");
                    configs.Add(new{id=rows.GetString(0),name=rows.GetString(1),isPreset=rows.GetBoolean(2),isFavorite=rows.GetBoolean(3),favoritePosition=rows.GetInt32(4),data=JsonSerializer.Deserialize<JsonElement>(rows.GetString(5)),defaultData=JsonSerializer.Deserialize<JsonElement>(rows.GetString(6)),schemaVersion=schema,image=rows.IsDBNull(8)?null:rows.GetString(8),virtualAudioDevice="chatCapture",isNew=false});
                }
                query.CommandText="SELECT config_id FROM selected_config WHERE vad=3";
                Console.WriteLine(JsonSerializer.Serialize(new{configs,selected=query.ExecuteScalar()}));return 0;
            }
            if(args.Contains("--devices"))
            {
                using var enumerator=new MMDeviceEnumerator();
                Console.WriteLine(JsonSerializer.Serialize(enumerator.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).Where(d=>{try{return !MicEngine.IsSonarMic(d)&&!IndependentEngine.IsCable(d)&&!d.FriendlyName.Contains("SteelSeries Sonar",StringComparison.OrdinalIgnoreCase);}catch(COMException){return false;}}).Select(d=>new{id=d.ID,name=d.FriendlyName})));return 0;
            }
            if(args.Contains("--endpoint-report"))
            {
                using var enumerator=new MMDeviceEnumerator();var rows=new List<object>();foreach(var device in enumerator.EnumerateAudioEndPoints(DataFlow.All,DeviceState.All))try{if(device.FriendlyName.Contains("Sonar"))rows.Add(new{id=device.ID,name=device.FriendlyName,state=(int)device.State,flow=device.DataFlow.ToString()});}catch(COMException){}Console.WriteLine(JsonSerializer.Serialize(rows));return 0;
            }
            if(args.Contains("--probe"))
            {
                NativeEngine.Isolate=args.Contains("--isolated");
                using var engine=new MicEngine();using var enumerator=new MMDeviceEnumerator();
                var capture=enumerator.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).Select(d=>new {id=d.ID,name=d.FriendlyName}).ToArray();
                var render=enumerator.EnumerateAudioEndPoints(DataFlow.Render,DeviceState.Active).Select(d=>new {id=d.ID,name=d.FriendlyName}).ToArray();
                Console.WriteLine(JsonSerializer.Serialize(new {repository=NativeEngine.Repository,settings=engine.Snapshot(),capture,render}));return 0;
            }
            if(args.Contains("--exclusive-server"))
            {
                var comResult=NativeEngine.CoInitializeEx(0,0);Console.Error.WriteLine($"COM initialization: 0x{comResult:X8}");
                NativeEngine.PrepareRuntime();
                using var context=new NativeActivationContext();
                var mixed=System.Reflection.Assembly.Load("Sonar.Logging.Interop");
                System.Runtime.CompilerServices.RuntimeHelpers.RunModuleConstructor(mixed.ManifestModule.ModuleHandle);
                SoundStage.Logging.NativeLogger.Initialize(()=>new NativeLog());
                if(System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length>0)throw new InvalidOperationException("GG/Sonar is running. Exclusive mode is unavailable.");
                using var engine=new MicEngine();using var share=new ShareProtection();var before=engine.Snapshot();
                Console.WriteLine(JsonSerializer.Serialize(new{ready=true,mode="exclusive",running=false}));
                try
                {
                    string? line;
                    while((line=Console.ReadLine())!=null)
                    {
                        using var request=JsonDocument.Parse(line);var message=request.RootElement;
                        var id=message.GetProperty("id").GetInt32();
                        try
                        {
                            if(System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length>0){engine.Stop();throw new InvalidOperationException("GG/Sonar started; exclusive processing stopped.");}
                            switch(message.GetProperty("command").GetString())
                            {
                                case "apply":engine.Apply(new Preset("local","local",false,false,message.GetProperty("data").Clone()));break;
                                case "start":engine.Start(message.GetProperty("inputId").GetString()!);break;
                                case "stop":engine.Stop();break;
                                case "desktop-isolation":share.SetDesktopBlock(message.GetProperty("enabled").GetBoolean());break;
                                case "share-protection":share.SetEnabled(message.GetProperty("enabled").GetBoolean());break;
                                case "status":share.Status();Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,status=engine.Status(),shareProtection=share.Status()}));continue;
                                case "gain":engine.Gain(message.GetProperty("value").GetSingle(),message.TryGetProperty("muted",out var muted)&&muted.GetBoolean());break;
                                case "after-effect":engine.AfterEffect(message.TryGetProperty("data",out var after)&&after.ValueKind==JsonValueKind.Object?after:null);break;
                                case "soundboard-ready":engine.PrepareSoundboard();break;
                                case "soundboard-play":engine.PlaySound(message.GetProperty("soundId").GetString()!,message.GetProperty("path").GetString()!,message.GetProperty("volume").GetSingle());break;
                                case "soundboard-stop":engine.StopSounds(message.TryGetProperty("soundId",out var soundId)?soundId.GetString():null);break;
                                case "record-start":engine.RecordStart(message.GetProperty("path").GetString()!);break;
                                case "record-stop":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,recording=engine.RecordStop()}));continue;
                                case "capture-test":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,capture=engine.CaptureTest(message.GetProperty("milliseconds").GetInt32())}));continue;
                                case "snapshot":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,settings=engine.Snapshot(),running=engine.Running}));continue;
                                default:throw new InvalidDataException("Unknown backend command.");
                            }
                            Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,running=engine.Running}));
                        }
                        catch(Exception error){Console.WriteLine(JsonSerializer.Serialize(new{id,ok=false,error=error.Message,trace=error.ToString()}));}
                    }
                }
                finally{engine.Stop();if(System.Diagnostics.Process.GetProcessesByName("SteelSeriesSonar").Length==0)engine.Restore(before);}
                return 0;
            }
            return 0;
        }
        catch(Exception ex){Console.Error.WriteLine(ex);return 1;}
    }
}
