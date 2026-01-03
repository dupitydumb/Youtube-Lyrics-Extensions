import { SELECTORS, UI_CONFIG } from './constants.js';
import { ColorExtractor } from './color-utils.js';
import { Maid } from './utils/Maid.js';
import { Signal } from './utils/Signal.js';
import { LyricsRenderer } from './lyrics/LyricsRenderer.js';

/**
 * UI Module - Handles all UI creation and manipulation with Apple Music styling
 * Now uses Maid for resource cleanup, Signal for event handling,
 * and can optionally use LyricsRenderer for advanced lyrics display.
 */

export class LyricsUI {
  constructor() {
    // Initialize Maid for resource cleanup
    this._maid = new Maid();
    
    this.panel = null;
    this.container = null;
    this.lyricsContainer = null;
    this.controlsContainer = null;
    this.currentStyle = 'apple-music';
    this.settingsRef = null; // Store settings reference for updates
    this.currentFontSize = 16; // Store current font size
    this.highlightMode = 'line'; // 'line' or 'word'
    
    // Signals for event communication
    this.OnSeekRequest = new Signal();
    this.OnSettingsChange = new Signal();
    this.OnModeChange = new Signal();
    
    // LyricsRenderer instance (used when useRenderer is true)
    this._lyricsRenderer = null;
    this._useRenderer = true; // Use modular LyricsRenderer for shared code with fullscreen
    
    this._lyricsStyleElement = null;
    this._cachedLines = null;
    this._scrollTimeout = null;
    // rAF batching and visible range tracking
    this._pendingUpdateArgs = null;
    this._rafId = null;
    this._visibleRange = { start: -1, end: -1 };
    this._lastWordIndexMap = new Map();
    // Scroll system - prevent jitter
    this._lastScrollIndex = -1;
    this._isScrolling = false;
    this._scrollAnimationId = null;
    // Visual effects - progress bar and adaptive colors
    this.progressBar = null;
    this.blurredBackground = null;
    this.adaptiveColors = null;
  }

  /**
   * Enable or disable using LyricsRenderer for lyrics display
   * @param {boolean} use - Whether to use LyricsRenderer
   */
  setUseRenderer(use) {
    this._useRenderer = use;
  }

  /**
   * Get the internal LyricsRenderer instance (if using renderer mode)
   * @returns {LyricsRenderer|null}
   */
  getRenderer() {
    return this._lyricsRenderer;
  }

  /**
   * Custom smooth scroll with easing to prevent jitter
   * @param {number} targetPosition - Target scroll position
   * @param {number} duration - Animation duration in ms
   */
  smoothScrollTo(targetPosition, duration = 350) {
    if (!this.lyricsContainer || this._isScrolling) return;

    const startPosition = this.lyricsContainer.scrollTop;
    const distance = targetPosition - startPosition;

    // Skip if already close enough
    if (Math.abs(distance) < 5) return;

    this._isScrolling = true;
    const startTime = performance.now();

    // Easing function - easeOutCubic for smooth deceleration
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeOutCubic(progress);

      this.lyricsContainer.scrollTop = startPosition + (distance * easeProgress);

      if (progress < 1) {
        this._scrollAnimationId = requestAnimationFrame(animateScroll);
      } else {
        this._isScrolling = false;
        this._scrollAnimationId = null;
      }
    };

    // Cancel any existing scroll animation
    if (this._scrollAnimationId) {
      cancelAnimationFrame(this._scrollAnimationId);
    }

