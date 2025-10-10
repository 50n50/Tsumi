<p align="center">
	<a href="https://github.com/RockinChaos/Shiru">
		<img src="./docs/assets/logo_filled.svg" width="400" alt="Shiru">
	</a>
</p>
<h4 align="center"><b>BitTorrent streaming software with no paws in the way—watch anime in real-time, no waiting for downloads!</b></h4>
<p align="center">
  <i>🐾 The ultimate torrent-based anime player — lightweight, powerful, and paws-itively fast 🐾</i>
</p>

<p align="center">
  <a href="https://github.com/RockinChaos/Shiru/wiki/">📚 Wiki</a> •
  <a href="https://github.com/RockinChaos/Shiru/wiki/features/">✨ Features</a> •
  <a href="https://github.com/RockinChaos/Shiru/wiki/faq/">❓ FAQ</a> •
  <a href="#-building--development">🔧 Building & Development</a> •
  <a href="https://github.com/RockinChaos/Shiru/releases/latest/">⬇️ Download</a>
</p>

https://github.com/user-attachments/assets/4fa7d60e-ae48-4fb9-9d20-f129f7f907a9

<p align="center">
  <a href="https://discord.gg/D5FnJ7C"><img src="https://img.shields.io/discord/291764091239006208?label=discord&color=5865F2&logo=discord&logoColor=white&style=flat-square" alt="Join Discord"></a>
  <a href="https://github.com/RockinChaos/Shiru/releases/latest/"><img alt="Downloads" src="https://img.shields.io/github/downloads/RockinChaos/Shiru/total?style=flat-square"></a>
  <a href="https://github.com/RockinChaos/Shiru/releases/latest/"><img alt="Latest Release" src="https://img.shields.io/github/v/release/RockinChaos/Shiru?style=flat-square"></a>
  <a href="https://github.com/RockinChaos/Shiru/commits"><img alt="Last Commit" src="https://img.shields.io/github/last-commit/RockinChaos/Shiru?style=flat-square"></a>
  <a href="https://github.com/RockinChaos/Shiru/stargazers"><img alt="Stargazers" src="https://img.shields.io/github/stars/RockinChaos/Shiru?style=flat-square"></a>
  <a href="https://github.com/RockinChaos/Shiru/blob/master/LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/github/license/RockinChaos/Shiru?style=flat-square"></a>
</p>

## 📃 **About**

