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
    
    if (toggleSwitch) {
      toggleSwitch.checked = isEnabled;
    }
    updateStatus(isEnabled);

    if (fontSizeSlider) {
      fontSizeSlider.value = fontSize;
    }
    if (fontSizeValue) {
      fontSizeValue.textContent = fontSize + "px";
    }

    if (syncOffsetSlider) {
      syncOffsetSlider.value = syncDelay;
    }
    if (syncOffsetValue) {
      syncOffsetValue.textContent = syncDelay + "ms";
    }

    // Set background mode if control exists
    if (backgroundModeSelect) {
      backgroundModeSelect.value = backgroundMode;
      if (backgroundMode === 'gradient' && gradientThemeSection) {
        gradientThemeSection.style.display = 'block';
      }
    }

    if (gradientThemeSelect) {
      gradientThemeSelect.value = gradientTheme;
    }

    // Show custom colors if theme is custom
    if (gradientTheme === 'custom' && customColorsSection) {
      customColorsSection.style.display = 'block';
    }

    // Set custom color values if inputs exist
    if (customColors.length >= 4) {
      if (customColor1) customColor1.value = customColors[0];
      if (customColor2) customColor2.value = customColors[1];
      if (customColor3) customColor3.value = customColors[2];
      if (customColor4) customColor4.value = customColors[3];
    }

    // Set playback mode
    if (playbackModeSelect) playbackModeSelect.value = playbackMode;

    // Set highlight mode
    if (highlightModeSelect) highlightModeSelect.value = highlightMode;
  });

  // Toggle switch listener
  if (toggleSwitch) {
    toggleSwitch.addEventListener("change", () => {
      const isEnabled = toggleSwitch.checked;

      chrome.storage.sync.set({ enabled: isEnabled }, () => {
        updateStatus(isEnabled);
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: isEnabled ? "ON" : "" });
        }
        chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
          tabs.forEach(tab => chrome.tabs.reload(tab.id));
        });
      });
    });
  }

  // Font size slider listener
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener("input", (e) => {
      const fontSize = parseInt(e.target.value);
      if (fontSizeValue) fontSizeValue.textContent = fontSize + "px";

      chrome.storage.sync.set({ fontSize }, () => {
        sendMessageToTabs({ type: "updateFontSize", fontSize });
      });
    });
  }

  // Sync offset slider listener
  if (syncOffsetSlider) {
    syncOffsetSlider.addEventListener("input", (e) => {
      const syncDelay = parseInt(e.target.value);
      if (syncOffsetValue) syncOffsetValue.textContent = syncDelay + "ms";

      chrome.storage.sync.set({ syncDelay }, () => {
        sendMessageToTabs({ type: "updateSyncDelay", syncDelay });
      });
    });
  }

  // Background mode select
  if (backgroundModeSelect) {
    backgroundModeSelect.addEventListener("change", (e) => {
      const mode = e.target.value;

      // Show/hide gradient theme section
      if (gradientThemeSection) {
        if (mode === 'gradient') {
          gradientThemeSection.style.display = 'block';
        } else {
          gradientThemeSection.style.display = 'none';
        }
      }

      chrome.storage.sync.set({ backgroundMode: mode }, () => {
        sendMessageToTabs({ type: "updateBackgroundMode", backgroundMode: mode });
      });
    });
  }

  // Gradient theme select
  if (gradientThemeSelect) {
    gradientThemeSelect.addEventListener("change", (e) => {
      const theme = e.target.value;

      // Show/hide custom colors section
      if (customColorsSection) {
        if (theme === 'custom') {
          customColorsSection.style.display = 'block';
        } else {
          customColorsSection.style.display = 'none';
        }
      }

      chrome.storage.sync.set({ gradientTheme: theme }, () => {
        sendMessageToTabs({ type: "updateGradientTheme", gradientTheme: theme });
      });
    });
  }

  // Custom color inputs
  const updateCustomColors = () => {
    const customColors = [];
    if (customColor1) customColors.push(customColor1.value);
    if (customColor2) customColors.push(customColor2.value);
    if (customColor3) customColors.push(customColor3.value);
    if (customColor4) customColors.push(customColor4.value);

    if (customColors.length === 0) return;

    chrome.storage.sync.set({ customColors }, () => {
      sendMessageToTabs({ type: "updateCustomColors", customColors });
    });
  };

  if (customColor1) customColor1.addEventListener("change", updateCustomColors);
  if (customColor2) customColor2.addEventListener("change", updateCustomColors);
  if (customColor3) customColor3.addEventListener("change", updateCustomColors);
  if (customColor4) customColor4.addEventListener("change", updateCustomColors);

  // Playback mode select
  if (playbackModeSelect) {
    playbackModeSelect.addEventListener("change", (e) => {
      const mode = e.target.value;

      chrome.storage.sync.set({ playbackMode: mode }, () => {
        sendMessageToTabs({ type: "updatePlaybackMode", playbackMode: mode });
      });
    });
  }

  // Highlight mode select
  if (highlightModeSelect) {
    highlightModeSelect.addEventListener("change", (e) => {
      const mode = e.target.value;

      chrome.storage.sync.set({ highlightMode: mode }, () => {
        sendMessageToTabs({ type: "updateHighlightMode", highlightMode: mode });
      });
    });
  }

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

  // Populate version information from manifest and update title/footer
  try {
    const manifest = chrome.runtime.getManifest();
    const version = manifest && manifest.version ? manifest.version : '';
    const vf = document.getElementById('version-footer');
    if (vf) vf.textContent = version ? `v${version}` : '';
    const pv = document.getElementById('popup-version');
    if (pv) pv.textContent = version ? `Version ${version}` : '';
    if (version) document.title = `YouTube Lyrics — v${version}`;
  } catch (e) {
    // ignore errors getting manifest
  }
});
