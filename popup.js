document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("toggle-switch");
  const settings = document.getElementById("settings");
  const backgroundColorInput = document.getElementById("background-color");
  const textColorInput = document.getElementById("text-color");

  // Load saved settings
  chrome.storage.sync.get(["isEnabled"], function (data) {
    if (data.isEnabled) {
      toggleSwitch.checked = true;
    } else {
      toggleSwitch.checked = false;
    }
  });

  // Toggle switch event listener
  toggleSwitch.addEventListener("change", function () {
    const isEnabled = toggleSwitch.checked;
    chrome.storage.sync.set({ isEnabled: isEnabled });
    if (isEnabled) {
      chrome.action.setBadgeText({ text: "ON" });
      //reload the page
    } else {
      chrome.action.setBadgeText({ text: "" });
      //reload the page
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.reload(tabs[0].id);
      });
    }
  });
});
