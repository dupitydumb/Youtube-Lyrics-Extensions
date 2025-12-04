/**
 * YouTube Lyrics Extension v2.0 - Refactored with Apple Music Style UI
 * All-in-one file compatible with Chrome extensions (no ES6 imports)
 */

(function() {
  'use strict';

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
    sync: {
      currentIndex: -1,
      lastKnownIndex: 0,
      delay: 0,
      isPlaying: false,
      videoElement: null,
      animationFrameId: null
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

  function formatTitle(title) {
    if (!title) return '';
    
    const notAllowed = [...CONSTANTS.FILTER_WORDS.BASIC];
    for (let i = CONSTANTS.KOREAN_RANGE.START; i <= CONSTANTS.KOREAN_RANGE.END; i++) {
      notAllowed.push(String.fromCharCode(i));
    }
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => !notAllowed.includes(word))
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
    if (!state.sync.isPlaying || !state.sync.videoElement) return;
    
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
    
    // Container with entrance animation
    state.ui.container = document.createElement('div');
    state.ui.container.id = CONSTANTS.UI.PANEL_CONTAINER_ID;
    Object.assign(state.ui.container.style, {
      position: 'sticky',
      top: '0',
      zIndex: '100',
      marginBottom: spacing.MD,
      borderRadius: styles.RADIUS.LG,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      opacity: '1'
    });
    
    // Panel
    state.ui.panel = document.createElement('div');
    state.ui.panel.id = CONSTANTS.UI.PANEL_ID;
    Object.assign(state.ui.panel.style, {
      background: styles.BACKGROUND,
      backdropFilter: `blur(${styles.BACKDROP_BLUR})`,
      WebkitBackdropFilter: `blur(${styles.BACKDROP_BLUR})`,
      padding: spacing.LG,
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility',
      maxHeight: styles.MAX_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.MD
    });
    
    // Header
    const header = createHeader();
    state.ui.panel.appendChild(header);
    
    // Lyrics container
    state.ui.lyricsContainer = document.createElement('div');
    state.ui.lyricsContainer.id = 'lyrics-display';
    Object.assign(state.ui.lyricsContainer.style, {
      flex: '1',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: `${spacing.LG} 0`,
      textAlign: 'center',
      scrollBehavior: 'smooth',
      maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
      willChange: 'scroll-position'
    });
    state.ui.panel.appendChild(state.ui.lyricsContainer);
    
    // Controls
    state.ui.controlsContainer = document.createElement('div');
    state.ui.controlsContainer.id = 'lyrics-controls';
    Object.assign(state.ui.controlsContainer.style, {
      display: 'flex',
      gap: spacing.SM,
      flexWrap: 'wrap',
      paddingTop: spacing.MD,
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      fontSize: CONSTANTS.UI.TYPOGRAPHY.SIZES.SMALL
    });
    state.ui.panel.appendChild(state.ui.controlsContainer);
    
    state.ui.container.appendChild(state.ui.panel);
    parentElement.insertBefore(state.ui.container, parentElement.firstChild);
    
    // Add global styles
    addGlobalStyles();
  }

  function createHeader() {
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: spacing.MD,
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    });
    
    const titleContainer = document.createElement('div');
    titleContainer.id = 'lyrics-title';
    Object.assign(titleContainer.style, { 
      flex: '1',
      opacity: '1'
    });
    
    const title = document.createElement('h3');
    title.id = 'song-title';
    title.textContent = 'Lyrics';
    Object.assign(title.style, {
      margin: '0',
      fontSize: typo.SIZES.MEDIUM,
      fontWeight: typo.WEIGHTS.SEMIBOLD,
      letterSpacing: typo.LETTER_SPACING.TIGHT,
      lineHeight: typo.LINE_HEIGHTS.TIGHT,
      color: '#ffffff'
    });
    
    const artist = document.createElement('p');
    artist.id = 'song-artist';
    artist.textContent = '';
    Object.assign(artist.style, {
      margin: `${spacing.XXS} 0 0 0`,
      fontSize: typo.SIZES.SMALL,
      fontWeight: typo.WEIGHTS.REGULAR,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      lineHeight: typo.LINE_HEIGHTS.NORMAL,
      color: 'rgba(255, 255, 255, 0.6)',
      display: 'none'
    });
    
    titleContainer.appendChild(title);
    titleContainer.appendChild(artist);
    header.appendChild(titleContainer);
    
    return header;
  }

  function addGlobalStyles() {
    if (document.getElementById('lyrics-global-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'lyrics-global-styles';
    style.textContent = `
      /* Keyframe animations */
      @keyframes lyrics-panel-enter {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes lyrics-fade-in {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes lyrics-line-enter {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      
      /* Scrollbar styling */
      #lyrics-display::-webkit-scrollbar {
        width: 6px;
      }
      #lyrics-display::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }
      #lyrics-display::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        transition: background 0.2s;
      }
      #lyrics-display::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
      }
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        #${CONSTANTS.UI.PANEL_ID} {
          padding: clamp(1rem, 4vw, 1.5rem) !important;
        }
        #lyrics-display {
          padding: clamp(1rem, 3vw, 1.25rem) 0 !important;
        }
        #lyrics-controls {
          font-size: 0.8125rem !important;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);
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
    
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    
    state.ui.lyricsContainer.innerHTML = '';
    const loading = document.createElement('div');
    loading.textContent = CONSTANTS.MESSAGES.LOADING;
    Object.assign(loading.style, {
      textAlign: 'center',
      padding: spacing.XXL,
      fontSize: typo.SIZES.BASE,
      fontWeight: typo.WEIGHTS.REGULAR,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      color: 'rgba(255, 255, 255, 0.6)',
      opacity: '1'
    });
    state.ui.lyricsContainer.appendChild(loading);
  }

  function showError(message) {
    if (!state.ui.lyricsContainer) return;
    
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    
    state.ui.lyricsContainer.innerHTML = '';
    const error = document.createElement('div');
    error.textContent = message;
    Object.assign(error.style, {
      textAlign: 'center',
      padding: spacing.XXL,
      fontSize: typo.SIZES.BASE,
      fontWeight: typo.WEIGHTS.MEDIUM,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      color: 'rgba(255, 100, 100, 0.9)',
      opacity: '1'
    });
    state.ui.lyricsContainer.appendChild(error);
  }

  function displayPlainLyrics(lyrics) {
    if (!state.ui.lyricsContainer) return;
    
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    
    stopSync();
    state.ui.lyricsContainer.innerHTML = '';
    
    const text = document.createElement('div');
    Object.assign(text.style, {
      whiteSpace: 'pre-wrap',
      lineHeight: typo.LINE_HEIGHTS.LOOSE,
      fontSize: typo.SIZES.BASE,
      fontWeight: typo.WEIGHTS.REGULAR,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      color: 'rgba(255, 255, 255, 0.9)',
      padding: spacing.LG,
      maxWidth: styles.MAX_WIDTH,
      margin: '0 auto',
      opacity: '1'
    });
    text.textContent = lyrics;
    state.ui.lyricsContainer.appendChild(text);
  }

  function displaySyncedLyrics(syncedLyrics) {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    
    syncedLyrics.forEach((lyric, index) => {
      const line = document.createElement('div');
      line.className = 'lyric-line';
      line.dataset.index = index;
      line.textContent = lyric.text;
      
      // Staggered entrance animation
      const delay = index * styles.STAGGER_DELAY;
      
      Object.assign(line.style, {
        padding: `${spacing.SM} ${spacing.LG}`,
        fontSize: typo.SIZES.BASE,
        fontWeight: typo.WEIGHTS.REGULAR,
        lineHeight: typo.LINE_HEIGHTS.RELAXED,
        letterSpacing: typo.LETTER_SPACING.WIDE,
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        transition: `all ${styles.TRANSITIONS.NORMAL}`,
        transform: 'scale(1)',
        maxWidth: styles.MAX_WIDTH,
        margin: '0 auto',
        opacity: '1',
        willChange: 'transform, opacity, color, font-size'
      });
      
      line.addEventListener('click', () => seekToLyric(index));
      line.addEventListener('mouseenter', () => {
        if (!line.classList.contains('current')) {
          line.style.color = 'rgba(255, 255, 255, 0.75)';
          line.style.transform = 'scale(1.02)';
        }
      });
      line.addEventListener('mouseleave', () => {
        if (!line.classList.contains('current')) {
          line.style.color = 'rgba(255, 255, 255, 0.4)';
          line.style.transform = 'scale(1)';
        }
      });
      
      state.ui.lyricsContainer.appendChild(line);
    });
  }

  function updateCurrentLyric(currentIndex) {
    if (!state.ui.lyricsContainer) return;
    
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const lines = state.ui.lyricsContainer.querySelectorAll('.lyric-line');
    
    lines.forEach((line, index) => {
      const isCurrent = index === currentIndex;
      const isPast = index < currentIndex;
      
      if (isCurrent) {
        line.classList.add('current');
        Object.assign(line.style, {
          color: '#ffffff',
          fontSize: typo.SIZES.CURRENT,
          fontWeight: typo.WEIGHTS.SEMIBOLD,
          letterSpacing: typo.LETTER_SPACING.TIGHT,
          transform: `scale(${styles.CURRENT_SCALE})`,
          textShadow: '0 2px 20px rgba(255, 255, 255, 0.4)',
          transition: `all ${styles.TRANSITIONS.SLOW}`
        });
        
        // Center the current lyric with accurate calculation
        setTimeout(() => {
          const container = state.ui.lyricsContainer;
          
          // Force layout recalculation to get accurate dimensions after transform
          line.getBoundingClientRect();
          
          // Get current positions
          const containerRect = container.getBoundingClientRect();
          const lineRect = line.getBoundingClientRect();
          
          // Calculate how much to scroll to center the line
          // Container center - line center relative to container top
          const containerCenter = containerRect.height / 2;
          const lineCenterRelativeToContainer = lineRect.top - containerRect.top + container.scrollTop;
          const lineCenter = lineRect.height / 2;
          
          // Target scroll position
          const targetScroll = lineCenterRelativeToContainer - containerCenter + lineCenter;
          
          container.scrollTo({ 
            top: targetScroll,
            behavior: 'smooth' 
          });
        }, 250);
        
      } else {
        line.classList.remove('current');
        Object.assign(line.style, {
          fontSize: typo.SIZES.BASE,
          fontWeight: typo.WEIGHTS.REGULAR,
          letterSpacing: typo.LETTER_SPACING.WIDE,
          transform: 'scale(1)',
          textShadow: 'none',
          transition: `all ${styles.TRANSITIONS.NORMAL}`,
          color: isPast 
            ? `rgba(255, 255, 255, ${styles.PAST_OPACITY})` 
            : `rgba(255, 255, 255, ${styles.FUTURE_OPACITY})`
        });
      }
    });
  }

  function createButton(text, onClick) {
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: styles.RADIUS.SM,
      padding: `${spacing.XS} ${spacing.MD}`,
      fontSize: typo.SIZES.SMALL,
      fontWeight: typo.WEIGHTS.MEDIUM,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      cursor: 'pointer',
      outline: 'none',
      transition: `all ${styles.TRANSITIONS.FAST}`,
      WebkitAppearance: 'none',
      appearance: 'none'
    });
    
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.2)';
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
    });
    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'translateY(0) scale(0.98)';
    });
    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'translateY(-1px) scale(1)';
    });
    
    return btn;
  }

  function createSelect(id, options, onChange) {
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    
    const select = document.createElement('select');
    select.id = id;
    
    const dropdownIcon = "data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
    
    Object.assign(select.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: styles.RADIUS.SM,
      padding: `${spacing.XS} ${spacing.SM}`,
      fontSize: typo.SIZES.SMALL,
      fontWeight: typo.WEIGHTS.MEDIUM,
      letterSpacing: typo.LETTER_SPACING.WIDE,
      cursor: 'pointer',
      outline: 'none',
      transition: `all ${styles.TRANSITIONS.FAST}`,
      WebkitAppearance: 'none',
      appearance: 'none',
      backgroundImage: `url("${dropdownIcon}")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 0.5rem center',
      paddingRight: '2rem'
    });
    
    select.addEventListener('change', onChange);
    select.addEventListener('mouseenter', () => {
      select.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    select.addEventListener('mouseleave', () => {
      select.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      option.style.background = '#1a1a1a';
      option.style.color = '#ffffff';
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
    
    const typo = CONSTANTS.UI.TYPOGRAPHY;
    const spacing = CONSTANTS.UI.SPACING;
    
    const container = document.createElement('div');
    container.id = 'delay-control';
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.XS
    });
    
    const label = document.createElement('span');
    label.textContent = 'Delay: ';
    Object.assign(label.style, {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: typo.SIZES.SMALL,
      fontWeight: typo.WEIGHTS.MEDIUM,
      letterSpacing: typo.LETTER_SPACING.WIDE
    });
    
    const display = document.createElement('span');
    display.id = 'delay-display';
    Object.assign(display.style, {
      color: '#ffffff',
      minWidth: 'clamp(3.5rem, 10vw, 4.5rem)',
      textAlign: 'center',
      fontSize: typo.SIZES.SMALL,
      fontWeight: typo.WEIGHTS.SEMIBOLD,
      letterSpacing: typo.LETTER_SPACING.WIDE
    });
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
    
    startSync();
    createDelayControl();
    
    video.addEventListener('play', () => {
      state.sync.isPlaying = true;
      syncLoop();
    });
    video.addEventListener('pause', stopSync);
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
    
    const observer = new MutationObserver(() => {
      const titleEl = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
      if (titleEl && titleEl.textContent !== lastTitle) {
        lastTitle = titleEl.textContent;
        resetState();
        setTimeout(() => initializeLyricsPanel(), 500);
      }
    });
    
    const titleContainer = document.querySelector('#title');
    if (titleContainer) {
      observer.observe(titleContainer, { childList: true, subtree: true });
    }
  }

  function resetState() {
    state.hasRun = false;
    state.currentTitle = '';
    state.currentData = null;
    state.syncedLyrics = [];
    stopSync();
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