**Shiru** is a fork of [Miru v5.5.10](https://github.com/ThaUnknown/miru/tree/c21139af1f830cf6a41dde4fa3469ff5d4195f7b) that enhances the anime streaming experience with a feature-rich environment and full mobile support. It blends the power of BitTorrent streaming with the convenience of traditional streaming platforms.

Shiru allows you to stream anime *in real-time* with no waiting for downloads, combining the advantages of high-speed torrents, great video quality, and fast releases — all without ads or tracking.

### ✨ Key Features:
- 🪄 **Anime integration with AniList & MyAnimeList**
- 💬 **Full subtitle support** with softcoded and external files
- ⏩ **Seamless video controls** and keyboard shortcuts
- 🌐 **Torrent streaming in real-time**

---

### 🎥 **Anime Features**:
- 🪄 **Full AniList & MyAnimeList Integration:**
    - Filter by name, genre, season, year, format, and status.
    - Manage your watching & planning lists easily.
    - Automatically mark episodes as completed after watching.
    - Watch trailers and previews.
    - Rate and score anime.
    - Explore related anime.

- 🌐 **Torrents**:
    - Auto-find torrents for episodes.
    - Recognize torrents by anime.
    - Support for custom RSS feeds and resolution settings.
    - Stream in real-time with no wait.
    - Selectable downloads' folder.
    - Support for custom [extensions](https://github.com/RockinChaos/Shiru/wiki/Extensions).
    - Support for most popular BEP's.
    - Custom download/upload speeds.

- 🔔 **Dub & Sub Notifications**:
    - Schedules and tracking for both dub and sub releases.
    - Instant notifications on new episodes!

---

### 🎬 **Video Playback Features**:
- 💬 **Full Subtitle Support**:
    - Softcoded and external subtitles (VTT, SSA, ASS, SUB, TXT).
    - Picture-in-Picture (PiP) mode for multitasking.

- 🎮 **Keybindings**:
    - **S**: Skip opening (seek forward 90s).
    - **R**: Seek backwards 90s.
    - **→**: seek forwards 2 seconds.
    - **←**: seek backwards 2 seconds.
    - **↑**: increase volume.
    - **↓**: decrease volume.
    - **M**: Mute volume.
    - **C**: Cycle through subtitle tracks.
    - **F**: toggle fullscreen.
    - **P**: toggle picture in picture.
    - **N/B**: Next/previous episode.
    - **O**: View anime details.
    - **V**: Toggle volume limit increase.
    - **[**: Increase playback speed.
    - **]**: Decrease playback speed.
    - **\\**: reset playback speed to 1.
    - **I**: Show video stats.
    - **`**: Open keybinds UI (edit keybinds by drag and dropping any key).

- 👏 **Other Features**:
    - Miniplayer and media session support.
    - Pausing when window focus is lost.
    - Autoplaying the next episode.
    - Switching between multiple audios.
    - Discord Rich Presence integration.
    - Preview thumbnails and autoplay next episodes.
    - Torrent download progress visible on the seek bar.

## ⚙️ **Installation**

### 🐧 **Linux Installation**:

#### Arch:
```bash
paru -S shiru
```

Or if you use yay:

```bash
yay -S shiru
```

#### Debian/Ubuntu:
1. 🔗 Download the `linux-Shiru-version.deb` from the [releases page](https://github.com/RockinChaos/Shiru/releases/latest).
2. 📦 Install using the package manager:

    ```bash
    apt install linux-Shiru-*.deb
    ```

---

### 🖥️ Windows Installation:
#### Option 1: 💨 Install via Winget
For Windows 10 **1809** or later, or Windows 11:
```bash
winget install shiru
```

#### Option 2: 🔄 Installer or Portable Version
1. 🔗 Download from the [releases page](https://github.com/RockinChaos/Shiru/releases/latest):
   - **Installer:** `win-Shiru-vx.x.x-installer.exe`
   - **Portable:** `win-Shiru-vx.x.x-portable.exe` *(No installation required, just run it)*

## 🔧 Building & Development

Credit to [Migu](https://github.com/NoCrypt/migu) for doing the legwork on this.

### 📋 Requirements:
- PNPM (or any package manager)
- NodeJS 22.14
- Docker (with WSL on Windows)
- ADB & Android Studio (SDK 34)
- Java 21 (JDK)

###  💻 Building for PC (Electron):
1. Navigate to the Electron directory:
   ```bash
   cd electron
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start development:
   ```bash
   pnpm start
   ```
4. Build for release:
   ```bash
   pnpm build
   ```

---

### 📱 Building for Android (Capacitor):
1. Navigate to the Capacitor directory:
   ```bash
   cd capacitor
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run the doctor to check for missing dependencies:
   ```bash
   pnpm exec cap doctor
   ```
4. (First time only) Build native code:
   - Windows:
     ```bash
     pnpm build:native-win
     ```
   - Linux:
     ```bash
     pnpm build:native
     ```
5. (Optional) Generate assets:
   ```bash
   pnpm build:assets
   ```
6. Open the Android project:
   ```bash
   pnpm exec cap open android
   ```
7. Connect your device with ADB and start development:
   ```bash
   pnpm dev:start
   ```
8. Build the app for release (APK will not be [signed](https://github.com/NoCrypt/sign-android)):
   ```bash
   pnpm build:app
   ```

## 📜 License

This project follows the [GPLv3 License](https://github.com/RockinChaos/Shiru/blob/master/LICENSE).