    this._scrollAnimationId = requestAnimationFrame(animateScroll);
  }

  /**
   * Schedule a UI update; coalesces multiple rapid calls into a single rAF.
   */
  scheduleUpdate(currentIndex, currentTime = null, indexChanged = true) {
    this._pendingUpdateArgs = { currentIndex, currentTime, indexChanged };
    if (!this._rafId) {
      this._rafId = requestAnimationFrame(() => {
        this._rafId = null;
        const args = this._pendingUpdateArgs;
        this._pendingUpdateArgs = null;
        this.performUpdate(args.currentIndex, args.currentTime, args.indexChanged);
      });
    }
  }

  /**
   * Perform the actual DOM updates — Apple Music scrollable display
   * Shows all lyrics with current line highlighted and scrolled into view
   */
  performUpdate(currentIndex, currentTime = null, indexChanged = true) {
    if (!this.lyricsContainer) return;

    if (indexChanged || !this._cachedLines) {
      this._cachedLines = this.lyricsContainer.querySelectorAll('.lyric-line');
    }

    const lyricLines = this._cachedLines;
    const total = lyricLines.length;
    if (total === 0) return;

    // Define position class constants
    const CLASSES = ['lyric-past', 'lyric-current', 'lyric-future', 'lyric-prev', 'lyric-next', 'lyric-exit', 'lyric-enter', 'current', 'past', 'future'];

    // Update all lines with past/current/future states
    for (let i = 0; i < total; i++) {
      const line = lyricLines[i];
      if (!line) continue;

      // Remove all position classes first
      line.classList.remove(...CLASSES);

      // Apply appropriate state class
      if (i < currentIndex) {
        line.classList.add('lyric-past');
        // Clear word highlighting for past lines
        const wordsOnLine = line.querySelectorAll('.lyric-word');
        wordsOnLine.forEach(w => {
          w.classList.remove('highlighted', 'future');
          w.classList.add('past');
        });
      } else if (i === currentIndex) {
        line.classList.add('lyric-current');

        // Handle word highlighting for current line based on mode
        const wordsOnLine = line.querySelectorAll('.lyric-word');
        if (this.highlightMode === 'line') {
          // In line mode, highlight all words immediately
          wordsOnLine.forEach(w => {
            w.classList.remove('future', 'past');
            w.classList.add('highlighted');
          });
        } else {
          // In word mode, initialize all words as future (dimmed)
          // The updateWordHighlight function will highlight the current word
          wordsOnLine.forEach(w => {
            w.classList.remove('highlighted');
            // Don't set future class here - let updateWordHighlight handle proper state
          });
        }

        // Scroll current line into view (centered) on index change
        if (indexChanged && this._lastScrollIndex !== currentIndex) {
          this._lastScrollIndex = currentIndex;
          // Use smooth scroll to center the current line
          requestAnimationFrame(() => {
            line.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          });
        }
      } else {
        line.classList.add('lyric-future');
        // Clear word highlighting for future lines
        const wordsOnLine = line.querySelectorAll('.lyric-word');
        wordsOnLine.forEach(w => {
          w.classList.remove('highlighted', 'past');
          w.classList.add('future');
        });
      }
    }

    // Update visible range tracking
    this._visibleRange.start = 0;
    this._visibleRange.end = total - 1;

    // Word-level updates for current line
    if (currentTime !== null && this.highlightMode === 'word') {
      const currentLine = lyricLines[currentIndex];
      if (currentLine) this.updateWordHighlight(currentLine, currentTime);
    }
  }

  /**
   * Helper to add an event listener and track it for later removal using Maid
   */
  addListener(target, type, handler, options) {
    return this._maid.GiveListener(target, type, handler, options);
  }

  /**
   * Remove all tracked listeners (now handled by Maid)
   * @deprecated Use destroy() instead
   */
  removeAllListeners() {
    // Maid handles this now - this is a no-op for backward compatibility
  }

  /**
   * Create the main lyrics panel with Apple Music styling
   */
  createPanel(parentElement) {
    if (this.panel) {
      this.removePanel();
    }

    // Create outer container
    this.container = document.createElement('div');
    this.container.id = UI_CONFIG.PANEL_CONTAINER_ID;
    this.applyContainerStyles(this.container);

    // Create panel
    this.panel = document.createElement('div');
    this.panel.id = UI_CONFIG.PANEL_ID;
    this.applyPanelStyles(this.panel);

    // Create header
    const header = this.createHeader();
    this.panel.appendChild(header);

    // Create lyrics container
    this.lyricsContainer = document.createElement('div');
    this.lyricsContainer.id = 'lyrics-display';
    this.applyLyricsContainerStyles(this.lyricsContainer);
    this.panel.appendChild(this.lyricsContainer);

    this.container.appendChild(this.panel);

    // Insert at the beginning of parent
    parentElement.insertBefore(this.container, parentElement.firstChild);

    return this.panel;
  }

  /**
   * Apply Apple Music-inspired container styles
   */
  applyContainerStyles(element) {
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;
    Object.assign(element.style, {
      position: 'sticky',
      top: '0',
      zIndex: '100',
      marginBottom: '16px',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)'
    });
  }

  /**
   * Apply Apple Music-inspired panel styles - dark translucent overlay
   */
  applyPanelStyles(element) {
    Object.assign(element.style, {
      position: 'relative',
      zIndex: '2',
      background: 'rgba(20, 20, 22, 0.92)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      padding: '16px 20px',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxHeight: '520px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
  }

  /**
   * Apply lyrics container styles - Apple Music scrollable display
   */
  applyLyricsContainerStyles(element) {
    Object.assign(element.style, {
      flex: '1',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '1rem 1.5rem',
      textAlign: 'left',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      minHeight: '280px',
      maxHeight: '400px',
      position: 'relative',
      scrollBehavior: 'smooth',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      gap: '0.25rem'
    });

    // Apple Music scrollable display styles
    const style = document.createElement('style');
    style.textContent = `
      /* ===== APPLE MUSIC SCROLLABLE DISPLAY ===== */
      
      /* Hide scrollbar */
      #lyrics-display::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      /* Base line styles - matching content.css */
      #lyrics-display .lyric-line {
        position: relative !important;
        padding: 0.6rem 1rem !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
        font-size: 1.7rem !important;
        font-weight: 700 !important;
        line-height: 2.5 !important;
        letter-spacing: -0.02em !important;
        color: rgba(255, 248, 230, 0.35) !important;
        text-align: left !important;
        font-style: normal !important;
        border-radius: 8px !important;
        transition: color 0.4s ease, transform 0.4s ease, opacity 0.4s ease, text-align 0.3s ease, font-style 0.3s ease, font-size 0.3s ease !important;
        cursor: pointer !important;
      }
      
      /* Base - transitions for smooth movement */
      #lyrics-display .lyric-line {
        transform: translateY(0) !important;
        transition: 
          color 0.4s ease,
          transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
      }
      
      /* Past lines - already moved up */
      #lyrics-display .lyric-line.lyric-past {
        color: rgba(255, 248, 230, 0.85) !important;
        text-align: left !important;
        font-style: normal !important;
        font-weight: 700 !important;
        transform: translateY(-24px) !important;
        transition-delay: 0s !important;
      }
      
      /* Current line - moves up with slight delay */
      #lyrics-display .lyric-line.lyric-current {
        color: #fff8e6 !important;
        text-align: left !important;
        font-style: normal !important;
        font-weight: 700 !important;
        transform: translateY(-24px) !important;
        transition-delay: 0.15s !important;
      }
      
      /* Future lines - waiting at base position */
      #lyrics-display .lyric-line.lyric-future {
        color: rgba(255, 248, 230, 0.35) !important;
        text-align: left !important;
        font-style: normal !important;
        font-weight: 700 !important;
        transform: translateY(0) !important;
        transition-delay: 0s !important;
      }
      
      /* Hover effect */
      #lyrics-display .lyric-line:hover {
        color: rgba(255, 248, 230, 0.75) !important;
      }
      #lyrics-display .lyric-line.lyric-current:hover {
        color: #fff8e6 !important;
      }
      
      /* Word highlighting - Apple Music style - inherit all properties */
      #lyrics-display .lyric-word {
        --word-progress: 0%;
        --highlight-color: #fff8e6;
        --future-color: rgba(255, 248, 230, 0.35);
        display: inline;
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        font-style: inherit !important;
        color: transparent !important;
        background-clip: text !important;
        -webkit-background-clip: text !important;
      }
      #lyrics-display .lyric-word.highlighted {
        background-image: linear-gradient(to right, var(--highlight-color) 0%, var(--highlight-color) var(--word-progress), var(--future-color) var(--word-progress), var(--future-color) 100%) !important;
      }
      #lyrics-display .lyric-word.past {
        background-image: linear-gradient(to right, var(--highlight-color) 0%, var(--highlight-color) 100%) !important;
      }
      #lyrics-display .lyric-word.future {
        background-image: linear-gradient(to right, var(--future-color) 0%, var(--future-color) 100%) !important;
      }
      
      /* Title visibility */
      #song-title, #song-artist { opacity: 1 !important; visibility: visible !important; }
    `;
    // Store injected style element so it can be removed on cleanup
    this._lyricsStyleElement = style;
    document.head.appendChild(style);
  }

  /**
   * Create header with title and close button - Apple Music compact style
   */
  createHeader() {
    const header = document.createElement('div');
    header.id = 'lyrics-header-container';
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '12px',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      zIndex: '100'
    });

    // Album cover - compact size like Apple Music mobile
    const albumCover = document.createElement('img');
    albumCover.id = 'panel-album-cover';
    albumCover.alt = 'Album Cover';
    albumCover.style.cssText = `
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: none;
      flex-shrink: 0;
    `;

    const titleContainer = document.createElement('div');
    titleContainer.id = 'lyrics-title';
    Object.assign(titleContainer.style, {
      textAlign: 'left',
      flex: '1',
      minWidth: '0'
    });

    const title = document.createElement('h3');
    title.id = 'song-title';
    title.textContent = 'Lyrics';
    title.style.cssText = `
      margin: 0 !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      opacity: 1 !important;
      visibility: visible !important;
      line-height: 1.3 !important;
    `;

    const artist = document.createElement('p');
    artist.id = 'song-artist';
    artist.textContent = '';
    artist.style.cssText = `
      margin: 2px 0 0 0 !important;
      font-size: 13px !important;
      color: rgba(255, 255, 255, 0.55) !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      opacity: 1 !important;
      visibility: visible !important;
      line-height: 1.3 !important;
    `;

    const provider = document.createElement('p');
    provider.id = 'lyrics-provider';
    provider.textContent = '';
    provider.style.cssText = `
      margin: 4px 0 0 0 !important;
      font-size: 11px !important;
      color: rgba(255, 255, 255, 0.4) !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      opacity: 1 !important;
      visibility: visible !important;
      line-height: 1.2 !important;
      font-style: italic !important;
    `;

    titleContainer.appendChild(title);
    titleContainer.appendChild(artist);
    titleContainer.appendChild(provider);

    header.appendChild(albumCover);
    header.appendChild(titleContainer);

    return header;
  }

  /**
   * Create controls (delay adjustment, mode toggle, song selection)
   */
  createControls() {
    const controls = document.createElement('div');
    controls.id = 'lyrics-controls';
    Object.assign(controls.style, {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      paddingTop: '16px',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      fontSize: '14px'
    });

    return controls;
  }

  /**
   * Display plain lyrics with Apple Music styling
   */
  displayPlainLyrics(lyrics) {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();

    const lyricsText = document.createElement('div');
    Object.assign(lyricsText.style, {
      whiteSpace: 'pre-wrap',
      lineHeight: '2',
      fontSize: '16px',
      color: 'rgba(255, 255, 255, 0.9)',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto'
    });

    lyricsText.textContent = lyrics;
    this.lyricsContainer.appendChild(lyricsText);
  }

  /**
   * Display synced lyrics with Apple Music styling
   * Uses LyricsRenderer if _useRenderer is true, otherwise uses legacy rendering
   */
  displaySyncedLyrics(syncedLyrics) {
    if (!this.lyricsContainer) return;

    // Clear cache when displaying new lyrics
    this._cachedLines = null;

    // Destroy any existing renderer
    if (this._lyricsRenderer) {
      this._lyricsRenderer.Destroy();
      this._lyricsRenderer = null;
    }

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();

    // Use LyricsRenderer if enabled
    if (this._useRenderer) {
      this._displayWithRenderer(syncedLyrics);
      return;
    }

    // Legacy rendering path
    this._displayLegacy(syncedLyrics);
  }

  /**
   * Display lyrics using the modular LyricsRenderer
   * @private
   */
  _displayWithRenderer(syncedLyrics) {
    try {
      this._lyricsRenderer = new LyricsRenderer(this.lyricsContainer, syncedLyrics, {
        highlightMode: this.highlightMode,
        showRomanization: this.settingsRef?.showRomanization || false,
        hideOriginalLyrics: this.settingsRef?.hideOriginalLyrics || false,
        detectInterludes: true,
        interludeThreshold: 5
      });

      // Connect renderer's seek signal to our signal
      this._lyricsRenderer.OnSeekRequest.Connect((time, index) => {
        this.OnSeekRequest.Fire(time, index);
        
        // Also dispatch DOM event for legacy compatibility
        const event = new CustomEvent('lyric-seek', {
          detail: { index, time }
        });
        document.dispatchEvent(event);
      });

      console.log('[UI] Using LyricsRenderer for display');
    } catch (error) {
      console.warn('[UI] Failed to create LyricsRenderer, falling back to legacy:', error);
      this._lyricsRenderer = null;
      this._displayLegacy(syncedLyrics);
    }
  }

  /**
   * Legacy display method for synced lyrics
   * @private
   */
  _displayLegacy(syncedLyrics) {
    // Add padding spacers to allow first/last lyrics to scroll to center
    const topSpacer = document.createElement('div');
    topSpacer.style.height = '120px';
    topSpacer.style.flexShrink = '0';
    this.lyricsContainer.appendChild(topSpacer);

    syncedLyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyric-line';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;

      // Check if we should hide original lyrics when showing romanization
      const shouldHideOriginal = lyric.romanized &&
        this.settingsRef?.showRomanization &&
        this.settingsRef?.hideOriginalLyrics;

      // Create a container for the main lyric text
      const textContainer = document.createElement('div');

      // If showing romanization and hideOriginalLyrics is enabled, hide the original text
      if (shouldHideOriginal) {
        textContainer.style.display = 'none';
      }

      // Check if lyric has word-level timing
      if (lyric.words && lyric.words.length > 0) {
        if (index === 0) console.log('[UI debug] Rendering line 0 with words:', lyric.words);
        // Create word-by-word display
        lyric.words.forEach((wordData, wordIndex) => {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'lyric-word future';
          wordSpan.textContent = wordData.word;
          wordSpan.dataset.wordIndex = wordIndex;
          wordSpan.dataset.wordTime = wordData.time;
          textContainer.appendChild(wordSpan);

          // Add space after word (except last word)
          if (wordIndex < lyric.words.length - 1) {
            textContainer.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        // Regular line-by-line display
        textContainer.textContent = lyric.text;
      }

      lyricLine.appendChild(textContainer);

      // Optional romanization displayed beneath (or as main text if original is hidden)
      if (this.settingsRef && this.settingsRef.showRomanization && lyric.romanized) {
        const roman = document.createElement('div');
        roman.className = 'romanization-text';
        roman.textContent = lyric.romanized;
        Object.assign(roman.style, {
          marginTop: '4px',
          fontSize: shouldHideOriginal ? '1em' : '0.85em',
          color: 'inherit',
          fontStyle: 'italic'
        });
        lyricLine.appendChild(roman);
      }

      // NO inline styles - let CSS handle everything
      // Just add class and data attributes

      // Click to seek - use both Signal and DOM event for compatibility
      this._maid.GiveListener(lyricLine, 'click', () => {
        // Fire signal for modern listeners
        this.OnSeekRequest.Fire(lyric.time, index);
        
        // Also dispatch DOM event for legacy compatibility
        const event = new CustomEvent('lyric-seek', {
          detail: { index, time: lyric.time }
        });
        document.dispatchEvent(event);
      });

      this.lyricsContainer.appendChild(lyricLine);
    });

    // Bottom spacer for scroll centering
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = '120px';
    bottomSpacer.style.flexShrink = '0';
    this.lyricsContainer.appendChild(bottomSpacer);
  }

  /**
   * Update current lyric highlight with smooth animations
   * If using LyricsRenderer, delegates to its Animate method
   */
  updateCurrentLyric(currentIndex, currentTime = null, indexChanged = true) {
    // If using LyricsRenderer, use its animation system
    if (this._lyricsRenderer && this._useRenderer) {
      // LyricsRenderer.Animate expects (timestamp, deltaTime, skipped)
      // We approximate deltaTime as 1/60 for 60fps
      this._lyricsRenderer.Animate(currentTime || 0, 1/60, indexChanged);
      return;
    }
    
    // Coalesce multiple rapid updates into a single rAF and perform optimized update
    this.scheduleUpdate(currentIndex, currentTime, indexChanged);
  }

  /**
   * Set highlight mode and refresh display
   */
  setHighlightMode(mode) {
    const previousMode = this.highlightMode;
    this.highlightMode = mode;
    console.log(`[UI] Highlight mode changed: ${previousMode} -> ${mode}`);

    // If we have cached lines and mode changed, refresh word highlighting
    if (this._cachedLines && previousMode !== mode) {
      const currentLine = Array.from(this._cachedLines).find(line =>
        line.classList.contains('lyric-current')
      );
      if (currentLine) {
        const words = currentLine.querySelectorAll('.lyric-word');
        if (mode === 'line') {
          // In line mode, highlight all words on current line (fully filled)
          words.forEach(w => {
            w.classList.remove('past', 'future');
            w.classList.add('highlighted');
            w.style.setProperty('--word-progress', '100%');
          });
        } else {
          // In word mode, remove highlighted class to let word-by-word work
          words.forEach(w => {
            w.classList.remove('highlighted');
            w.style.setProperty('--word-progress', '0%');
          });
        }
      }
    }
  }

  /**
   * Update word-by-word highlighting within a line
   */
  updateWordHighlight(lineElement, currentTime) {
    const words = lineElement.querySelectorAll('.lyric-word');
    if (words.length === 0) return;

    // console.log(`[UI debug] updateWordHighlight: line=${lineElement.dataset.index} words=${words.length} mode=${this.highlightMode} time=${currentTime}`);

    // Only highlight words if in word mode
    if (this.highlightMode !== 'word') {
      words.forEach(word => {
        word.classList.remove('highlighted', 'past', 'future');
        word.classList.add('highlighted'); // In line mode, all words are highlighted
        word.style.setProperty('--word-progress', '100%'); // Fully filled for line mode
      });
      return;
    }

    // Convert NodeList to array for binary-like search
    const wordArray = Array.from(words);
    let low = 0, high = wordArray.length - 1, mid, currentWordIndex = -1;
    while (low <= high) {
      mid = Math.floor((low + high) / 2);
      const wt = parseFloat(wordArray[mid].dataset.wordTime);
      if (isNaN(wt)) { low = mid + 1; continue; }
      if (wt <= currentTime) {
        currentWordIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const lineIndex = parseInt(lineElement.dataset.index || '-1', 10);
    const lastIdx = this._lastWordIndexMap.get(lineIndex) ?? -1;

    // Always update all words to ensure proper past/current/future state
    // This fixes the issue where future words stayed highlighted
    wordArray.forEach((word, idx) => {
      if (idx < currentWordIndex) {
        // Past words - fully filled
        word.classList.remove('highlighted', 'future');
        word.classList.add('past');
        word.style.setProperty('--word-progress', '100%');
      } else if (idx === currentWordIndex) {
        // Current word - calculate progress
        word.classList.add('highlighted');
        word.classList.remove('past', 'future');

        // Calculate progress within this word
        const wordStartTime = parseFloat(word.dataset.wordTime) || 0;
        const nextWord = wordArray[idx + 1];
        const wordEndTime = nextWord ? (parseFloat(nextWord.dataset.wordTime) || wordStartTime + 1) : wordStartTime + 1;
        const wordDuration = wordEndTime - wordStartTime;
        const elapsed = currentTime - wordStartTime;
        const progress = Math.min(100, Math.max(0, (elapsed / wordDuration) * 100));
        
        word.style.setProperty('--word-progress', `${progress}%`);
      } else {
        // Future words - no fill
        word.classList.remove('highlighted', 'past');
        word.classList.add('future');
        word.style.setProperty('--word-progress', '0%');
      }
    });

    // Update stored index
    this._lastWordIndexMap.set(lineIndex, currentWordIndex);
  }

  /**
   * Update song title, artist, and provider attribution
   */
  updateTitle(title, artist = '', providerName = '') {
    const titleElement = document.getElementById('song-title');
    const artistElement = document.getElementById('song-artist');
    const providerElement = document.getElementById('lyrics-provider');

    if (titleElement) {
      titleElement.textContent = title || 'Lyrics';
      titleElement.style.opacity = '1';
      titleElement.style.visibility = 'visible';
    }

    if (artistElement) {
      artistElement.textContent = artist;
      artistElement.style.display = artist ? 'block' : 'none';
      artistElement.style.opacity = '1';
      artistElement.style.visibility = 'visible';
    }

    if (providerElement) {
      providerElement.textContent = providerName ? `Lyrics by ${providerName}` : '';
      providerElement.style.display = providerName ? 'block' : 'none';
      providerElement.style.opacity = '1';
      providerElement.style.visibility = 'visible';
    }
  }

  /**
   * Update album cover in panel header with color extraction and blurred background
   */
  async updateAlbumCover(imageUrl, showInPanel = true) {
    const albumCoverElement = document.getElementById('panel-album-cover');

    if (!albumCoverElement) return;

    if (imageUrl && showInPanel) {
      albumCoverElement.src = imageUrl;
      albumCoverElement.style.display = 'block';

      // Add gentle float animation to album cover
      albumCoverElement.style.animation = 'album-float 6s ease-in-out infinite';

      // Extract colors and update theme
      try {
        const colors = await ColorExtractor.extractDominantColors(imageUrl, 3);
        this.adaptiveColors = colors;
        this.updateAdaptiveGradient(colors);
        this.updateBlurredBackground(imageUrl, colors);
      } catch (error) {
        console.warn('Failed to extract colors from album art:', error);
      }
    } else {
      albumCoverElement.style.display = 'none';
    }
  }

  /**
   * Update adaptive gradient overlay on panel based on album art colors
   */
  updateAdaptiveGradient(colors) {
    if (!this.panel || !colors) return;

    const gradient = ColorExtractor.generateGradient(colors, '135deg');
    this.panel.style.background = gradient;
    this.panel.style.backdropFilter = 'blur(20px)';
    this.panel.style.webkitBackdropFilter = 'blur(20px)';
  }

  /**
   * Create or update blurred album art background
   */
  updateBlurredBackground(imageUrl, colors = null) {
    if (!this.container) return;

    // Find or create blurred background layer
    if (!this.blurredBackground) {
      this.blurredBackground = document.createElement('div');
      this.blurredBackground.className = 'lyrics-blurred-background';
      this.blurredBackground.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 0;
        border-radius: 16px;
        overflow: hidden;
        pointer-events: none;
      `;

      // Insert as first child (behind panel)
      this.container.insertBefore(this.blurredBackground, this.container.firstChild);
    }

    if (imageUrl) {
      // Set blurred background image
      this.blurredBackground.style.backgroundImage = `url("${imageUrl}")`;
      this.blurredBackground.style.backgroundSize = 'cover';
      this.blurredBackground.style.backgroundPosition = 'center';
      this.blurredBackground.style.filter = 'blur(40px) brightness(0.6)';
      this.blurredBackground.style.transform = 'scale(1.1)'; // Prevent blur edge artifacts
      this.blurredBackground.style.opacity = '1';
      this.blurredBackground.style.transition = 'opacity 0.8s ease, filter 0.8s ease';

      // Add radial gradient overlay for depth
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${colors ? ColorExtractor.generateRadialGradient(colors) : 'radial-gradient(circle at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.6) 100%)'};
        z-index: 1;
      `;

      // Clear existing overlays and add new one
      while (this.blurredBackground.firstChild) {
        this.blurredBackground.removeChild(this.blurredBackground.firstChild);
      }
      this.blurredBackground.appendChild(overlay);
    } else {
      this.blurredBackground.style.opacity = '0';
    }
  }

  /**
   * Create progress bar for song position
   */
  createProgressBar() {
    if (this.progressBar || !this.panel) return;

    const progressContainer = document.createElement('div');
    progressContainer.className = 'lyrics-progress-container';
    progressContainer.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
      z-index: 10;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.className = 'lyrics-progress-bar';
    this.progressBar.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
      transition: width 0.3s ease-out;
      box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
    `;

    progressContainer.appendChild(this.progressBar);
    this.panel.appendChild(progressContainer);

    return progressContainer;
  }

  /**
   * Update progress bar position
   * @param {number} percentage - Progress percentage (0-100)
   */
  updateProgressBar(percentage) {
    if (!this.progressBar) {
      this.createProgressBar();
    }

    if (this.progressBar) {
      const clampedPercentage = Math.max(0, Math.min(100, percentage));
      this.progressBar.style.width = `${clampedPercentage}%`;

      // Update gradient color if adaptive colors are available
      if (this.adaptiveColors && this.adaptiveColors.length >= 2) {
        const color1 = ColorExtractor._addAlpha(this.adaptiveColors[0], 0.8);
        const color2 = ColorExtractor._addAlpha(this.adaptiveColors[1], 0.8);
        this.progressBar.style.background = `linear-gradient(90deg, ${color1} 0%, ${color2} 100%)`;
      }
    }
  }

  /**
   * Add a control element
   */
  addControl(element) {
    if (this.controlsContainer) {
      this.controlsContainer.appendChild(element);
    }
  }

  /**
   * Create styled select dropdown
   */
  createSelect(id, options, onChange) {
    const select = document.createElement('select');
    select.id = id;

    Object.assign(select.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s'
    });

    select.addEventListener('change', onChange);
    select.addEventListener('mouseenter', () => {
      select.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    select.addEventListener('mouseleave', () => {
      select.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      opt.style.background = '#1a1a1a';
      opt.style.color = '#ffffff';
      select.appendChild(opt);
    });

    return select;
  }

  /**
   * Create styled button
   */
  createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;

    Object.assign(button.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      fontSize: '14px',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s',
      fontWeight: '500'
    });

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'translateY(-1px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    const loading = document.createElement('div');
    loading.textContent = 'Loading lyrics...';
    Object.assign(loading.style, {
      textAlign: 'center',
      padding: '40px',
      fontSize: '16px',
      color: 'rgba(255, 255, 255, 0.6)'
    });

    this.lyricsContainer.appendChild(loading);
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    const error = document.createElement('div');
    error.textContent = message;
    Object.assign(error.style, {
      textAlign: 'center',
      padding: '40px',
      fontSize: '16px',
      color: 'rgba(255, 100, 100, 0.9)'
    });

    this.lyricsContainer.appendChild(error);
  }

  /**
   * Remove the panel and clean up resources
   */
  removePanel() {
    // Create a new maid for the next panel instance
    // This destroys all tracked listeners, timeouts, etc.
    this._maid.Destroy();
    this._maid = new Maid();

    // Remove injected style element for lyrics container
    if (this._lyricsStyleElement && this._lyricsStyleElement.parentNode) {
      try { this._lyricsStyleElement.parentNode.removeChild(this._lyricsStyleElement); } catch (e) { }
      this._lyricsStyleElement = null;
    }

    // Clear cached refs and timeouts
    this._cachedLines = null;
    if (this._scrollTimeout) {
      try { clearTimeout(this._scrollTimeout); } catch (e) { }
      this._scrollTimeout = null;
    }

    // Cancel any pending rAF
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Cancel scroll animation
    if (this._scrollAnimationId) {
      cancelAnimationFrame(this._scrollAnimationId);
      this._scrollAnimationId = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
      this.panel = null;
      this.lyricsContainer = null;
      this.controlsContainer = null;
    }

    // Clear word index tracking
    this._lastWordIndexMap.clear();
    this._lastScrollIndex = -1;
  }

  /**
   * Full cleanup - call when destroying the UI entirely
   */
  destroy() {
    this.removePanel();
    this.removeVideoPlayerControls();
    
    // Clear signals
    this.OnSeekRequest.Clear();
    this.OnSettingsChange.Clear();
    this.OnModeChange.Clear();
  }

  /**
   * Remove video player controls
   */
  removeVideoPlayerControls() {
    const container = document.querySelector('#lyrics-video-controls-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * Check if panel exists
   */
  exists() {
    return this.panel !== null && document.contains(this.panel);
  }

  /**
   * Display lyrics (wrapper for synced/plain)
   */
  displayLyrics(lyrics) {
    if (Array.isArray(lyrics)) {
      this.displaySyncedLyrics(lyrics);
    } else if (typeof lyrics === 'string') {
      this.displayPlainLyrics(lyrics);
    }
  }

  /**
   * Set font size
   */
  setFontSize(size) {
    this.currentFontSize = size; // Store the current font size

    if (this.lyricsContainer) {
      // Set base font size
      this.lyricsContainer.style.setProperty('--lyrics-font-size', `${size}px`);
      this.lyricsContainer.style.setProperty('--lyrics-current-font-size', `${size * 1.5}px`);
      this.lyricsContainer.style.setProperty('--lyrics-past-font-size', `${size * 0.95}px`);

      // Also update all lyric lines directly
      const lyricLines = this.lyricsContainer.querySelectorAll('.lyric-line');
      lyricLines.forEach(line => {
        if (line.classList.contains('current')) {
          line.style.fontSize = `${size * 1.5}px`;
        } else if (line.classList.contains('past')) {
          line.style.fontSize = `${size * 0.95}px`;
        } else {
          line.style.fontSize = `${size}px`;
        }
      });
    }
  }

  /**
   * Create song selector dropdown
   */
  createSongSelector(results, onSelect) {
    if (!this.controlsContainer || !results || results.length <= 1) return;

    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const label = document.createElement('label');
    label.textContent = 'Song Version:';
    Object.assign(label.style, {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '500'
    });

    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      outline: 'none'
    });

    results.forEach((result, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${result.trackName} - ${result.artistName}${result.albumName ? ' (' + result.albumName + ')' : ''}`;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      const selectedIndex = parseInt(e.target.value);
      if (onSelect) {
        onSelect(results[selectedIndex]);
      }
    });

    container.appendChild(label);
    container.appendChild(select);
    this.controlsContainer.appendChild(container);
  }

  /**
   * Create background mode selector
   */
  createBackgroundSelector(currentMode, currentTheme, onChange) {
    if (!this.controlsContainer) return;

    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });

    const label = document.createElement('label');
    label.textContent = 'Background:';
    Object.assign(label.style, {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '500'
    });

    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      outline: 'none'
    });

    const modes = [
      { value: 'album', label: 'Album Art' },
      { value: 'gradient', label: 'Gradient' },
      { value: 'vinyl', label: 'Vinyl Disc' },
      { value: 'none', label: 'None' }
    ];

    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.label;
      option.selected = mode.value === currentMode;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      if (onChange) {
        onChange(e.target.value, currentTheme);
      }
    });

    container.appendChild(label);
    container.appendChild(select);
    this.controlsContainer.appendChild(container);
  }

  /**
   * Create fullscreen button
   */
  createFullscreenButton(onToggle) {
    if (!this.controlsContainer) return;

    const button = document.createElement('button');
    button.textContent = '⛶ Fullscreen';
    Object.assign(button.style, {
      padding: '8px 16px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.2s',
      flex: '1'
    });

    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'scale(1.02)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', () => {
      if (onToggle) {
        onToggle();
      }
    });

    this.controlsContainer.appendChild(button);
  }

  /**
   * Create video player controls
   */
  createVideoPlayerControls(onFullscreen, onTogglePanel, settings) {
    // Store settings reference for real-time updates
    this.settingsRef = settings;

    // Remove existing buttons if present
    const existingContainer = document.querySelector('#lyrics-video-controls-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Find YouTube's video controls container
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) {
      return;
    }

    // Create container for buttons
    const container = document.createElement('div');
    container.id = 'lyrics-video-controls-container';
    container.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-right: 8px; position: relative;';

    // Create settings button with lyrics icon
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'lyrics-settings-btn';
    settingsBtn.className = 'ytp-button';
    settingsBtn.setAttribute('aria-label', 'Lyrics Settings');
    settingsBtn.setAttribute('title', 'Lyrics Settings');
    settingsBtn.style.cssText = 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; border: none; color: white; opacity: 0.9;';

    // Create lyrics note icon SVG
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.style.width = '24px';
    iconSvg.style.height = '24px';

    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z');
    iconPath.setAttribute('fill', 'currentColor');

    iconSvg.appendChild(iconPath);
    settingsBtn.appendChild(iconSvg);

    // Assemble container first so it exists before creating panel
    container.appendChild(settingsBtn);

    // Create settings popup panel (pass container to avoid null reference)
    const settingsPanel = this.createSettingsPanel(settings, onFullscreen, onTogglePanel, container);
    settingsPanel.style.display = 'none';
    container.appendChild(settingsPanel);

    // Toggle settings panel (track listeners for cleanup)
    this.addListener(settingsBtn, 'click', (e) => {
      e.stopPropagation();
      const isVisible = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = isVisible ? 'none' : 'block';
      settingsBtn.style.opacity = isVisible ? '0.9' : '1';
    });

    this.addListener(settingsBtn, 'mouseenter', () => {
      if (settingsPanel.style.display === 'none') {
        settingsBtn.style.opacity = '1';
      }
    });

    this.addListener(settingsBtn, 'mouseleave', () => {
      if (settingsPanel.style.display === 'none') {
        settingsBtn.style.opacity = '0.9';
      }
    });

    // Close panel when clicking outside (tracked)
    this.addListener(document, 'click', (e) => {
      if (!container.contains(e.target)) {
        settingsPanel.style.display = 'none';
        settingsBtn.style.opacity = '0.9';
      }
    });

    // Insert at the beginning of right controls
    rightControls.insertBefore(container, rightControls.firstChild);

    return { settingsBtn, settingsPanel, container };
  }

  /**
   * Create YouTube-style settings popup panel
   */
  createSettingsPanel(settings, onFullscreen, onTogglePanel, container) {
    const panel = document.createElement('div');
    panel.id = 'lyrics-settings-panel';
    panel.style.cssText = `
      position: absolute;
      bottom: 48px;
      right: 0;
      width: 272px;
      background: rgba(28, 28, 28, 0.97);
      border-radius: 2px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      color: #eee;
    `;

    // Create menu items - simplified settings
    const menuItems = [
      {
        type: 'button',
        label: 'Fullscreen karaoke',
        icon: '⛶',
        onClick: () => {
          panel.style.display = 'none';
          if (onFullscreen) onFullscreen();
        }
      },
      { type: 'separator' },
      {
        type: 'range',
        label: 'Font size',
        currentValue: (settings?.fontSize || 16) + 'px',
        min: 12,
        max: 24,
        value: settings?.fontSize || 16,
        onChange: (value) => {
          if (settings?.onFontSizeChange) {
            settings.onFontSizeChange(value);
            if (this.settingsRef) this.settingsRef.fontSize = value;
          }
          return value + 'px';
        }
      },
      {
        type: 'range',
        label: 'Sync offset',
        currentValue: (settings?.syncDelay || 0) + 'ms',
        min: -2000,
        max: 2000,
        value: settings?.syncDelay || 0,
        step: 50,
        onChange: (value) => {
          if (settings?.onSyncDelayChange) {
            settings.onSyncDelayChange(value);
            if (this.settingsRef) this.settingsRef.syncDelay = value;
          }
          return value + 'ms';
        }
      },
      { type: 'separator' },
      {
        type: 'toggle',
        label: 'Romanization',
        checked: settings?.showRomanization === true,
        onChange: (checked) => {
          if (this.settingsRef) this.settingsRef.showRomanization = checked;
          if (settings?.onRomanizationChange) settings.onRomanizationChange(checked);
        }
      }
    ];


    menuItems.forEach((item, idx) => {
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: rgba(255, 255, 255, 0.1); margin: 4px 0;';
        panel.appendChild(separator);
        return;
      }

      const menuItem = document.createElement('div');
      menuItem.setAttribute('data-menu-item', 'true');
      menuItem.style.cssText = `
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.1s;
        min-height: 40px;
      `;

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'transparent';
      });

      const label = document.createElement('div');
      label.textContent = item.label;
      label.style.cssText = 'flex: 1; font-size: 13px;';
      menuItem.appendChild(label);

      if (item.type === 'button') {
        if (item.checked !== undefined) {
          const checkmark = document.createElement('div');
          checkmark.textContent = '✓';
          checkmark.style.cssText = `font-size: 16px; opacity: ${item.checked ? '1' : '0'};`;
          menuItem.appendChild(checkmark);

          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.onClick) item.onClick();
          });
        } else {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.onClick) item.onClick();
          });
        }
      } else if (item.type === 'range') {
        menuItem.style.flexDirection = 'column';
        menuItem.style.alignItems = 'stretch';
        menuItem.style.cursor = 'default';
        menuItem.style.padding = '12px 16px';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';

        const labelDiv = document.createElement('div');
        labelDiv.textContent = item.label;
        labelDiv.style.fontSize = '13px';

        const valueDiv = document.createElement('div');
        valueDiv.textContent = item.currentValue;
        valueDiv.style.cssText = 'font-size: 13px; opacity: 0.6;';

        topRow.appendChild(labelDiv);
        topRow.appendChild(valueDiv);

        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'position: relative; height: 4px; background: rgba(255, 255, 255, 0.2); border-radius: 2px;';

        const sliderFill = document.createElement('div');
        const percentage = ((item.value - item.min) / (item.max - item.min)) * 100;
        sliderFill.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; width: ${percentage}%; background: #f00; border-radius: 2px;`;

        const sliderThumb = document.createElement('div');
        sliderThumb.style.cssText = `position: absolute; top: 50%; left: ${percentage}%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #f00; border-radius: 50%; cursor: pointer;`;

        sliderContainer.appendChild(sliderFill);
        sliderContainer.appendChild(sliderThumb);

        let isDragging = false;
        let currentValue = item.value;

        sliderThumb.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          isDragging = true;
        });

        this.addListener(document, 'mousemove', (e) => {
          if (isDragging) {
            const rect = sliderContainer.getBoundingClientRect();
            let percentage = ((e.clientX - rect.left) / rect.width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));

            const value = Math.round(item.min + (percentage / 100) * (item.max - item.min));
            const step = item.step || 1;
            const steppedValue = Math.round(value / step) * step;

            const newPercentage = ((steppedValue - item.min) / (item.max - item.min)) * 100;
            sliderFill.style.width = newPercentage + '%';
            sliderThumb.style.left = newPercentage + '%';

            // Store current value and only update display text
            currentValue = steppedValue;
            const displayText = item.label.includes('Font') ? steppedValue + 'px' : steppedValue + 'ms';
            valueDiv.textContent = displayText;
          }
        });

        this.addListener(document, 'mouseup', (e) => {
          if (isDragging) {
            isDragging = false;
            // Apply the setting only on mouseup to prevent lag
            if (item.onChange) {
              const displayValue = item.onChange(currentValue);
              valueDiv.textContent = displayValue;
            }
          }
        });

        sliderContainer.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = sliderContainer.getBoundingClientRect();
          let percentage = ((e.clientX - rect.left) / rect.width) * 100;
          percentage = Math.max(0, Math.min(100, percentage));

          const value = Math.round(item.min + (percentage / 100) * (item.max - item.min));
          const step = item.step || 1;
          const steppedValue = Math.round(value / step) * step;

          const newPercentage = ((steppedValue - item.min) / (item.max - item.min)) * 100;
          sliderFill.style.width = newPercentage + '%';
          sliderThumb.style.left = newPercentage + '%';

          // Apply immediately on click
          if (item.onChange) {
            const displayValue = item.onChange(steppedValue);
            valueDiv.textContent = displayValue;
          }
        });

        menuItem.replaceChildren(topRow, sliderContainer);
      } else if (item.type === 'submenu') {
        const valueDiv = document.createElement('div');
        valueDiv.textContent = item.currentValue;
        valueDiv.style.cssText = 'font-size: 13px; opacity: 0.6; display: flex; align-items: center; gap: 4px;';

        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.fontSize = '16px';
        valueDiv.appendChild(arrow);

        menuItem.appendChild(valueDiv);

        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          // Create submenu
          const submenu = this.createSubmenu(item.label, item.options, item.selected, (value) => {
            // Update display based on submenu type
            if (item.label === 'Background') {
              valueDiv.textContent = this.getBackgroundLabel(value);
            } else if (item.label === 'Highlight mode') {
              valueDiv.textContent = this.getHighlightLabel(value);
            } else if (item.label === 'Gradient theme') {
              valueDiv.textContent = this.getGradientThemeLabel(value);
            } else if (item.label === 'Romanization') {
              valueDiv.textContent = (value === true) ? 'On' : 'Off';
            } else if (item.label === 'Hide original lyrics') {
              valueDiv.textContent = (value === true) ? 'On' : 'Off';
            } else {
              valueDiv.textContent = value;
            }
            valueDiv.appendChild(arrow);
            if (item.onChange) {
              item.onChange(value);
              // Update stored settings
              if (this.settingsRef) {
                if (item.label === 'Background') {
                  this.settingsRef.backgroundMode = value;
                } else if (item.label === 'Highlight mode') {
                  this.settingsRef.highlightMode = value;
                } else if (item.label === 'Gradient theme') {
                  this.settingsRef.gradientTheme = value;
                } else if (item.label === 'Romanization') {
                  this.settingsRef.showRomanization = (value === true);
                } else if (item.label === 'Hide original lyrics') {
                  this.settingsRef.hideOriginalLyrics = (value === true);
                }
              }
            }
            submenu.remove();
          });
          panel.style.display = 'none';
          container.appendChild(submenu);
        });
      } else if (item.type === 'toggle') {
        // Simple toggle switch
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = 'display: flex; align-items: center;';

        const toggleSwitch = document.createElement('div');
        toggleSwitch.style.cssText = `
          width: 36px;
          height: 20px;
          background: ${item.checked ? '#f00' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 10px;
          position: relative;
          transition: background 0.2s;
          cursor: pointer;
        `;

        const toggleKnob = document.createElement('div');
        toggleKnob.style.cssText = `
          width: 16px;
          height: 16px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: ${item.checked ? '18px' : '2px'};
          transition: left 0.2s;
        `;

        toggleSwitch.appendChild(toggleKnob);
        toggleContainer.appendChild(toggleSwitch);
        menuItem.appendChild(toggleContainer);

        let isChecked = item.checked;

        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          isChecked = !isChecked;

          // Update visual
          toggleSwitch.style.background = isChecked ? '#f00' : 'rgba(255, 255, 255, 0.2)';
          toggleKnob.style.left = isChecked ? '18px' : '2px';

          // Fire callback
          if (item.onChange) {
            item.onChange(isChecked);
          }
        });
      }

      panel.appendChild(menuItem);
    });


    return panel;
  }

  /**
   * Create submenu for options
   */
  createSubmenu(title, options, selected, onChange) {
    const submenu = document.createElement('div');
    submenu.style.cssText = `
      position: absolute;
      bottom: 48px;
      right: 0;
      width: 272px;
      background: rgba(28, 28, 28, 0.97);
      border-radius: 2px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      color: #eee;
    `;

    // Back button
    const backBtn = document.createElement('div');
    backBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.1);';

    const backArrow = document.createElement('span');
    backArrow.textContent = '‹';
    backArrow.style.fontSize = '20px';

    const backLabel = document.createElement('span');
    backLabel.textContent = title;
    backLabel.style.fontSize = '13px';

    backBtn.appendChild(backArrow);
    backBtn.appendChild(backLabel);

    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'transparent';
    });

    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      submenu.remove();
      document.querySelector('#lyrics-settings-panel').style.display = 'block';
    });

    submenu.appendChild(backBtn);

    // Options
    options.forEach(option => {
      const optionItem = document.createElement('div');
      optionItem.setAttribute('data-option', 'true');
      optionItem.style.cssText = `
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.1s;
        min-height: 40px;
      `;

      const optionLabel = document.createElement('div');
      optionLabel.textContent = option.label;
      optionLabel.style.fontSize = '13px';

      const checkmark = document.createElement('div');
      checkmark.textContent = '✓';
      // Use loose equality to handle boolean/string comparisons correctly
      const isSelected = (option.value == selected) || (option.value === selected);
      checkmark.style.cssText = `font-size: 16px; opacity: ${isSelected ? '1' : '0'};`;

      optionItem.appendChild(optionLabel);
      optionItem.appendChild(checkmark);

      optionItem.addEventListener('mouseenter', () => {
        optionItem.style.background = 'rgba(255, 255, 255, 0.1)';
      });

      optionItem.addEventListener('mouseleave', () => {
        optionItem.style.background = 'transparent';
      });

      optionItem.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update all checkmarks
        const allCheckmarks = submenu.querySelectorAll('div[data-option]');
        allCheckmarks.forEach((item, idx) => {
          const check = item.querySelector('div:last-child');
          if (check) {
            // Use loose equality to handle boolean/string comparisons correctly
            const isMatch = (options[idx].value == option.value) || (options[idx].value === option.value);
            check.style.opacity = isMatch ? '1' : '0';
          }
        });
        if (onChange) onChange(option.value);
      });

      submenu.appendChild(optionItem);
    });

    return submenu;
  }

  /**
   * Get background mode label
   */
  getBackgroundLabel(mode) {
    const labels = {
      'album': 'Album art',
      'gradient': 'Gradient',
      'video': 'Video thumbnail',
      'none': 'None'
    };
    return labels[mode] || 'Album art';
  }

  /**
   * Get highlight mode label
   */
  getHighlightLabel(mode) {
    const labels = {
      'line': 'Full line',
      'word': 'Word by word'
    };
    return labels[mode] || 'Full line';
  }

  /**
   * Get gradient theme label
   */
  getGradientThemeLabel(theme) {
    const labels = {
      'sunset': 'Sunset',
      'ocean': 'Ocean',
      'forest': 'Forest',
      'fire': 'Fire',
      'purple': 'Purple Dream',
      'cool': 'Cool Blues',
      'warm': 'Warm Sunset',
      'northern': 'Northern Lights',
      'peach': 'Peach',
      'neon': 'Neon'
    };
    return labels[theme] || 'Sunset';
  }

  /**
   * Update settings in the panel (for external changes)
   */
  updateSettingsDisplay(newSettings) {
    if (this.settingsRef) {
      Object.assign(this.settingsRef, newSettings);
    }
  }

  /**
   * Update lyric in specific container
   */
  updateLyricInContainer(container, index, lyric) {
    if (!container) return;

    const lines = container.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
      if (i === index) {
        line.classList.add('current');
        line.classList.remove('past', 'future');
        line.style.opacity = '1';
        line.style.transform = 'scale(1.15)';
      } else if (i < index) {
        line.classList.add('past');
        line.classList.remove('current', 'future');
        line.style.opacity = '0.4';
        line.style.transform = 'scale(1)';
      } else {
        line.classList.add('future');
        line.classList.remove('current', 'past');
        line.style.opacity = '0.6';
        line.style.transform = 'scale(1)';
      }
    });
  }

  /**
   * Display lyrics in specific container
   */
  displayLyricsInContainer(container, lyrics) {
    if (!container) return;

    container.replaceChildren();
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;

    lyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyric-line future';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;
      lyricLine.textContent = lyric.text;

      Object.assign(lyricLine.style, {
        padding: '20px 30px',
        fontSize: '20px',
        lineHeight: '1.8',
        color: 'rgba(255, 255, 255, 0.6)',
        transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`,
        transform: 'scale(1)',
        fontWeight: '400',
        textAlign: 'center'
      });

      container.appendChild(lyricLine);
    });
  }
}
