# YouTube Lyrics Extension 🎶

![Version](https://img.shields.io/badge/version-2.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![Chrome](https://img.shields.io/badge/chrome-extension-orange)

A Chrome extension that displays synchronized lyrics for YouTube videos with a beautiful, modern interface.

## 📸 Screenshots

<!-- Add screenshots here -->
![Screenshots 1](https://github.com/user-attachments/assets/49c36cd7-4bb7-4252-abb9-54c616d3c089)


![Fullscreen Mode](https://github.com/user-attachments/assets/21bfcfeb-a11f-45e7-a03f-66581e1980bc)
*Lyrics seamlessly integrated in fullscreen mode*

---



## ✨ Features

### 🎵 Lyrics Display
- **Modern UI** - Beautiful centered lyrics with smooth animations
- **Dynamic Font Scaling** - Current lyric is larger and highlighted
- **Auto-Sync** - Lyrics automatically synchronize with video playback
- **Interactive Seeking** - Click any lyric line to jump to that timestamp
- **Smart Scrolling** - Smooth auto-scroll keeps current lyric centered
- **Fullscreen Support** - Enjoy lyrics in YouTube's fullscreen mode with seamless integration

### 🎨 Visual Effects
- **Blur Background** - Semi-transparent backdrop with blur effect
- **Gradient Masking** - Smooth fade in/out on scroll areas
- **Opacity Animation** - Past lyrics (40% opacity), future lyrics (60% opacity)
- **Hover Effects** - Interactive elements respond to mouse hover

### ⚙️ Customization
- **Delay Adjustment** - Fine-tune lyric timing to match video
- **Color Themes** - Customize background and text colors
- **Plain/Synced Toggle** - Switch between plain text and synchronized lyrics
- **Multiple Search Results** - Select the correct lyrics from dropdown menu

### 🚀 Performance
- **Binary Search Algorithm** - Ultra-fast lyric matching (O(log n))
- **RequestAnimationFrame** - Smooth 60fps animations
- **Lyrics Caching** - API responses cached for instant reloads
- **Optimized Observer** - Minimal DOM monitoring overhead

## 📦 Installation

### Method 1: Install from Chrome Web Store (Coming Soon)
*Extension is currently in development and not yet published to the Chrome Web Store.*

### Method 2: Install in Developer Mode

#### Step 1: Download the Extension
1. Click the green **Code** button on this repository
2. Select **Download ZIP**
3. Extract the ZIP file to a folder on your computer

#### Step 2: Enable Developer Mode in Chrome
1. Open Google Chrome
2. Navigate to `chrome://extensions/` (or click menu → Extensions → Manage Extensions)
3. Toggle **Developer mode** ON in the top-right corner

#### Step 3: Load the Extension
1. Click the **Load unpacked** button
2. Navigate to the folder where you extracted the extension files
3. Select the folder and click **Select Folder**
4. The extension should now appear in your extensions list

#### Step 4: Pin the Extension (Optional)
1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Find "YouTube Lyrics" in the list
3. Click the pin icon to keep it visible in your toolbar

## 🎯 How to Use

1. **Open YouTube** - Navigate to any YouTube video
2. **Wait for Auto-Detection** - The extension automatically detects the song title and artist
3. **View Lyrics** - Lyrics will appear overlaid on the video player
4. **Interact**:
   - Click the **settings icon** (⚙️) to adjust timing delay
   - Click any **lyric line** to seek to that timestamp
   - Use the **dropdown menu** if multiple lyric results are available
   - Toggle between **plain text** and **synchronized** modes

## 🛠️ Technical Details

### Built With
- **Manifest V3** - Latest Chrome extension platform
- **Vanilla JavaScript** - No framework dependencies
- **LRCLib API** - Lyrics data source
- **CSS3 Animations** - Modern visual effects

### File Structure
```
├── manifest.json           # Extension configuration
├── background.js           # Service worker
├── content-v2.js          # Main content script
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── loader.js              # Loading utilities
├── modules/
│   ├── api.js             # API integration
│   ├── constants.js       # Configuration constants
│   ├── sync.js            # Lyric synchronization
│   └── ui.js              # UI components
└── images/                # Extension icons
```

### Permissions Required
- `activeTab` - Access current YouTube tab
- `storage` - Save user preferences
- `https://lrclib.net/*` - Fetch lyrics from API

## 🐛 Known Issues & Troubleshooting

**Lyrics not showing?**
- Ensure you're on a music video (not all videos have lyrics available)
- Check that the video title includes artist and song name
- Try manually searching using the dropdown menu

**Timing is off?**
- Use the settings icon (⚙️) to adjust the delay
- Different videos may have different timing offsets

**Extension not working?**
- Refresh the YouTube page
- Check that the extension is enabled in `chrome://extensions/`
- Try disabling other YouTube extensions temporarily

## 🔄 Updates & Changelog
- Added Fullscreen

## 📄 License

This project is open source and available for personal use.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 💬 Support

If you encounter any problems or have suggestions, please open an issue on GitHub.

---

**Enjoy your music with lyrics! 🎵**
