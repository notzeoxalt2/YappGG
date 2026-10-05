# YappGG

Windows microphone processing with EQ, local ClearCast cleanup, presets, optional aftereffects and a soundboard. GG and VB-CABLE are not required. Existing signed Sonar audio components are included; this is not a newly signed YappGG driver. Third-party components retain their original ownership and licenses.

Download the installer from [Releases](https://github.com/notzeoxalt2/YappGG/releases). Select your physical microphone in YappGG, then select YappGG Microphone as Discord input and your headphones as output.

The host starts the saved microphone independently of UI loading; renderer connection requests wait for this bootstrap instead of starting another stream. Stop/quit cancels bootstrap and a saved disabled mic remains disabled. Startup readiness checks run concurrently and avoid a repeated routing pass. Transient device/service availability failures retry automatically. A capture-packet watchdog reconnects a stuck stream after a startup grace period; silent packets count as healthy, so quiet speech breaks do not trigger it. Actual Windows reboot/call behavior remains a manual check.

The installer opens YappGG after Finish by default. Start with Windows is checked by default. Discord setup and enhancement are optional, with a revert option in Settings.

## Updates

Installed builds check public GitHub Releases after startup and every six hours, downloading newer stable versions in the background. Settings has Automatic updates, Check for updates and Restart to update. Installation waits for your explicit restart; Windows may request administrator approval. Release downloads must remain public for friends to update without credentials. No GitHub token is included in the app.

Versions through 0.7.7 may need one manual installation of the latest release if Restart to update fails. The Windows helper starts through Windows Start-Process in a hidden background window and survives the calling app closing, rather than using Node detached launch, which can silently exit before running PowerShell. Readiness is checked before the app quits, with separate verification/shutdown/helper status and failure logs.

## Soundboard

YappGG Microphone carries clean voice; YappGG Troll carries voice plus clips by default. Send media to lets you choose Troll only, normal mic only, or both. Select the same microphone in Discord. Separate meters show captured audio; Discord voice detection may still suppress music if its filters or input threshold are enabled.

Use Play again to stop, Pause/Resume to keep position, and Restart to begin again. Stop all and Pause/Resume all have configurable global shortcuts (Ctrl+Alt+S and Ctrl+Alt+P by default). Your headphone preview and the boosted mic-send volume are independent. Boost is capped at 10,000% with a final peak limit; high settings distort. The wheel shortcut defaults to Alt + Shift + backtick (`); the shortcut editor accepts the backtick key even when Shift produces a tilde. The transparent dark sound wheel offers four sizes and 4, 6, 8, 10 or 12 sounds per page. Tile spacing and fitted labels prevent overlaps. The wheel is a non-activating overlay, so opening it does not take foreground focus from the game. Only the Back/Next buttons change pages; hover, wheel scrolling and arrow keys do not. Its folder selection and size settings persist across restarts. Nested folders such as Omen/Jett remain separate, including when importing folders or ZIP packs. The wheel shows only sounds; select a subfolder from the top dropdown. Previous/next folder arrows stay at the current folder level. Parent folders include their descendant sounds. Rename/move preserves clip IDs, shortcuts and volumes. Updates keep the AppData sound library; folder migration saves a backup before changing its index. Missing audio stays visible with Replace missing file to restore media without losing its settings.

Videos display muted locally to avoid duplicate audio. Folders organize clips and full music/video files.

The signed driver requires active render feed endpoints, which Windows also lists as outputs. Keep physical headphones as your playback output; disabling those feeds breaks the microphones.

Drag audio/video files or ZIP packs onto Soundboard, or use Import audio / ZIP. Open folder opens a dedicated Soundboard imports inbox; paste files or nested folders there and they appear automatically without autoplay. Refresh folder scans on demand. Imports show a file counter and current filename. Cancel import stops the active extraction/decoder and retains completed clips. Cancelling inbox imports pauses its watcher across restarts; use Refresh folder to resume scanning. One native decoder is reused across clips, with batched library checkpoints to reduce startup and disk overhead. Long music/video still needs decoding and WAV storage. Imported originals remain in the inbox, so you can remove them after import if you want to reclaim space. The managed sound library stays separate. Assign each sound a shortcut using a modifier plus a letter, number or function key. Shortcuts also work from the tray. Clips mix after cleanup; YappGG mute silences the combined output. Imports have no fixed pack-byte, source-byte, total-library or sound-count cap. ZIP/ZIP64 media extracts in streams with checksums, and files decode sequentially to disk. Available disk space and the supported audio/container formats still apply; large imports may take longer. Unsupported or damaged media is reported and skipped. MP3, MP4, WAV, FLAC, Ogg and WebM have been tested. No test clips are bundled.

## Development

Requires Windows x64, Node.js, .NET 8 SDK and the included native components.

```powershell
npm ci
dotnet publish backend/CompactNativeBackend.csproj -c Release -r win-x64 --self-contained true -o build/compact-native
node prepare-bridge.cjs
node stage-release.cjs
npm start
```

Build with npm run dist. Run node tests/verify-updates.cjs for updater behavior and npm run verify for UI checks. Audio tests need installed microphone components and a physical input.

## Publishing updates

Bump package.json and its lock file, update the Settings version label, then build and verify. Commit and tag the version. Create a draft stable GitHub Release tagged v<version> and upload the matching installer, .exe.blockmap and latest.yml together. Publish only after uploading all files. Source commits alone do not trigger client updates.

Installers are currently unsigned; bundled driver signatures are separate. A complete clean-PC installation and restart test is still required for broader distribution.

If GG is uninstalled, its uninstaller can remove the shared signed driver. YappGG detects missing driver/configuration on connection and offers Windows repair automatically. Settings also includes Repair microphone. The repair restores bundled components and does not reinstall GG. Windows administrator approval may be required.

Version 0.6.1 separates meter updates from editable controls, uses immediate button feedback, moves clip actions away from volume/keybind inputs and applies per-clip volume to already-playing clips. Preview-volume changes reuse the current physical output instead of repeatedly enumerating devices.

Version 0.7.1 adds a compact transparent sound wheel. Ctrl+Alt+Q opens it on your current monitor, including from the tray. Drag toward a sound and release to play. Escape cancels. Scroll between pages, click Back/Next, or hover over either page button for 420 milliseconds. Page buttons are hidden for a single page. The small folder picker above the wheel defaults to All and remembers your choice across app/PC restarts. Configure its shortcut in Trolling / Soundboards. Exclusive fullscreen apps can cover overlays; use borderless mode if needed.

Trolling voice effects, effect selection, effect on/off and the global voice shortcut are now in Trolling / Soundboards. Settings links to these controls. Voice effects affect the Troll voice path; clips are mixed afterward. Application/tab capture has been removed. Imports, local video previews, independent send/preview levels and shortcuts remain.

Update installation verifies the downloaded installer hash, closes the microphone engine, starts a detached helper, and waits for the app to exit before launching installation. Windows administrator approval is required. The helper checks the exit code and installed version, records failures, and reopens the app. In-app updates skip unchanged audio-component installation and preserve preferences. No forced update installation happens on ordinary exit. If an older app cannot launch the installer, download the matching release installer manually once.

Voice cleanup is invoked on voice buffers before media mixing. Windows endpoint effects are bypassed for YappGG endpoints to prevent a second pass on the combined stream. A failed bypass leaves the microphone available and shows a warning. Receiving apps can still apply their own filtering. Verification for 0.7.1 stayed silent; end-to-end installation from the updater is reserved for the user.

YappGG microphone endpoints stay enabled when the engine closes so receiving apps can keep their selection. Reconnect skips unchanged device labels and endpoint effect properties, and a fresh engine always starts the saved physical input.
