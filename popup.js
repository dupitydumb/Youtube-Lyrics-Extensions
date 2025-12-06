document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggle-switch");
  const status = document.getElementById("status");
  const fontSizeSlider = document.getElementById("font-size-slider");
  const fontSizeValue = document.getElementById("font-size-value");
  const syncOffsetSlider = document.getElementById("sync-offset-slider");
  const syncOffsetValue = document.getElementById("sync-offset-value");
  const backgroundModeSelect = document.getElementById("background-mode-select");
  const gradientThemeSection = document.getElementById("gradient-theme-section");
  const gradientThemeSelect = document.getElementById("gradient-theme-select");
  const customColorsSection = document.getElementById("custom-colors-section");
  const customColor1 = document.getElementById("custom-color-1");
  const customColor2 = document.getElementById("custom-color-2");
  const customColor3 = document.getElementById("custom-color-3");
  const customColor4 = document.getElementById("custom-color-4");
  const playbackModeSelect = document.getElementById("playback-mode-select");
  const highlightModeSelect = document.getElementById("highlight-mode-select");

  // Load saved settings
  chrome.storage.sync.get([
    "enabled", 
    "fontSize", 
    "backgroundMode", 
    "gradientTheme", 
    "playbackMode", 
    "syncDelay",
    "customColors",
    "highlightMode"
  ], (data) => {
    const isEnabled = data.enabled !== false;
    const fontSize = data.fontSize || 16;
    const backgroundMode = data.backgroundMode || 'album';
    const gradientTheme = data.gradientTheme || 'random';
    const playbackMode = data.playbackMode || 'synced';
    const syncDelay = data.syncDelay || 0;
    const customColors = data.customColors || ['#667eea', '#764ba2', '#f093fb', '#4facfe'];
    const highlightMode = data.highlightMode || 'line';
    
    toggleSwitch.checked = isEnabled;
    updateStatus(isEnabled);
    
    fontSizeSlider.value = fontSize;
    fontSizeValue.textContent = fontSize + "px";
    
    syncOffsetSlider.value = syncDelay;
    syncOffsetValue.textContent = syncDelay + "ms";
    
    // Set background mode
    backgroundModeSelect.value = backgroundMode;
    if (backgroundMode === 'gradient') {
      gradientThemeSection.style.display = 'block';
    }
    
    gradientThemeSelect.value = gradientTheme;
    
    // Show custom colors if theme is custom
    if (gradientTheme === 'custom') {
      customColorsSection.style.display = 'block';
    }
    
    // Set custom color values
    if (customColors.length >= 4) {
      customColor1.value = customColors[0];
      customColor2.value = customColors[1];
      customColor3.value = customColors[2];
      customColor4.value = customColors[3];
    }
    
    // Set playback mode
    playbackModeSelect.value = playbackMode;

    // Set highlight mode
    highlightModeSelect.value = highlightMode;
  });

  // Toggle switch listener
  toggleSwitch.addEventListener("change", () => {
    const isEnabled = toggleSwitch.checked;
    
    chrome.storage.sync.set({ enabled: isEnabled }, () => {
      updateStatus(isEnabled);
      chrome.action.setBadgeText({ text: isEnabled ? "ON" : "" });
      chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
      });
    });
  });

  // Font size slider listener
  fontSizeSlider.addEventListener("input", (e) => {
    const fontSize = parseInt(e.target.value);
    fontSizeValue.textContent = fontSize + "px";
    
    chrome.storage.sync.set({ fontSize }, () => {
      sendMessageToTabs({ type: "updateFontSize", fontSize });
    });
  });

  // Sync offset slider listener
  syncOffsetSlider.addEventListener("input", (e) => {
    const syncDelay = parseInt(e.target.value);
    syncOffsetValue.textContent = syncDelay + "ms";
    
    chrome.storage.sync.set({ syncDelay }, () => {
      sendMessageToTabs({ type: "updateSyncDelay", syncDelay });
    });
  });

  // Background mode select
  backgroundModeSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    
    // Show/hide gradient theme section
    if (mode === 'gradient') {
      gradientThemeSection.style.display = 'block';
    } else {
      gradientThemeSection.style.display = 'none';
    }
    
    chrome.storage.sync.set({ backgroundMode: mode }, () => {
      sendMessageToTabs({ type: "updateBackgroundMode", backgroundMode: mode });
    });
  });

  // Gradient theme select
  gradientThemeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    
    // Show/hide custom colors section
    if (theme === 'custom') {
      customColorsSection.style.display = 'block';
    } else {
      customColorsSection.style.display = 'none';
    }
    
    chrome.storage.sync.set({ gradientTheme: theme }, () => {
      sendMessageToTabs({ type: "updateGradientTheme", gradientTheme: theme });
    });
  });

  // Custom color inputs
  const updateCustomColors = () => {
    const customColors = [
      customColor1.value,
      customColor2.value,
      customColor3.value,
      customColor4.value
    ];
    
    chrome.storage.sync.set({ customColors }, () => {
      sendMessageToTabs({ type: "updateCustomColors", customColors });
    });
  };

  customColor1.addEventListener("change", updateCustomColors);
  customColor2.addEventListener("change", updateCustomColors);
  customColor3.addEventListener("change", updateCustomColors);
  customColor4.addEventListener("change", updateCustomColors);

  // Playback mode select
  playbackModeSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    
    chrome.storage.sync.set({ playbackMode: mode }, () => {
      sendMessageToTabs({ type: "updatePlaybackMode", playbackMode: mode });
    });
  });

  // Highlight mode select
  highlightModeSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    
    chrome.storage.sync.set({ highlightMode: mode }, () => {
      sendMessageToTabs({ type: "updateHighlightMode", highlightMode: mode });
    });
  });

  function updateStatus(isEnabled) {
    status.textContent = isEnabled ? "ON" : "OFF";
    status.className = isEnabled ? "status active" : "status inactive";
  }

  function sendMessageToTabs(message) {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors if content script not loaded
        });
      });
    });
  }
});
