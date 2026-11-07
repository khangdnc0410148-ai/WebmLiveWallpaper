# WebmLiveWallpaper
# Video Background for Spotify

An extension for Spicetify that allows you to set custom video backgrounds (`.webm` format) for your Spotify client, creating a fully immersive and dynamic visual experience.

## ✨ Features
- **Custom WebM Support:** High-quality video backgrounds with minimal performance overhead.
- **Advanced Video Adjustments:** Seamlessly customize Opacity, Blur, and Brightness slider controls to ensure text readability.
- **Persistent Storage:** Uses IndexedDB to safely remember and restore your preferred video across Spotify restarts.
- **Smart UI Modifiers:** Toggle full-screen video mode by completely hiding the main UI elements with a single click.
- **Native UI Integration:** Adds sleek, minimal control buttons directly into Spotify's top navigation bar for quick access.

## 🚀 Installation

1. Download the `video-background.js` file from this repository.
2. Copy the file into your Spicetify Extensions directory:
   - **Windows:** `%appdata%\Spicetify\Extensions\`
   - **Linux/MacOS:** `~/.config/spicetify/Extensions/`
3. Run the following commands in your terminal/command prompt to apply:
   ```bash
   spicetify config extensions video-background.js
   spicetify apply
   ```

## 🛠️ Usage
- Click the **VIDEO BG** button in the top navigation bar to open the settings panel.
- Click **CHOOSE VIDEO** to select your custom `.webm` file.
- Use the sliders to adjust opacity, blur, and brightness to your liking.
- Click **HIDE GUI** to toggle full-screen immersion mode.
