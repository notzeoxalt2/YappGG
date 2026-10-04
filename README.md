# YappGG

Windows microphone processing with EQ, local ClearCast cleanup, presets, optional aftereffects and a soundboard. GG and VB-CABLE are not required. Existing signed Sonar audio components are included; this is not a newly signed YappGG driver. Third-party components retain their original ownership and licenses.

Download the installer from [Releases](https://github.com/notzeoxalt2/YappGG/releases). Select your physical microphone in YappGG, then select YappGG Microphone as Discord input and your headphones as output.

The installer opens YappGG after Finish by default. Start with Windows is checked by default. Discord setup and enhancement are optional, with a revert option in Settings.

## Updates

Installed builds check public GitHub Releases after startup and every six hours, downloading newer stable versions in the background. Settings has Automatic updates, Check for updates and Restart to update. Installation waits for your explicit restart; Windows may request administrator approval. Release downloads must remain public for friends to update without credentials. No GitHub token is included in the app.

Versions through 0.5.0 need one manual installation of 0.5.1 to gain the updater.

## Soundboard

Import audio/video files or ZIP packs, including nested folders. Assign each sound a shortcut using a modifier plus a letter, number or function key. Shortcuts also work from the tray. Clips mix after cleanup; YappGG mute silences the combined output. Unsupported or damaged media is reported and skipped. MP3, MP4, WAV, FLAC, Ogg and WebM have been tested. No test clips are bundled.

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
