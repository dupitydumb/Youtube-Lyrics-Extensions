chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set extension to disabled by default on first install
    chrome.storage.sync.set({ isEnabled: false }, () => {
      console.log("Extension installed - disabled by default");
      chrome.action.setBadgeText({ text: "" });
    });
  }
});
