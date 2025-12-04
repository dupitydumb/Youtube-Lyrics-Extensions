document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggle-switch");
  const status = document.getElementById("status");
  const fontSizeSlider = document.getElementById("font-size-slider");
  const fontSizeValue = document.getElementById("font-size-value");
  const syncOffsetSlider = document.getElementById("sync-offset-slider");
  const syncOffsetValue = document.getElementById("sync-offset-value");
  const bgModeButtons = document.querySelectorAll(".bg-mode-btn");
  const gradientThemeSection = document.getElementById("gradient-theme-section");
  const gradientThemeSelect = document.getElementById("gradient-theme-select");
  const playbackModeButtons = document.querySelectorAll(".playback-mode-btn");

  // Load saved settings
  chrome.storage.sync.get([
    "isEnabled", 
    "fontSize", 
    "backgroundMode", 
    "gradientTheme", 
    "playbackMode", 
    "syncDelay"
  ], (data) => {
    const isEnabled = data.isEnabled === true;
    const fontSize = data.fontSize || 16;
    const backgroundMode = data.backgroundMode || 'album';
    const gradientTheme = data.gradientTheme || 'random';
    const playbackMode = data.playbackMode || 'synced';
    const syncDelay = data.syncDelay || 0;
    
    toggleSwitch.checked = isEnabled;
    updateStatus(isEnabled);
    
    fontSizeSlider.value = fontSize;
    fontSizeValue.textContent = fontSize + "px";
    
    syncOffsetSlider.value = syncDelay;
    syncOffsetValue.textContent = syncDelay + "ms";
    
    // Set active background mode
    bgModeButtons.forEach(btn => {
      if (btn.dataset.mode === backgroundMode) {
        btn.classList.add('active');
        if (backgroundMode === 'gradient') {
          gradientThemeSection.style.display = 'block';
        }
      } else {
        btn.classList.remove('active');
      }
    });
    
    gradientThemeSelect.value = gradientTheme;
    
    // Set active playback mode
    playbackModeButtons.forEach(btn => {
      if (btn.dataset.mode === playbackMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  });

  // Toggle switch listener
  toggleSwitch.addEventListener("change", () => {
    const isEnabled = toggleSwitch.checked;
    
    chrome.storage.sync.set({ isEnabled }, () => {
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

  // Background mode buttons
  bgModeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      
      bgModeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
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
  });

  // Gradient theme select
  gradientThemeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    
    chrome.storage.sync.set({ gradientTheme: theme }, () => {
      sendMessageToTabs({ type: "updateGradientTheme", gradientTheme: theme });
    });
  });

  // Playback mode buttons
  playbackModeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      
      playbackModeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      chrome.storage.sync.set({ playbackMode: mode }, () => {
        sendMessageToTabs({ type: "updatePlaybackMode", playbackMode: mode });
      });
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
