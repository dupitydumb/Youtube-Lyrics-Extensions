/**
 * Content Script Loader
 * Loads modular code without ES6 imports (Chrome extension compatible)
 */

(function() {
  'use strict';

  // Make chrome API available globally for modules
  window.chrome = chrome;

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
