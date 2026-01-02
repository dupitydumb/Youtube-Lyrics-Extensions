/**
 * Content Script Loader
 * Loads modular code and provides a bridge for chrome.runtime access
 */

(function () {
  'use strict';

  // Create a message bridge for chrome.runtime access from page scripts
  // Page scripts can use window.postMessage to send requests, and we relay them to background
  window.addEventListener('message', async (event) => {
    // Only accept messages from the same window
    if (event.source !== window) return;

    // Handle fetch requests from page scripts
    if (event.data && event.data.type === 'MUSIXMATCH_FETCH_REQUEST') {
      const requestId = event.data.requestId;
      const url = event.data.url;

      try {
        // Forward to background script via chrome.runtime
        chrome.runtime.sendMessage(
          { type: 'FETCH_REQUEST', url: url },
          (response) => {
            // Send response back to page script
            window.postMessage({
              type: 'MUSIXMATCH_FETCH_RESPONSE',
              requestId: requestId,
              response: response,
              error: chrome.runtime.lastError ? chrome.runtime.lastError.message : null
            }, '*');
          }
        );
      } catch (error) {
        window.postMessage({
          type: 'MUSIXMATCH_FETCH_RESPONSE',
          requestId: requestId,
          response: null,
          error: error.message
        }, '*');
      }
    }
  });

  // Load modules in order
  const modules = [
    'modules/constants.js',
    'modules/events.js',
    'modules/settings.js',
    'modules/api.js',
    'modules/sync.js',
    'modules/ui.js',
    'modules/background.js',
    'modules/youtube.js',
    'modules/fullscreen.js',
    'modules/main.js'
  ];

  // Inject each module as a script tag
  modules.forEach((modulePath) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(modulePath);
    script.type = 'module';
    (document.head || document.documentElement).appendChild(script);
  });
})();
