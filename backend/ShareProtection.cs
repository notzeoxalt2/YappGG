using System.Diagnostics;
using NAudio.CoreAudioApi;
namespace MicOnly;

// Discord's loopback session on the virtual mic is separate from its call input.
// Touch only that render session, never the mic producer or headphone output.
sealed class ShareProtection : IDisposable
{
    readonly Dictionary<string, bool> previous = new();
    long checkedAt;
    public bool Enabled { get; private set; } = true;
    public bool BlockDesktopAudio { get; private set; } = true;
    object last = new { enabled = true, sessions = 0 };
    public void SetEnabled(bool enabled) { Enabled = enabled; checkedAt = 0; if (!enabled) Restore(); }
    public void SetDesktopBlock(bool enabled) { Restore(); BlockDesktopAudio = enabled; checkedAt = 0; }
    public object Status()
    {
        if (Environment.TickCount64 - checkedAt < 1000) return last;
        checkedAt = Environment.TickCount64;
        try { last = Inspect(true); }
        catch (Exception error) { last = new { enabled = Enabled, error = error.Message }; }
        return last;
    }
    public object Inspect(bool apply)
    {
        using var e = new MMDeviceEnumerator();
        var rows = new List<object>();
        foreach (var d in e.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
        using (d)
        {
            if (!AudioPolicy.IsGG(d)) continue;
            var manager = d.AudioSessionManager;
            manager.RefreshSessions();
            for (int i = 0; i < manager.Sessions.Count; i++)
            using (var session = manager.Sessions[i])
            {
                try
                {
                    using var process = Process.GetProcessById((int)session.GetProcessID);
                    var name = process.ProcessName;
                    bool discord = name.Equals("Discord", StringComparison.OrdinalIgnoreCase)
                        || name.Equals("DiscordPTB", StringComparison.OrdinalIgnoreCase)
                        || name.Equals("DiscordCanary", StringComparison.OrdinalIgnoreCase);
                    var key = d.ID + "|" + session.GetSessionInstanceIdentifier;
                    var before = session.SimpleAudioVolume.Mute;
                    bool producer = process.Id == Environment.ProcessId || name.Equals("MicBackend", StringComparison.OrdinalIgnoreCase)
                        || name.Equals("SteelSeriesSonar", StringComparison.OrdinalIgnoreCase);
                    bool target = (Enabled && discord) || (BlockDesktopAudio && !discord && !producer && process.Id != 0);
                    if (apply && target)
                    {
                        previous.TryAdd(key, before);
                        session.SimpleAudioVolume.Mute = true;
                    }
                    rows.Add(new { endpoint = d.ID, process = name, pid = process.Id,
                        targeted = target, producer, before, muted = session.SimpleAudioVolume.Mute });
                }
                catch (ArgumentException) { } // Process ended during enumeration.
            }
        }
        return new { enabled = Enabled, blockDesktopAudio = BlockDesktopAudio, applied = apply, sessions = rows };
    }
    void Restore()
    {
        try
        {
            using var e = new MMDeviceEnumerator();
            foreach (var d in e.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
            using (d)
            {
                if (!AudioPolicy.IsGG(d)) continue;
                var manager = d.AudioSessionManager; manager.RefreshSessions();
                for (int i = 0; i < manager.Sessions.Count; i++)
                using (var session = manager.Sessions[i])
                {
                    if (previous.TryGetValue(d.ID + "|" + session.GetSessionInstanceIdentifier, out var mute)
                        && session.SimpleAudioVolume.Mute) session.SimpleAudioVolume.Mute = mute;
                }
            }
        }
        catch (Exception error) { Console.Error.WriteLine("Share protection restore: " + error.Message); }
        previous.Clear();
    }
    public void Dispose() => Restore();
}
