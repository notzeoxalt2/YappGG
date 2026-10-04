# YappGG

Windows microphone processing with EQ, local ClearCast cleanup, presets, optional aftereffects and a soundboard. GG and VB-CABLE are not required. Existing signed Sonar audio components are included; this is not a newly signed YappGG driver. Third-party components retain their original ownership and licenses.

Download the installer from [Releases](https://github.com/notzeoxalt2/YappGG/releases). Select your physical microphone in YappGG, then select YappGG Microphone as Discord input and your headphones as output.

The installer opens YappGG after Finish by default. Start with Windows is checked by default. Discord setup and enhancement are optional, with a revert option in Settings.

## Updates

Installed builds check public GitHub Releases after startup and every six hours, downloading newer stable versions in the background. Settings has Automatic updates, Check for updates and Restart to update. Installation waits for your explicit restart; Windows may request administrator approval. Release downloads must remain public for friends to update without credentials. No GitHub token is included in the app.

Versions through 0.5.0 need one manual installation of 0.6.1 to gain the updater.

## Soundboard

YappGG Microphone carries clean voice; YappGG Troll carries voice plus clips by default. Send media to lets you choose Troll only, normal mic only, or both. Select the same microphone in Discord. Separate meters show captured audio; Discord voice detection may still suppress music if its filters or input threshold are enabled.

Use Play again to stop, Pause/Resume to keep position, and Restart to begin again. Stop all and Pause/Resume all have configurable global shortcuts (Ctrl+Alt+S and Ctrl+Alt+P by default). Your headphone preview and the boosted mic-send volume are independent. Boost is capped at 10,000% with a final peak limit; high settings distort. Videos display muted locally to avoid duplicate audio. Folders organize clips and full music/video files. Selected application capture includes its child processes and excludes unrelated applications; control that application’s original local listening volume in Windows or the app itself.

The signed driver requires active render feed endpoints, which Windows also lists as outputs. Keep physical headphones as your playback output; disabling those feeds breaks the microphones.

Drag audio/video files or ZIP packs onto Soundboard, or use Import audio / ZIP. Open folder opens a dedicated Soundboard imports inbox; paste files or nested folders there and they appear automatically without autoplay. Refresh folder scans on demand. Imported originals remain in the inbox, so you can remove them after import if you want to reclaim space. The managed sound library stays separate. Assign each sound a shortcut using a modifier plus a letter, number or function key. Shortcuts also work from the tray. Clips mix after cleanup; YappGG mute silences the combined output. Unsupported or damaged media is reported and skipped. MP3, MP4, WAV, FLAC, Ogg and WebM have been tested. No test clips are bundled.

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
