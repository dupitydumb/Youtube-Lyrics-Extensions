document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggle-switch");
  const status = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(["isEnabled"], (data) => {
    const isEnabled = data.isEnabled !== false; // Default to true
    toggleSwitch.checked = isEnabled;
    updateStatus(isEnabled);
  });

  // Toggle switch listener
  toggleSwitch.addEventListener("change", () => {
    const isEnabled = toggleSwitch.checked;
    
    chrome.storage.sync.set({ isEnabled }, () => {
      updateStatus(isEnabled);
      
      // Update extension badge
      chrome.action.setBadgeText({ text: isEnabled ? "ON" : "" });
      
      // Reload YouTube tabs
      chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
      });
    });
  });

  function updateStatus(isEnabled) {
    status.textContent = isEnabled ? "ON" : "OFF";
    status.className = isEnabled ? "status active" : "status inactive";
  }
});
