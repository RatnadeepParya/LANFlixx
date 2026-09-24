# Contributing to LANFlixx 🍿

First off, thank you for considering contributing to LANFlixx! We welcome contributions from developers, designers, and enthusiasts of all experience levels.

---

## 🛠️ How Can You Contribute?

1. **Reporting Bugs**: Check the [GitHub Issues](https://github.com/RatnadeepParya/LANFlixx/issues) to make sure your bug hasn't already been reported. If not, open a new issue using our Bug Report template.
2. **Suggesting Enhancements**: Have an idea for a feature or UI improvement? Open a Feature Request issue.
3. **Submitting Pull Requests**:
   - Fork the repository.
   - Create a feature branch: `git checkout -b feature/my-cool-feature`.
   - Commit your changes: `git commit -m 'feat: add my cool feature'`.
   - Push to your branch: `git push origin feature/my-cool-feature`.
   - Submit a Pull Request targeting `main`.

---

## 💻 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RatnadeepParya/LANFlixx.git
   cd LANFlixx
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your environment**:
   Copy `.env.example` to `.env` and set your local folder path and port:
   ```env
   PORT=5000
   FILM_DIR=D:\film
   ```

4. **Start the local server**:
   ```bash
   npm start
   ```

5. **Test in Browser**:
   Open `http://localhost:5000` or `http://<your-hostname>.local:5000` on another device on your Wi-Fi.

---

## 📜 Coding Guidelines

- **Vanilla Modern JavaScript & CSS**: Keep frontend code fast, lightweight, and dependency-free.
- **Cross-Platform Compatibility**: Test that features work on Android Chrome, iOS Safari, desktop browsers, and Smart TV browsers.
- **Transcoding Efficiency**: Ensure any video/audio processing relies on zero-copy where possible (`-c:v copy`) and only falls back to fast transcoding (`libx264 ultrafast`) when containers or codecs are incompatible with native browser engines.
