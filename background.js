chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set extension to disabled by default on first install
    chrome.storage.sync.set({ isEnabled: false }, () => {
      chrome.action.setBadgeText({ text: "" });
    });
  }
});

// Handle fetch requests from content scripts to bypass CORS
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_REQUEST') {
    fetch(message.url, message.options || {})
      .then(response => response.text())
      .then(text => {
        try {
          // Try to parse as JSON
          sendResponse({ success: true, data: JSON.parse(text) });
        } catch {
          sendResponse({ success: true, data: text });
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});
