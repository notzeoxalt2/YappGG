using NAudio.CoreAudioApi;
using NAudio.CoreAudioApi.Interfaces;
using System.Diagnostics;

namespace MicOnly;

static class MicrophoneApps
{
    public static object Active()
    {
        using var enumerator = new MMDeviceEnumerator();
        var apps = new Dictionary<int, (string Name, HashSet<string> Devices)>();
        foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
        using (device)
        {
            try
            {
                var manager = device.AudioSessionManager;
                manager.RefreshSessions();
                for (int i = 0; i < manager.Sessions.Count; i++)
                using (var session = manager.Sessions[i])
                {
                    if (session.State != AudioSessionState.AudioSessionStateActive) continue;
                    var pid = (int)session.GetProcessID;
                    if (pid == 0 || pid == Environment.ProcessId) continue;
                    try
                    {
                        using var process = Process.GetProcessById(pid);
                        if (process.ProcessName.Equals("MicBackend", StringComparison.OrdinalIgnoreCase)) continue;
                        if (!apps.TryGetValue(pid, out var entry))
                            entry = (process.ProcessName, new HashSet<string>());
                        entry.Devices.Add(device.FriendlyName);
                        apps[pid] = entry;
                    }
                    catch (ArgumentException) { } // Process exited during the snapshot.
                }
            }
            catch (System.Runtime.InteropServices.COMException) { } // Endpoint disappeared.
        }
        return apps.OrderBy(a => a.Value.Name).Select(a => new { pid = a.Key, name = a.Value.Name, devices = a.Value.Devices.ToArray() }).ToArray();
    }
}
