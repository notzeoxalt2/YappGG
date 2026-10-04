using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.Wave;
namespace MicOnly;
sealed class GgCapture : IDisposable
{
    MMDevice? device;WasapiCapture? capture;WaveFileWriter? writer;readonly object sync=new();
    float peak;bool running;string? path;long samples;double squares;float recordPeak;
    public void Start(){Stop();using var e=new MMDeviceEnumerator();device=e.EnumerateAudioEndPoints(DataFlow.Capture,DeviceState.Active).FirstOrDefault(AudioPolicy.IsGG)??throw new InvalidOperationException("Start SteelSeries GG with Sonar enabled. Its signed microphone device is required.");capture=new WasapiCapture(device,false,20);capture.DataAvailable+=(_,a)=>{float current=0;lock(sync){for(int i=0;i+4<=a.BytesRecorded;i+=4){float value=BitConverter.ToSingle(a.Buffer,i);if(!float.IsFinite(value))continue;current=Math.Max(current,Math.Abs(value));if(writer!=null){samples++;squares+=value*value;recordPeak=Math.Max(recordPeak,Math.Abs(value));}}writer?.Write(a.Buffer,0,a.BytesRecorded);}peak=current;};capture.StartRecording();running=true;}
    public void RecordStart(string file){if(!running||capture==null)throw new InvalidOperationException("Start microphone first.");lock(sync){RecordStop();path=Path.GetFullPath(file);Directory.CreateDirectory(Path.GetDirectoryName(path)!);writer=new WaveFileWriter(path,capture.WaveFormat);samples=0;squares=0;recordPeak=0;}}
    public object RecordStop(){lock(sync){writer?.Dispose();writer=null;return new{path,samples,bytes=samples*4,peak=recordPeak,rms=samples>0?Math.Sqrt(squares/samples):0};}}
    public object Status()=>new{running,outputName=device?.FriendlyName,outputPeak=peak,inputPeak=peak,recording=writer!=null,mode="gg",routingError=(string?)null};
    public void Stop(){running=false;capture?.StopRecording();RecordStop();capture?.Dispose();capture=null;device?.Dispose();device=null;peak=0;}
    public void Dispose()=>Stop();
    public static int Server(){using var engine=new GgCapture();using var share=new ShareProtection();Console.WriteLine(JsonSerializer.Serialize(new{ready=true,mode="gg"}));string? line;while((line=Console.ReadLine())!=null){using var doc=JsonDocument.Parse(line);var m=doc.RootElement;int id=m.GetProperty("id").GetInt32();try{switch(m.GetProperty("command").GetString()){
        case "start":engine.Start();break;case "stop":engine.Stop();break;
        case "desktop-isolation":share.SetDesktopBlock(m.GetProperty("enabled").GetBoolean());break;
                                case "share-protection":share.SetEnabled(m.GetProperty("enabled").GetBoolean());break;
        case "status":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,status=engine.Status(),shareProtection=share.Status()}));continue;
        case "record-start":engine.RecordStart(m.GetProperty("path").GetString()!);break;
        case "record-stop":Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,recording=engine.RecordStop()}));continue;
        default:throw new InvalidOperationException("Unsupported GG capture command.");
    }Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true}));}catch(Exception error){Console.WriteLine(JsonSerializer.Serialize(new{id,ok=false,error=error.Message}));}}return 0;}
}
