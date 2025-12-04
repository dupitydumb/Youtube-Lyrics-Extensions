/**
 * YouTube Lyrics Extension v2.0 - Refactored with Apple Music Style UI
 * All-in-one file compatible with Chrome extensions (no ES6 imports)
 */

(function() {
  'use strict';

  // ==================== INJECT EXTERNAL CSS ====================
  
  function injectCSS() {
    if (document.getElementById('lyrics-external-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'lyrics-external-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles/content.css');
    document.head.appendChild(link);
  }
  
  injectCSS();

  // ==================== CONSTANTS ====================
  
  const CONSTANTS = {
    API: {
      BASE_URL: 'https://lrclib.net/api',
      SEARCH_ENDPOINT: '/search',
      TIMEOUT: 10000,
      RETRY_ATTEMPTS: 2,
      RETRY_DELAY: 1000
    },
    
    SELECTORS: {
      SECONDARY_INNER: '#secondary-inner',
      VIDEO_TITLE: '#title > h1 > yt-formatted-string',
      ARTIST_NAME: '#text > a',
      VIDEO_PLAYER: 'video'
    },
    
    UI: {
      PANEL_ID: 'Lyric-Panel',
      PANEL_CONTAINER_ID: 'Lyric-Panel-Container',
      SYNC_DELAY_DEFAULT: 0,
      
      // Responsive Typography Scale (rem-based)
      TYPOGRAPHY: {
        // Fluid font sizes using clamp()
        SIZES: {
          XSMALL: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
          SMALL: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
          BASE: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
          MEDIUM: 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',
          LARGE: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
          XLARGE: 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',
          CURRENT: 'clamp(1.75rem, 1.5rem + 1.25vw, 2.25rem)'
        },
        WEIGHTS: {
          LIGHT: '300',
          REGULAR: '400',
          MEDIUM: '500',
          SEMIBOLD: '600',
          BOLD: '700'
        },
        LINE_HEIGHTS: {
          TIGHT: '1.3',
          NORMAL: '1.5',
          RELAXED: '1.7',
          LOOSE: '2'
        },
        LETTER_SPACING: {
          TIGHT: '-0.02em',
          NORMAL: '0',
          WIDE: '0.01em',
          WIDER: '0.02em'
        }
      },
      
      // Dynamic Spacing System
      SPACING: {
        XXS: 'clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem)',
        XS: 'clamp(0.5rem, 0.45rem + 0.25vw, 0.625rem)',
        SM: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        MD: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
        LG: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        XL: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
        XXL: 'clamp(2rem, 1.75rem + 1.25vw, 2.5rem)'
      },
      
      // Apple Music Design System
      APPLE_MUSIC: {
        BACKGROUND: 'rgba(0, 0, 0, 0.85)',
        BACKDROP_BLUR: 'clamp(20px, 5vw, 40px)',
        CURRENT_SCALE: 1.15,
        PAST_OPACITY: 0.35,
        FUTURE_OPACITY: 0.55,
        TRANSITIONS: {
          FAST: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          NORMAL: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          SLOW: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          ELASTIC: '0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        },
        STAGGER_DELAY: 0.03,
        MAX_HEIGHT: 'clamp(400px, 60vh, 700px)',
        MAX_WIDTH: 'clamp(600px, 80vw, 900px)',
        RADIUS: {
          SM: 'clamp(0.375rem, 0.35rem + 0.125vw, 0.5rem)',
          MD: 'clamp(0.5rem, 0.45rem + 0.25vw, 0.75rem)',
          LG: 'clamp(0.75rem, 0.7rem + 0.25vw, 1rem)'
        }
      }
    },
    
    FILTER_WORDS: {
      BASIC: ['official', 'video', 'lyric', 'lyrics', 'music', 'audio', 'mv', 'M/V', 
              '(Official Video)', '(Official Music Video)', '[Official Video]'],
      EXTENDED: ['MV', 'M/V', 'Official', 'Video', 'Lyric', 'Music', 'Audio', 
                 'Live', 'clip', 'HD', '4K']
    },
    
    KOREAN_RANGE: { START: 44032, END: 55203 },
    
    MESSAGES: {
      NO_LYRICS: "I'm sorry, I cannot find the lyrics for this song.",
      API_ERROR: "Failed to fetch lyrics. Please try again later.",
      LOADING: "Loading lyrics..."
    }
  };

  // ==================== STATE ====================
  
  const state = {
    isEnabled: false,
    hasRun: false,
    currentTitle: '',
    currentData: null,
    syncedLyrics: [],
    titleObserver: null,
    sync: {
      currentIndex: -1,
      lastKnownIndex: 0,
      delay: 0,
      isPlaying: false,
      videoElement: null,
      animationFrameId: null,
      handlePlay: null,
      handlePause: null
    },
    ui: {
      panel: null,
      container: null,
      lyricsContainer: null,
      controlsContainer: null
    },
    cache: new Map()
  };

  // ==================== UTILITY FUNCTIONS ====================
  
  function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Pre-compute Korean characters for performance
  const KOREAN_CHARS = new Set(
    Array.from({ length: CONSTANTS.KOREAN_RANGE.END - CONSTANTS.KOREAN_RANGE.START + 1 }, 
      (_, i) => String.fromCharCode(CONSTANTS.KOREAN_RANGE.START + i))
  );
  const NOT_ALLOWED = new Set([...CONSTANTS.FILTER_WORDS.BASIC, ...KOREAN_CHARS]);

  function formatTitle(title) {
    if (!title) return '';
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => !NOT_ALLOWED.has(word))
      .join(' ');
    
    if (formatted.includes('|') && formatted.includes('-')) {
      formatted = formatted.split('|')[0];
    }
    
    return formatted.trim();
  }

  function formatSongOnly(title) {
    if (!title) return '';
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => 
        !CONSTANTS.FILTER_WORDS.EXTENDED.map(w => w.toLowerCase()).includes(word) && 
        !/[\uAC00-\uD7AF]/.test(word)
      )
      .join(' ');
    
    formatted = formatted.split('|')[0];
    formatted = formatted.replace(/\[.*?\]/g, '');
    formatted = formatted.replace(/\(.*?\)/g, '');
    formatted = formatted.replace(/''/g, '').replace(/"/g, '');
    
    return formatted.trim();
  }

  // ==================== API FUNCTIONS ====================
  
  async function searchLyrics(query) {
    // Check cache
    if (state.cache.has(query)) {
      console.log('Lyrics found in cache');
      return state.cache.get(query);
    }
    
    const url = `${CONSTANTS.API.BASE_URL}${CONSTANTS.API.SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      state.cache.set(query, data);
      return data;
      
    } catch (error) {
      console.error('API error:', error);
      throw new Error(CONSTANTS.MESSAGES.API_ERROR);
    }
  }

  function findBestMatch(results, artistName = '') {
    if (!results || results.length === 0) return null;
    if (!artistName) return results[0];
    
    const exactMatch = results.find(r => 
      r.artistName && r.artistName.toLowerCase() === artistName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    const partialMatch = results.find(r => 
      r.artistName && r.artistName.toLowerCase().includes(artistName.toLowerCase())
    );
    
    return partialMatch || results[0];
  }

  function parseSyncedLyrics(lrcString) {
    if (!lrcString) return [];
    
    try {
      const lines = lrcString.split('\n');
      const synced = [];
      
      for (const line of lines) {
        const match = line.match(/\[(\d+):(\d+)\.?(\d+)?\]\s*(.+)/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const centiseconds = match[3] ? parseInt(match[3]) : 0;
          const text = match[4].trim();
          
          if (text) {
            synced.push({
              time: minutes * 60 + seconds + centiseconds / 100,
              text: text
            });
          }
        }
      }
      
      return synced.sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error('Parse error:', error);
      return [];
    }
  }

  // ==================== SYNC FUNCTIONS ====================
  
  function findCurrentLyric(currentTime) {
    if (!state.syncedLyrics || state.syncedLyrics.length === 0) return null;
    
    const adjustedTime = currentTime + (state.sync.delay / 1000);
    const lyrics = state.syncedLyrics;
    
    // Binary search
    let left = 0;
    let right = lyrics.length - 1;
    let result = null;
    let resultIndex = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const lyric = lyrics[mid];
      
      if (lyric.time <= adjustedTime) {
        result = lyric;
        resultIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (result) {
      state.sync.lastKnownIndex = resultIndex;
      return { lyric: result, index: resultIndex };
    }
    
    return null;
  }

  function syncLoop() {
    if (!state.sync.isPlaying || !state.sync.videoElement) {
      state.sync.animationFrameId = null;
      return;
    }
    
    const currentTime = state.sync.videoElement.currentTime;
    const result = findCurrentLyric(currentTime);
    
    if (result && result.index !== state.sync.currentIndex) {
      state.sync.currentIndex = result.index;
      updateCurrentLyric(result.index);
    }
    
    state.sync.animationFrameId = requestAnimationFrame(syncLoop);
  }

  function startSync() {
    if (!state.sync.videoElement || !state.syncedLyrics.length) {
      console.error('Cannot start sync');
      return;
    }
    
    state.sync.isPlaying = true;
    syncLoop();
  }

  function stopSync() {
    state.sync.isPlaying = false;
    if (state.sync.animationFrameId) {
      cancelAnimationFrame(state.sync.animationFrameId);
      state.sync.animationFrameId = null;
    }
  }

  function seekToLyric(index) {
    if (index >= 0 && index < state.syncedLyrics.length && state.sync.videoElement) {
      state.sync.videoElement.currentTime = state.syncedLyrics[index].time - (state.sync.delay / 1000);
      state.sync.currentIndex = index;
    }
  }

  // ==================== UI FUNCTIONS ====================
  
  function createPanel(parentElement) {
    removePanel();
    
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    const spacing = CONSTANTS.UI.SPACING;
    
    // Container - all styles in external CSS
    state.ui.container = document.createElement('div');
    state.ui.container.id = CONSTANTS.UI.PANEL_CONTAINER_ID;
    
    // Panel
    state.ui.panel = document.createElement('div');
    state.ui.panel.id = CONSTANTS.UI.PANEL_ID;
    
    // Header
    const header = createHeader();
    state.ui.panel.appendChild(header);
    
    // Lyrics container
    state.ui.lyricsContainer = document.createElement('div');
    state.ui.lyricsContainer.id = 'lyrics-display';
    state.ui.panel.appendChild(state.ui.lyricsContainer);
    
    // Controls
    state.ui.controlsContainer = document.createElement('div');
    state.ui.controlsContainer.id = 'lyrics-controls';
    state.ui.panel.appendChild(state.ui.controlsContainer);
    
    state.ui.container.appendChild(state.ui.panel);
    parentElement.insertBefore(state.ui.container, parentElement.firstChild);
  }

  function createHeader() {
    const header = document.createElement('div');
    
    const titleContainer = document.createElement('div');
    titleContainer.id = 'lyrics-title';
    
    const title = document.createElement('h3');
    title.id = 'song-title';
    title.textContent = 'Lyrics';
    
    const artist = document.createElement('p');
    artist.id = 'song-artist';
    artist.textContent = '';
    artist.style.display = 'none';
    
    titleContainer.appendChild(title);
    titleContainer.appendChild(artist);
    header.appendChild(titleContainer);
    
    return header;
  }

  function updateTitle(title, artist = '') {
    const titleEl = document.getElementById('song-title');
    const artistEl = document.getElementById('song-artist');
    
    if (titleEl) titleEl.textContent = title || 'Lyrics';
    if (artistEl) {
      artistEl.textContent = artist;
      artistEl.style.display = artist ? 'block' : 'none';
    }
  }

  function showLoading() {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'lyrics-loading';
    loading.textContent = CONSTANTS.MESSAGES.LOADING;
    state.ui.lyricsContainer.appendChild(loading);
  }

  function showError(message) {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'lyrics-error';
    error.textContent = message;
    state.ui.lyricsContainer.appendChild(error);
  }

  function displayPlainLyrics(lyrics) {
    if (!state.ui.lyricsContainer) return;
    
    stopSync();
    state.ui.lyricsContainer.innerHTML = '';
    
    const text = document.createElement('div');
    text.className = 'lyrics-plain';
    text.textContent = lyrics;
    state.ui.lyricsContainer.appendChild(text);
  }

  function displaySyncedLyrics(syncedLyrics) {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    
    syncedLyrics.forEach((lyric, index) => {
      const line = document.createElement('div');
      line.className = 'lyric-line';
      line.dataset.index = index;
      line.textContent = lyric.text;
      line.style.display = 'none'; // Initially hide all lines
      
      line.addEventListener('click', () => seekToLyric(index));
      
      state.ui.lyricsContainer.appendChild(line);
    });
  }

  function updateCurrentLyric(currentIndex) {
    if (!state.ui.lyricsContainer) return;
    
    const lines = state.ui.lyricsContainer.querySelectorAll('.lyric-line');
    
    lines.forEach((line, index) => {
      const isCurrent = index === currentIndex;
      const isPrevious = index === currentIndex - 1;
      const isNext = index === currentIndex + 1;
      
      // Remove all state classes first
      line.classList.remove('current', 'past', 'future');
      
      // Show only current, previous, and next lines
      if (isCurrent || isPrevious || isNext) {
        line.style.display = 'block';
        
        if (isCurrent) {
          line.classList.add('current');
        } else if (isPrevious) {
          line.classList.add('past');
        } else if (isNext) {
          line.classList.add('future');
        }
      } else {
        // Hide all other lines
        line.style.display = 'none';
      }
    });
  }

  function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'lyrics-button';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createSelect(id, options, onChange) {
    const select = document.createElement('select');
    select.className = 'lyrics-select';
    select.id = id;
    select.addEventListener('change', onChange);
    
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    
    return select;
  }

  function addControl(element) {
    if (state.ui.controlsContainer) {
      state.ui.controlsContainer.appendChild(element);
    }
  }

  function removePanel() {
    if (state.ui.container) {
      state.ui.container.remove();
      state.ui.container = null;
      state.ui.panel = null;
      state.ui.lyricsContainer = null;
      state.ui.controlsContainer = null;
    }
  }

  // ==================== CONTROL CREATORS ====================
  
  function createSongSelector(results, currentSelection) {
    const options = results.map((r, i) => ({
      value: i,
      label: `${r.trackName} - ${r.artistName}`
    }));
    
    const currentIndex = results.indexOf(currentSelection);
    const select = createSelect('song-selector', options, (e) => {
      const data = results[e.target.value];
      state.currentData = data;
      updateTitle(data.trackName, data.artistName);
      displayLyrics(data);
    });
    
    select.value = currentIndex;
    
    const label = document.createElement('label');
    label.textContent = 'Select song: ';
    label.style.color = 'rgba(255, 255, 255, 0.8)';
    label.appendChild(select);
    
    addControl(label);
  }

  function createModeToggle(hasSynced) {
    const existing = document.getElementById('lyrics-mode-toggle');
    if (existing) existing.remove();
    if (!hasSynced) return;
    
    const options = [
      { value: 'synced', label: '🎵 Synced' },
      { value: 'plain', label: '📄 Plain' }
    ];
    
    const select = createSelect('lyrics-mode-toggle', options, (e) => {
      if (e.target.value === 'synced') {
        const synced = parseSyncedLyrics(state.currentData.syncedLyrics);
        initSyncedLyrics(synced);
      } else {
        stopSync();
        displayPlainLyrics(state.currentData.plainLyrics);
      }
    });
    
    select.value = 'synced';
    
    const label = document.createElement('label');
    label.textContent = 'Mode: ';
    label.style.color = 'rgba(255, 255, 255, 0.8)';
    label.appendChild(select);
    
    addControl(label);
  }

  function createDelayControl() {
    const existing = document.getElementById('delay-control');
    if (existing) existing.remove();
    
    const container = document.createElement('div');
    container.id = 'delay-control';
    
    const label = document.createElement('span');
    label.textContent = 'Delay: ';
    
    const display = document.createElement('span');
    display.id = 'delay-display';
    display.textContent = '0ms';
    
    function updateDisplay() {
      display.textContent = `${state.sync.delay}ms`;
    }
    
    const decreaseBtn = createButton('-100ms', () => {
      state.sync.delay -= 100;
      updateDisplay();
    });
    
    const increaseBtn = createButton('+100ms', () => {
      state.sync.delay += 100;
      updateDisplay();
    });
    
    const resetBtn = createButton('Reset', () => {
      state.sync.delay = 0;
      updateDisplay();
    });
    
    container.appendChild(label);
    container.appendChild(decreaseBtn);
    container.appendChild(display);
    container.appendChild(increaseBtn);
    container.appendChild(resetBtn);
    
    addControl(container);
  }

  // ==================== MAIN LOGIC ====================
  
  function extractVideoInfo() {
    const titleEl = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
    const artistEl = document.querySelector(CONSTANTS.SELECTORS.ARTIST_NAME);
    
    if (!titleEl) return null;
    
    const title = titleEl.textContent.trim();
    const artist = artistEl ? artistEl.textContent.trim() : '';
    
    return {
      rawTitle: title,
      artist: artist,
      formattedTitle: formatTitle(title + (artist ? ' ' + artist : ''))
    };
  }

  async function fetchAndDisplayLyrics(videoInfo) {
    if (!videoInfo) return;
    
    try {
      showLoading();
      
      let results = await searchLyrics(videoInfo.formattedTitle);
      
      if (!results || results.length === 0) {
        const songOnly = formatSongOnly(videoInfo.rawTitle);
        results = await searchLyrics(songOnly);
      }
      
      if (!results || results.length === 0) {
        showError(CONSTANTS.MESSAGES.NO_LYRICS);
        return;
      }
      
      const bestMatch = findBestMatch(results, videoInfo.artist);
      state.currentData = bestMatch;
      
      updateTitle(bestMatch.trackName, bestMatch.artistName);
      
      if (results.length > 1) {
        createSongSelector(results, bestMatch);
      }
      
      displayLyrics(bestMatch);
      
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || CONSTANTS.MESSAGES.API_ERROR);
    }
  }

  function displayLyrics(data) {
    const synced = parseSyncedLyrics(data.syncedLyrics);
    const plain = data.plainLyrics || CONSTANTS.MESSAGES.NO_LYRICS;
    
    createModeToggle(synced.length > 0);
    
    if (synced.length > 0) {
      initSyncedLyrics(synced);
    } else {
      displayPlainLyrics(plain);
    }
  }

  function initSyncedLyrics(syncedLyrics) {
    state.syncedLyrics = syncedLyrics;
    displaySyncedLyrics(syncedLyrics);
    
    const video = document.querySelector(CONSTANTS.SELECTORS.VIDEO_PLAYER);
    if (!video) {
      console.error('Video element not found');
      return;
    }
    
    state.sync.videoElement = video;
    state.sync.currentIndex = -1;
    state.sync.lastKnownIndex = 0;
    
    // Store handlers for cleanup
    state.sync.handlePlay = () => {
      state.sync.isPlaying = true;
      syncLoop();
    };
    state.sync.handlePause = () => stopSync();
    
    video.addEventListener('play', state.sync.handlePlay);
    video.addEventListener('pause', state.sync.handlePause);
    
    startSync();
    createDelayControl();
  }

  function initializeLyricsPanel() {
    const secondaryInner = document.querySelector(CONSTANTS.SELECTORS.SECONDARY_INNER);
    const titleElement = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
    
    if (!secondaryInner || !titleElement || state.hasRun || !state.isEnabled) {
      return false;
    }
    
    const videoInfo = extractVideoInfo();
    if (!videoInfo) return false;
    
    state.currentTitle = videoInfo.rawTitle;
    createPanel(secondaryInner);
    fetchAndDisplayLyrics(videoInfo);
    
    state.hasRun = true;
    return true;
  }

  function watchForVideoChanges() {
    let lastTitle = '';
    
    const handleTitleChange = debounce(() => {
      const titleEl = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
      if (titleEl && titleEl.textContent !== lastTitle) {
        lastTitle = titleEl.textContent;
        resetState();
        setTimeout(() => initializeLyricsPanel(), 500);
      }
    }, 250);
    
    state.titleObserver = new MutationObserver(handleTitleChange);
    
    const titleContainer = document.querySelector('#title');
    if (titleContainer) {
      state.titleObserver.observe(titleContainer, { childList: true, subtree: true });
    }
  }

  function resetState() {
    // Clean up video event listeners
    if (state.sync.videoElement) {
      if (state.sync.handlePlay) {
        state.sync.videoElement.removeEventListener('play', state.sync.handlePlay);
      }
      if (state.sync.handlePause) {
        state.sync.videoElement.removeEventListener('pause', state.sync.handlePause);
      }
      state.sync.videoElement = null;
    }
    
    // Stop sync and cancel animation frame
    stopSync();
    
    // Clear state
    state.hasRun = false;
    state.currentTitle = '';
    state.currentData = null;
    state.syncedLyrics = [];
    state.sync.handlePlay = null;
    state.sync.handlePause = null;
    
    // Remove UI
    removePanel();
  }

  // ==================== INITIALIZATION ====================
  
  async function initialize() {
    if (!/^https:\/\/www\.youtube\.com\/watch\?v=/.test(window.location.href)) {
      return;
    }
    
    // Load settings
    chrome.storage.sync.get(['isEnabled'], (data) => {
      state.isEnabled = data.isEnabled || false;
      
      if (!state.isEnabled) {
        console.log('Extension is disabled');
        return;
      }
      
      // Wait for page ready
      const observer = new MutationObserver((mutations, obs) => {
        if (initializeLyricsPanel()) {
          obs.disconnect();
          watchForVideoChanges();
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isEnabled) {
      state.isEnabled = changes.isEnabled.newValue;
      location.reload();
    }
  });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
