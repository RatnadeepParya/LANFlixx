<div align="center">

# 🍿 LANFlixx

### *Your Self-Hosted Home Cinema Streaming Server for LAN & Wi-Fi*

Stream your personal film and series library from your PC to **any smartphone, tablet, Smart TV, or laptop** on your home Wi-Fi — with zero complex setups, instant on-the-fly remuxing, and permanent `.local` hostname resolution.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg?style=flat-square)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Bundled%20Static-orange.svg?style=flat-square)](https://ffmpeg.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg?style=flat-square)]()
[![Mobile](https://img.shields.io/badge/Mobile-iOS%20Safari%20%7C%20Android%20Chrome-purple.svg?style=flat-square)]()

</div>

---

## 🌟 Why LANFlixx?

Most home media servers (like Plex or Jellyfin) require complex account setups, heavy CPU databases, or manual port forwarding. Traditional file shares (SMB) don't play inside mobile web browsers.

**LANFlixx** solves this with a lightweight, zero-configuration local streaming server designed specifically for high-speed local streaming:

- ⚡ **Universal Browser Playback**: Automatically remuxes MKVs, disguised containers, 10-bit HEVC, and AC3/DTS Dolby audio into fragmented MP4 with stereo AAC on the fly. 100% of files play directly in mobile Safari & Chrome!
- 🌐 **Permanent Idempotent Hostname (mDNS)**: Access via `http://<your-pc-name>.local:5000` (e.g. `http://desktop007.local:5000`). Never breaks when your Wi-Fi router assigns a new dynamic DHCP IP!
- 📱 **Mobile-First Cinema Experience**: Sleek, responsive touch UI with bottom tab navigation, 2-column mobile grid, large tap targets, and safe area support for modern iPhone and Android notch displays.
- 🎛️ **Full-Screen Touch Controls**: Netflix-style player overlay with big `⏪ 10s`, `▶ / ⏸`, and `⏩ 10s` buttons, plus an interactive touch scrubber for smooth seeking across both Universal and Direct modes.
- 🧡 **1-Tap VLC Deep Linking**: Immediate hardware-accelerated playback in external players (VLC for Android via `intent://`, iOS via `vlc-x-callback://`).
- 💬 **Live Subtitle Engine**: Automatically detects companion `.srt` files and converts them to WebVTT on the fly, and dynamically extracts internal MKV subtitle tracks.
- 📦 **Zero External Tools Required**: Comes bundled with static `@ffmpeg-installer/ffmpeg` binaries — you don't even need to install FFmpeg on your operating system!

---

## 📸 Overview & Features

```
                         LANFlixx Architecture
                         
    +-------------------------------------------------------------+
    |                     HOST PC (Windows/Linux/Mac)              |
    |                                                             |
    |   📁 D:\film  --->  Express + Bundled Static FFmpeg         |
    |                           |                                 |
    |     • H.264 Videos  ----->  Zero-Copy Remux (-c:v copy)     |
    |     • HEVC / 10-bit ----->  Ultrafast Stream Transcode      |
    |     • AC3/DTS Audio ----->  Stereo AAC Live Stream          |
    |     • mDNS Broadcaster -->  http://<hostname>.local:5000     |
    +---------------------------+---------------------------------+
                                |
             +------------------+------------------+
             |                                     |
    📱 Mobile (iOS/Android)              📺 Smart TV / Fire TV
    • Browser HTML5 Cinema Player        • Built-in Silk/Chrome Browser
    • Touch Seeker & Controls            • Or Paste Link in VLC for TV
    • 1-Tap VLC Integration              • Idempotent .local Resolution
```

---

## 🚀 Quick Start Guide

### 1. Clone & Install

```bash
git clone https://github.com/RatnadeepParya/LANFlixx.git
cd LANFlixx
npm install
```

### 2. Configure Environment (`.env`)

Create or edit the `.env` file in the root directory:

```env
# Port on which LANFlixx server will run
PORT=5000

# Absolute path to your movies/series directory
FILM_DIR=D:\film
```

*(You can also copy from `.env.example`: `cp .env.example .env`)*

### 3. Launch Server

**On Windows:**
Double-click `start-stream.bat` or run:
```bash
npm start
```

**On Linux / macOS:**
```bash
npm start
```

Your terminal will display a startup banner with your permanent `.local` URL and a scannable QR code!

---

## 📱 How to Connect Other Devices

### 📱 Android, iPhone & iPad
1. Connect your phone to the **same Wi-Fi network**.
2. Scan the QR code shown in your terminal or open:
   ```
   http://<your-computer-name>.local:5000
   ```
   *(e.g., `http://desktop007.local:5000`)*
3. Tap on any film to start streaming instantly!

### 📺 Smart TV / Fire TV / Apple TV
- Open your TV's browser (e.g. Silk, Chrome) and type your PC's IP or `.local` URL.
- Or open **VLC on your TV**, select *Open Network Stream*, and paste any movie stream link.

### 💻 Other Laptops & PCs
Open Chrome, Edge, Safari, or Firefox and navigate to `http://<your-computer-name>.local:5000`.

---

## ⚙️ Configuration Reference

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | The network port on which the HTTP server listens. |
| `FILM_DIR` | `D:\film` | The directory containing your video files and series folders. |

---

## 🛡️ Firewall & Network Setup (Windows)

If other devices on your Wi-Fi cannot connect initially:

1. **Allow Port 5000 in Windows Firewall**:
   Run `allow-firewall.bat` as Administrator, or execute in PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName "LANFlixx Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
   ```
2. **Make sure your Wi-Fi profile is set to Private**:
   *Settings > Network & Internet > Wi-Fi > Network profile type > Private*.

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
Please check out [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Created with 🍿 by [Ratnadeep Parya](https://github.com/RatnadeepParya).
