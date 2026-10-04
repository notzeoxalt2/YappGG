using System.Text.Json;
using NAudio.CoreAudioApi;
using Microsoft.Data.Sqlite;

namespace MicOnly;
static class AudioDevices
{
    public static bool IsSonarMic(MMDevice d){try{return AudioPolicy.IsGG(d)||d.FriendlyName.Contains("SteelSeries Sonar",StringComparison.OrdinalIgnoreCase)||d.FriendlyName.StartsWith("YappEQ Mic",StringComparison.OrdinalIgnoreCase);}catch(System.Runtime.InteropServices.COMException){return true;}}
}
static class StandaloneProgram
{
    static int Main(string[] args){try{
        if(args.Contains("--gg-capture-server"))return GgCapture.Server();
        if(args.Contains("--independent-server"))return IndependentEngine.Server();
        if(args.Contains("--cable-devices")){Console.WriteLine(JsonSerializer.Serialize(IndependentEngine.Devices()));return 0;}
        if(args.Contains("--capture-cable")){Console.WriteLine(JsonSerializer.Serialize(IndependentEngine.CaptureCable(args[1],4000)));return 0;}
        if(args.Contains("--safe-route")){Console.WriteLine(JsonSerializer.Serialize(AudioPolicy.SafeRoute()));return 0;}
        if(args.Contains("--discord-setup")){Console.WriteLine(JsonSerializer.Serialize(AudioPolicy.DiscordSetup()));return 0;}
        if(args.Contains("--mic-apps")){Console.WriteLine(JsonSerializer.Serialize(MicrophoneApps.Active()));return 0;}
        if(args.Contains("--gg-inputs")){using var e=new MMDeviceEnumerator();Console.WriteLine(JsonSerializer.Serialize(e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).Where(d=>AudioPolicy.IsGG(d)).Select(d=>new{id=d.ID,name="ClearCast from GG",kind="gg"})));return 0;}
        if(args.Contains("--devices")){using var e=new MMDeviceEnumerator();Console.WriteLine(JsonSerializer.Serialize(e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).Where(d=>!AudioDevices.IsSonarMic(d)&&!IndependentEngine.IsCable(d)).Select(d=>new{id=d.ID,name=d.FriendlyName})));return 0;}
        if(args.Contains("--routing-status")){using var e=new MMDeviceEnumerator();using var playback=e.GetDefaultAudioEndpoint(DataFlow.Render,Role.Multimedia);Console.WriteLine(JsonSerializer.Serialize(new{playback=playback.FriendlyName,virtualMicIsPlaybackDefault=AudioPolicy.IsGG(playback)||IndependentEngine.IsCable(playback),screenShare="Microphone is excluded from Sonar streaming and monitoring mixes. Discord microphone mute does not mute every capture path; use YappGG mute for global processed-mic mute."}));return 0;}
        if(args.Contains("--import-presets")){
            using var db=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=@"C:\ProgramData\SteelSeries\GG\apps\sonar\db\database.db",Mode=SqliteOpenMode.ReadOnly}.ToString());db.Open();
            using var query=db.CreateCommand();query.CommandText="SELECT id,name,is_preset,is_favorite,favorite_position,data,default_data,schema_version,image FROM configs WHERE vad=3";var configs=new List<object>();using(var rows=query.ExecuteReader())while(rows.Read()){int schema=rows.GetInt32(7);if(schema is not(5 or 6))throw new InvalidDataException("Unsupported preset schema.");configs.Add(new{id=rows.GetString(0),name=rows.GetString(1),isPreset=rows.GetBoolean(2),isFavorite=rows.GetBoolean(3),favoritePosition=rows.GetInt32(4),data=JsonSerializer.Deserialize<JsonElement>(rows.GetString(5)),defaultData=JsonSerializer.Deserialize<JsonElement>(rows.GetString(6)),schemaVersion=schema,image=rows.IsDBNull(8)?null:rows.GetString(8),virtualAudioDevice="chatCapture",isNew=false});}query.CommandText="SELECT config_id FROM selected_config WHERE vad=3";Console.WriteLine(JsonSerializer.Serialize(new{configs,selected=query.ExecuteScalar()}));return 0;
        }
        throw new ArgumentException("Unsupported standalone backend command.");
    }catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}}
}
