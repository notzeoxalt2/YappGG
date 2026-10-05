namespace MicOnly;
// Packet timing, including silent packets, distinguishes a stuck capture from a quiet microphone.
sealed class CaptureHeartbeat(Func<long>? clock=null)
{
    readonly Func<long> now=clock??(()=>Environment.TickCount64);
    long started,lastPacket;volatile bool active,received;
    public void Start(){started=now();lastPacket=started;received=false;active=true;}
    public void Packet(){Interlocked.Exchange(ref lastPacket,now());received=true;}
    public void Stop(){active=false;received=false;}
    public bool Ready=>active&&received;
    public bool Stalled=>active&&now()-started>=5000&&now()-Interlocked.Read(ref lastPacket)>=2000;
}
