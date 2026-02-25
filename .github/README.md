<div align="center">
  <img src="https://github.com/50n50/Tsumi/blob/master/electron/buildResources/header.png?raw=true" alt="Tsumi" width="100%">
</div>

#

A modern, feature-rich anime streaming application. **Tsumi** is an old fork of [Hayase](https://hayase.watch/) by ThaUnknown, modified to use **Sora extensions** for seamless anime discovery and playback.

> **Note:** This project is a community fork focused on extension-based streaming. It's not affiliated with the original Shiru project.

#

**For any issues or support please join the [Discord server!](https://discord.gg/tKNhqkDnW2)**

## Features

### 🎬 Streaming & Playback
- **Extension-based streaming** - Supports Sora extensions for flexible anime source management
- **Multi-server support** - Switch between different streaming servers without losing playback position
- **Advanced player** - Built-in video player with:
  - HLS/MP4 playback support
  - Subtitle support (SRT, VTT, ASS, SSA)
  - Keyboard shortcuts and playlist controls
  - Download speed monitoring
  - Auto-skip opening/ending detection

### 📚 Library Management
- **Anime information** - Integrated with AniList and MyAnimeList
- **Personal library** - Track your anime across multiple platforms
- **Episode tracking** - Automatic progress saving and resume playback
- **Smart search** - Find anime across all enabled extensions instantly

### 🎨 Customization
- **Dark theme** - Easy on the eyes for late-night anime sessions
- **Customizable UI** - Adjustable fonts, colors, and layout options
- **Multiple subtitle languages** - Choose your preferred subtitle language
- **External player support** - Use your favorite external video player if desired

### 🛠️ Advanced Features
- **Watch parties** (W2G) - Stream anime together with friends
- **Discord Rich Presence** - Show what you're watching to your friends
- **Cross-platform** - Windows, macOS, and Linux support
- **Offline progress** - Your anime history works offline and syncs when online

## Installation

### Windows

1. **Download** the latest installer from [Releases](https://github.com/50n50/Tsumi/releases)
2. **Run** `Tsumi-v*.*.*.exe` and follow the installation wizard
3. **Launch** Tsumi from your Start Menu or desktop shortcut

**Portable Version:**
- Download the `Tsumi-Windows-v*.*.*-portable.exe`
- No installation required, just run the executable

### macOS

1. **Download** the latest DMG from [Releases](https://github.com/50n50/Tsumi/releases)
2. **Mount** the DMG file and drag Tsumi to your Applications folder
3. **Launch** from Applications

> Note: On first launch, macOS may ask for permission. This is normal for unsigned apps.

### Linux

#### AppImage (Recommended)
1. **Download** `Linux-Tsumi-v*.*.*.AppImage` from [Releases](https://github.com/50n50/Tsumi/releases)
2. **Make executable:**
   ```bash
   chmod +x Linux-Tsumi-v*.*.*.AppImage
   ```
3. **Run:**
   ```bash
   ./Linux-Tsumi-v*.*.*.AppImage
   ```

#### Debian/Ubuntu (DEB)
1. **Download** `Linux-Tsumi-v*.*.*.deb` from [Releases](https://github.com/50n50/Tsumi/releases)
2. **Install:**
   ```bash
   sudo dpkg -i Linux-Tsumi-v*.*.*.deb
   ```
3. **Launch:** Open Tsumi from your application menu

## First Time Setup

### Adding Extensions

1. Open **Settings** → **Extensions**
2. Install Sora or compatible extensions
3. Enable the extensions you want to use
4. Set a default extension (recommended)

### Configuring Playback

1. Go to **Settings** → **Player**
2. Adjust playback preferences:
   - Set your preferred subtitle language
   - Configure external player (optional)
   - Adjust video quality settings

### Syncing with AniList/MAL

1. Open **Settings** → **Profiles**
2. Connect your AniList or MyAnimeList account
3. Your anime library will sync automatically

## Usage

### Finding Anime

1. Use the **Search** tab to find anime
2. Results from all enabled extensions appear instantly
3. Click a result to load episodes

### Watching Anime

1. Select an episode to start playback
2. If multiple servers available, choose your preferred one
3. Use keyboard shortcuts:
   - **Space** - Play/Pause
   - **F** - Fullscreen
   - **C** - Cycle subtitles
   - **M** - Mute
   - **← →** - Skip/Rewind
   - **↑ ↓** - Volume
   - **P** - Picture-in-picture

### Watch Parties

1. Go to **Settings** → **W2G**
2. Create a watch party session
3. Share the generated link with friends
4. Watch together in real-time

## Building from Source

### Requirements
- Node.js 18+
- pnpm (or npm)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/50n50/Tsumi.git
cd Tsumi

# Install dependencies
pnpm install

# Development mode
pnpm run dev

# Build for production
cd electron
pnpm run build
```

## Troubleshooting

### "No stream available" error
- Check that you have at least one extension enabled
- Try a different extension or server
- Some extensions may not have all anime

### Subtitles not showing
- Verify subtitle format is supported (SRT, VTT, ASS, SSA)
- Check subtitle language matches available tracks
- Try "Add Subtitles" to manually load a file

### Playback issues on Linux
- Install FFMPEG: `sudo apt install ffmpeg`
- Some distributions may need additional codecs

### Performance issues
- Close unnecessary browser tabs
- Lower video quality settings
- Update GPU drivers

## Project Structure

- `common/` - Shared UI components and utilities
- `electron/` - Desktop app (Windows, macOS, Linux)
- `capacitor/` - Mobile app framework (Android)
- `extensions/` - Example extensions and extension system
- `client/` - Client library for torrenting (legacy)

## Contributing

Contributions are welcome! This is a community project. Whether it's bug fixes, features, or translations:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

GPL-3.0-or-later - See [LICENSE](LICENSE) file for details

## Credits

- **Original Project:** [Shiru](https://github.com/RockinChaos/Shiru) by RockinChaos
- **This Fork:** Modified to use Sora extensions and community improvements

## Disclaimer

The developer(s) of this application does not have any affiliation with the content providers available, and this application hosts zero content.

## Support

- **Issues:** [GitHub Issues](https://github.com/50n50/Tsumi/issues)
- **Discussions:** [GitHub Discussions](https://github.com/50n50/Tsumi/discussions)
- **Discord:** Join our community (link in repo)


