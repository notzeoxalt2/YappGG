using SoundStage.Logging;
namespace MicOnly;
sealed class NativeLog : ILogger
{
    sealed class Scope : IDisposable {public void Dispose(){}}
    static void Write(string message)=>Console.Error.WriteLine(message);
    public IDisposable TimeAnalysis(string message=null!,string callerMemberName="")=>new Scope();
    public void TimeAnalysis(string messageTemplate,params object[] values){}
    public void TimeAnalysisBegin(string message){}
    public void TimeAnalysisEnd(string message){}
    public void Information(string message)=>Write(message);
    public void Information(Exception error,string message)=>Write(message+": "+error);
    public void Information(string message,params object[] values)=>Write(message);
    public void Warning(Exception error,string message)=>Write(message+": "+error);
    public void Warning(string message)=>Write(message);
    public void Error(Exception error,string message)=>Write(message+": "+error);
    public void Error(string message)=>Write(message);
    public void Error(string message,params object[] values)=>Write(message);
    public void Debug(string message)=>Write(message);
    public void Debug(string message,params object[] values)=>Write(message);
    public void Debug(Exception error,string message)=>Write(message+": "+error);
    public void Fatal(string message)=>Write(message);
    public void Fatal(Exception error,string message)=>Write(message+": "+error);
    public void Fatal(string message,params object[] values)=>Write(message);
}
