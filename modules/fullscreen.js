/**
 * Fullscreen Module - Handles fullscreen karaoke mode
 * Uses Maid for resource cleanup and Signal for event handling
 */

import { ColorExtractor } from './color-utils.js';
import { Maid } from './utils/Maid.js';
import { Signal } from './utils/Signal.js';
import { LyricsRenderer } from './lyrics/LyricsRenderer.js';

export class FullscreenManager {
  constructor(backgroundManager) {
    // Initialize Maid for resource cleanup
    this._maid = new Maid();
    
    this.backgroundManager = backgroundManager;
    this.settings = null;
    this.overlay = null;
    this.lyricsContainer = null;
    this.metadataOverlay = null;
    this.isActive = false;
    this.keyboardHandler = null;
    this.highlightMode = 'line'; // 'line' or 'word'
    this.metadataVisible = true;
    this.metadataHideTimeout = null;
    
    // Signals for event communication
    this.OnExit = new Signal();
    this.OnSeekRequest = new Signal();
    this.OnModeChange = new Signal();
    
    // LyricsRenderer instance (used when _useRenderer is true)
    this._lyricsRenderer = null;
    this._useRenderer = true; // Use modular LyricsRenderer for shared code with regular panel
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
   * Set highlight mode
   */
  setHighlightMode(mode) {
    this.highlightMode = mode;
  }

  /**
   * Enter fullscreen mode
   */
  enter(lyrics, currentIndex = -1, imageUrl = null, settings = null, songTitle = '', artistName = '') {
    if (this.isActive) return;

    // Store settings for this fullscreen session
    this.settings = settings;

    // Create fullscreen overlay
    this.overlay = this.createOverlay();

    // Create lyrics container
    this.lyricsContainer = document.createElement('div');
    this.lyricsContainer.id = 'fullscreen-lyrics-container';
    this.lyricsContainer.style.cssText = `
      position: relative;
      z-index: 10;
      width: 80%;
      max-width: 900px;
      height: 80%;
      overflow-y: scroll;
      overflow-x: hidden;
      padding: 40px;
      box-sizing: border-box;
    `;

    // Hide scrollbar and apply Apple Music fullscreen lyrics styles
    const style = document.createElement('style');
    style.textContent = `
      #fullscreen-lyrics-container::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      #fullscreen-lyrics-container {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      }
      
      /* LyricsRenderer scroll container inside fullscreen */
      #fullscreen-lyrics-container .LyricsScrollContainer {
        flex: 1;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 0 20px;
      }
      #fullscreen-lyrics-container .LyricsScrollContainer::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      /* Spacers for centering lyrics in fullscreen */
      #fullscreen-lyrics-container .lyrics-spacer-top,
      #fullscreen-lyrics-container .lyrics-spacer-bottom {
        height: 40vh;
        min-height: 40vh;
      }
      
      /* Current line enter animation - only this line animates */
      @keyframes current-line-enter {
        0% {
          transform: translateY(8px);
          opacity: 0.7;
          padding-top: 0.6rem;
          padding-bottom: 0.6rem;
        }
        100% {
          transform: translateY(0);
          opacity: 1;
          padding-top: 1.5rem;
          padding-bottom: 1.5rem;
        }
      }
      
      /* Apple Music Fullscreen Typography */
      #fullscreen-lyrics-container .lyric-line,
      #fullscreen-lyrics-container .VocalsGroup {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
        font-size: 2.5rem !important;
        font-weight: 700 !important;
        line-height: 1.3 !important;
        letter-spacing: -0.02em !important;
        color: rgba(255, 248, 230, 0.35) !important;
        padding: 0.6rem 0 !important;
        text-align: left !important;
        font-style: normal !important;
        transition: 
          color 0.3s ease,
          padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1),
          padding-bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      
      /* Current line - ONLY this animates */
      #fullscreen-lyrics-container .lyric-line.lyric-current,
      #fullscreen-lyrics-container .VocalsGroup.lyric-current {
        color: #fff8e6 !important;
        text-align: left !important;
        font-style: normal !important;
        padding-top: 1.5rem !important;
        padding-bottom: 1.5rem !important;
        animation: current-line-enter 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      }
      
      /* Past lines - gap closes via transition */
      #fullscreen-lyrics-container .lyric-line.lyric-past,
      #fullscreen-lyrics-container .VocalsGroup.lyric-past {
        color: rgba(255, 248, 230, 0.85) !important;
        text-align: left !important;
        font-style: normal !important;
        padding-top: 0.6rem !important;
        padding-bottom: 0.6rem !important;
        transform: translateY(0) !important;
      }
      
      /* Future lines - static */
      #fullscreen-lyrics-container .lyric-line.lyric-future,
      #fullscreen-lyrics-container .VocalsGroup.lyric-future {
        color: rgba(255, 248, 230, 0.35) !important;
        text-align: left !important;
        font-style: normal !important;
        padding-top: 0.6rem !important;
        padding-bottom: 0.6rem !important;
      }
      
      /* Word highlighting for fullscreen - inherit size from parent */
      #fullscreen-lyrics-container .lyric-word {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        font-style: inherit !important;
      }
      
      /* Lyrics text container */
      #fullscreen-lyrics-container .lyric-text {
        font-size: inherit !important;
        font-weight: inherit !important;
      }
      
      /* Romanization text in fullscreen */
      #fullscreen-lyrics-container .romanization-text {
        font-size: 1.25rem !important;
        font-weight: 500 !important;
        color: rgba(255, 255, 255, 0.6) !important;
        font-style: italic !important;
        margin-top: 0.25rem !important;
      }
    `;
    this.overlay.appendChild(style);

    // Add background with gradient extracted from album art
    const bgContainer = document.createElement('div');
    bgContainer.id = 'fullscreen-background';
    bgContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 0;
      overflow: hidden;
    `;

    // Extract colors from album art and create Apple Music-style gradient
    if (imageUrl) {
      this.setupGradientBackground(bgContainer, imageUrl);
    } else if (this.backgroundManager) {
      this.backgroundManager.updateFullscreenBackground(bgContainer, imageUrl);
    } else {
      bgContainer.style.background = 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)';
    }

    this.overlay.appendChild(bgContainer);

    // Create Apple Music-style split layout container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      position: relative;
      z-index: 10;
      width: 90%;
      max-width: 1400px;
      height: 85%;
      display: flex;
      gap: 3rem;
      align-items: center;
    `;

    // Left Panel: Album art and metadata
    if (songTitle || artistName || imageUrl) {
      const leftPanel = document.createElement('div');
      leftPanel.id = 'fullscreen-left-panel';
      leftPanel.style.cssText = `
        flex-shrink: 0;
        width: 400px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
      `;

      // Album cover
      if (imageUrl) {
        const albumCover = document.createElement('img');
        albumCover.src = imageUrl;
        albumCover.alt = 'Album Cover';
        albumCover.style.cssText = `
          width: 350px;
          height: 350px;
          object-fit: cover;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        `;
        leftPanel.appendChild(albumCover);
      }

      // Metadata container
      const metadataContainer = document.createElement('div');
      metadataContainer.style.cssText = `
        width: 100%;
        text-align: center;
      `;

      // Song title
      if (songTitle) {
        const title = document.createElement('div');
        title.textContent = songTitle;
        title.style.cssText = `
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.3;
          letter-spacing: -0.02em;
          margin-bottom: 0.75rem;
        `;
        metadataContainer.appendChild(title);
      }

      // Artist name
      if (artistName) {
        const artist = document.createElement('div');
        artist.textContent = artistName;
        artist.style.cssText = `
          font-size: 20px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          letter-spacing: 0.02em;
        `;
        metadataContainer.appendChild(artist);
      }

      leftPanel.appendChild(metadataContainer);
      contentContainer.appendChild(leftPanel);
    }

    // Right Panel: Lyrics - set as flex container for LyricsRenderer
    this.lyricsContainer.style.cssText = `
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0;
      box-sizing: border-box;
    `;

    contentContainer.appendChild(this.lyricsContainer);
    this.overlay.appendChild(contentContainer);

    // Display lyrics in fullscreen container
    if (lyrics && Array.isArray(lyrics)) {
      this.displayLyricsInFullscreen(lyrics);
      if (currentIndex >= 0) {
        // Wait for layout to settle before highlighting and scrolling
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.updateCurrentLyric(currentIndex);
          });
        });
      }
    }

    // Add to DOM
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      this.overlay.style.opacity = '1';
    });

    // Hide YouTube video player
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer) {
      moviePlayer.style.opacity = '0.1';
      moviePlayer.style.pointerEvents = 'none';
    }

    // Setup keyboard handler
    this.setupKeyboardHandler();

    this.isActive = true;
  }

  /**
   * Exit fullscreen mode
   */
  exit() {
    if (!this.isActive || !this.overlay) return;

    // Clean up all tracked resources via Maid
    this._maid.Destroy();
    this._maid = new Maid();

    // Cancel metadata auto-hide timeout
    if (this.metadataHideTimeout) {
      clearTimeout(this.metadataHideTimeout);
      this.metadataHideTimeout = null;
    }

    // Fade out
    this.overlay.style.opacity = '0';

    setTimeout(() => {
      // Remove from DOM
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }

      // Restore YouTube video player
      const moviePlayer = document.querySelector('#movie_player');
      if (moviePlayer) {
        moviePlayer.style.opacity = '1';
        moviePlayer.style.pointerEvents = 'auto';
      }

      this.overlay = null;
      this.lyricsContainer = null;
      this.metadataOverlay = null;
      this.isActive = false;

      // Fire exit signal for listeners
      this.OnExit.Fire();
    }, 300);
  }

  /**
   * Toggle fullscreen mode
   */
  toggle(lyrics, currentIndex, imageUrl) {
    if (this.isActive) {
      this.exit();
    } else {
      this.enter(lyrics, currentIndex, imageUrl);
    }
  }

  /**
   * Create fullscreen overlay element
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'lyrics-fullscreen-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
    `;

    return overlay;
  }

  /**
   * Setup keyboard event handler using Maid for cleanup
   */
  setupKeyboardHandler() {
    this.keyboardHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.exit();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        const videoElement = document.querySelector('video');
        if (videoElement) {
          if (videoElement.paused) {
            videoElement.play();
          } else {
            videoElement.pause();
          }
        }
      }
    };

    // Use Maid to track the listener for automatic cleanup
    this._maid.GiveListener(document, 'keydown', this.keyboardHandler);
  }

  /**
   * Get the lyrics container element
   */
  getLyricsContainer() {
    return this.lyricsContainer;
  }

  /**
   * Set callback for when fullscreen exits
   * Now uses Signal for cleaner event handling
   * @param {Function} callback - Function to call on exit
   * @returns {Function} Disconnect function to remove the listener
   */
  onExit(callback) {
    return this.OnExit.Connect(callback);
  }

  /**
   * Update background in fullscreen mode
   */
  updateBackground(imageUrl) {
    if (!this.isActive) return;

    const bgContainer = document.getElementById('fullscreen-background');
    if (bgContainer) {
      if (imageUrl) {
        this.setupGradientBackground(bgContainer, imageUrl);
      } else if (this.backgroundManager) {
        this.backgroundManager.updateFullscreenBackground(bgContainer, imageUrl);
      }
    }
  }

  /**
   * Setup Apple Music-style gradient background from album art colors
   */
  async setupGradientBackground(container, imageUrl) {
    // Set a dark fallback first
    container.style.background = 'linear-gradient(180deg, #2a2a2a 0%, #0a0a0a 100%)';
    
    try {
      const colors = await ColorExtractor.extractDominantColors(imageUrl, 3);
      if (colors && colors.length > 0) {
        // Create vertical gradient like Apple Music (color at top fading to dark at bottom)
        const primaryColor = colors[0];
        const secondaryColor = colors[1] || colors[0];
        
        // Parse RGB values
        const parseRgb = (rgbStr) => {
          const match = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
          return { r: 30, g: 30, b: 30 };
        };
        
        const primary = parseRgb(primaryColor);
        const secondary = parseRgb(secondaryColor);
        
        // Create Apple Music style gradient - vibrant at top, dark at bottom
        container.style.background = `linear-gradient(
          180deg, 
          rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.9) 0%,
          rgba(${Math.floor(primary.r * 0.6)}, ${Math.floor(primary.g * 0.6)}, ${Math.floor(primary.b * 0.6)}, 0.85) 30%,
          rgba(${Math.floor(secondary.r * 0.3)}, ${Math.floor(secondary.g * 0.3)}, ${Math.floor(secondary.b * 0.3)}, 0.9) 70%,
          rgba(10, 10, 12, 0.98) 100%
        )`;
        container.style.transition = 'background 0.5s ease';
      }
    } catch (error) {
      console.warn('Failed to extract colors for fullscreen background:', error);
    }
  }

  /**
   * Display lyrics in fullscreen container
   * Uses LyricsRenderer if _useRenderer is true, otherwise uses legacy rendering
   */
  displayLyricsInFullscreen(lyrics) {
    if (!this.lyricsContainer) return;

    // Clear cache when displaying new lyrics
    this._cachedFullscreenLines = null;

    // Destroy any existing renderer
    if (this._lyricsRenderer) {
      this._lyricsRenderer.Destroy();
      this._lyricsRenderer = null;
    }

    this.lyricsContainer.replaceChildren();

    // Use LyricsRenderer if enabled
    if (this._useRenderer) {
      this._displayWithRenderer(lyrics);
      return;
    }

    // Legacy rendering path
    this._displayLegacy(lyrics);
  }

  /**
   * Display lyrics using the modular LyricsRenderer
   * @private
   */
  _displayWithRenderer(lyrics) {
    try {
      // Don't create extra wrapper - pass lyricsContainer directly
      // LyricsRenderer creates its own scroll container
      // Remove scroll from parent to prevent nested scrolling
      this.lyricsContainer.style.overflow = 'hidden';
      
      this._lyricsRenderer = new LyricsRenderer(this.lyricsContainer, lyrics, {
        highlightMode: this.highlightMode,
        showRomanization: this.settings?.showRomanization || false,
        hideOriginalLyrics: this.settings?.hideOriginalLyrics || false,
        detectInterludes: true,
        interludeThreshold: 5
      });

      // Connect renderer's seek signal to our signal and video element
      this._lyricsRenderer.OnSeekRequest.Connect((time, index) => {
        this.OnSeekRequest.Fire(time, index);
        
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = time;
        }
      });

      console.log('[Fullscreen] Using LyricsRenderer for display');
    } catch (error) {
      console.warn('[Fullscreen] Failed to create LyricsRenderer, falling back to legacy:', error);
      this._lyricsRenderer = null;
      this._displayLegacy(lyrics);
    }
  }

  /**
   * Legacy display method for fullscreen lyrics
   * @private
   */
  _displayLegacy(lyrics) {
    // Re-enable scrolling for legacy mode
    this.lyricsContainer.style.overflow = 'auto';
    this.lyricsContainer.style.overflowY = 'scroll';
    this.lyricsContainer.style.overflowX = 'hidden';
    this.lyricsContainer.style.padding = '40px 20px';
    
    // Create wrapper for proper centering and scrolling
    const wrapper = document.createElement('div');
    wrapper.id = 'fullscreen-lyrics-wrapper';
    // Add padding to allow first/last lyrics to scroll to center
    wrapper.style.paddingTop = '40vh';
    wrapper.style.paddingBottom = '40vh';

    lyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'fullscreen-lyric-line future';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;

      // Apple Music style - simple, clean, left-aligned for future lines
      Object.assign(lyricLine.style, {
        padding: '12px 0',
        fontSize: '28px',
        lineHeight: '1.5',
        color: 'rgba(255, 248, 230, 0.35)',
        transition: 'all 0.3s ease, text-align 0.3s ease, font-style 0.3s ease',
        fontWeight: '700',
        textAlign: 'left',
        fontStyle: 'normal',
        cursor: 'pointer',
        letterSpacing: '-0.01em'
      });

      // Word-level timing: render each word and optional per-word romanization
      if (lyric.words && lyric.words.length > 0) {
        const wordsContainer = document.createElement('div');
        wordsContainer.className = 'fullscreen-words-container';

        lyric.words.forEach((wordData, wordIndex) => {
          const wrapper = document.createElement('span');
          wrapper.className = 'lyric-word-wrapper';
          wrapper.style.display = 'inline-block';
          wrapper.style.margin = '0 4px';

          const wordSpan = document.createElement('span');
          wordSpan.className = 'lyric-word future';
          wordSpan.textContent = wordData.word;
          wordSpan.dataset.wordIndex = wordIndex;
          wordSpan.dataset.wordTime = wordData.time;
          Object.assign(wordSpan.style, {
            display: 'inline-block',
            color: 'rgba(255,255,255,0.95)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            fontWeight: '400',
            transform: 'translateZ(0)',
            willChange: 'transform, color, filter'
          });

          wrapper.appendChild(wordSpan);

          // Per-word romanization (if available and enabled)
          if (this.settings?.showRomanization && wordData.roman) {
            const romanSmall = document.createElement('div');
            romanSmall.className = 'word-romanization';
            romanSmall.textContent = wordData.roman;
            Object.assign(romanSmall.style, {
              fontSize: '0.65em',
              opacity: '0.95',
              fontStyle: 'italic',
              marginTop: '4px',
              color: 'rgba(255,255,255,0.85)'
            });
            wrapper.appendChild(romanSmall);
          }

          wordsContainer.appendChild(wrapper);
        });

        lyricLine.appendChild(wordsContainer);

        // If a full-line romanized string exists, append it below words
        if (this.settings?.showRomanization && lyric.romanized) {
          const romanDiv = document.createElement('div');
          romanDiv.className = 'fullscreen-romanization';
          romanDiv.textContent = lyric.romanized;
          Object.assign(romanDiv.style, {
            marginTop: '10px',
            fontSize: '0.85em',
            opacity: '0.95',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.85)'
          });
          lyricLine.appendChild(romanDiv);
        }

      } else {
        // Line-by-line display
        const shouldHideOriginal = lyric.romanized && this.settings?.showRomanization && this.settings?.hideOriginalLyrics;

        if (!shouldHideOriginal) {
          const textDiv = document.createElement('div');
          textDiv.className = 'fullscreen-original-text';
          textDiv.textContent = lyric.text.replace(/<\d{2}:\d{2}\.\d+>/g, '').trim();
          Object.assign(textDiv.style, {
            color: 'rgba(255,255,255,0.9)'
          });
          lyricLine.appendChild(textDiv);
        }

        if (this.settings?.showRomanization && lyric.romanized) {
          const romanDiv = document.createElement('div');
          romanDiv.className = 'fullscreen-romanization';
          romanDiv.textContent = lyric.romanized;
          Object.assign(romanDiv.style, {
            marginTop: '8px',
            fontSize: shouldHideOriginal ? '1em' : '0.85em',
            opacity: shouldHideOriginal ? '1' : '0.95',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.95)'
          });
          lyricLine.appendChild(romanDiv);
        }

        // If only showing romanization and original was missing, ensure text content
        if (shouldHideOriginal && !lyric.romanized) {
          lyricLine.textContent = lyric.text;
        }
      }

      // Click to seek - track listener with Maid
      this._maid.GiveListener(lyricLine, 'click', () => {
        this.OnSeekRequest.Fire(lyric.time, index);
        
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = lyric.time;
        }
      });

      wrapper.appendChild(lyricLine);
    });

    this.lyricsContainer.appendChild(wrapper);
  }

  /**
   * Update current lyric highlight in fullscreen
   * If using LyricsRenderer, delegates to its Animate method
   */
  updateCurrentLyric(currentIndex, currentTime, indexChanged = true) {
    if (!this.lyricsContainer) return;

    // If using LyricsRenderer, use its animation system
    if (this._lyricsRenderer && this._useRenderer) {
      // LyricsRenderer.Animate expects (timestamp, deltaTime, skipped)
      this._lyricsRenderer.Animate(currentTime || 0, 1/60, indexChanged);
      return;
    }

    // Cache lines for performance
    if (indexChanged || !this._cachedFullscreenLines) {
      this._cachedFullscreenLines = this.lyricsContainer.querySelectorAll('.fullscreen-lyric-line');
    }

    const lyricLines = this._cachedFullscreenLines;

    // Batch DOM updates in RAF for smoothness
    if (indexChanged) {
      requestAnimationFrame(() => {
        lyricLines.forEach((line, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;

          if (isCurrent) {
            line.classList.add('current');
            line.classList.remove('past', 'future');

            // Apple Music style - bold cream, centered, italic, LARGER
            Object.assign(line.style, {
              color: '#fff8e6',
              fontSize: '40px',
              fontWeight: '700',
              textAlign: 'center',
              fontStyle: 'italic',
              transition: 'all 0.3s ease, text-align 0.3s ease, font-style 0.3s ease, font-size 0.3s ease',
              letterSpacing: '-0.01em'
            });

            // Force color override
            try {
              line.style.setProperty('color', '#fff8e6', 'important');
            } catch (e) { }

            // Ensure inner elements are fully visible
            const orig = line.querySelector('.fullscreen-original-text');
            if (orig) {
              orig.style.color = '#fff8e6';
            }
            const romanElems = line.querySelectorAll('.fullscreen-romanization, .word-romanization');
            romanElems.forEach(el => {
              el.style.color = 'rgba(255, 248, 230, 0.9)';
            });
            
            // Only set all words to white in LINE mode
            // In WORD mode, let word-level highlighting handle colors
            const wordSpans = line.querySelectorAll('.lyric-word');
            if (this.highlightMode === 'line') {
              wordSpans.forEach(w => {
                // Apply gradient-based coloring for line mode (fully highlighted)
                w.style.color = 'transparent';
                w.style.backgroundClip = 'text';
                w.style.webkitBackgroundClip = 'text';
                w.style.backgroundImage = 'linear-gradient(to right, #fff8e6 0%, #fff8e6 100%)';
                w.style.fontWeight = '700';
                w.style.setProperty('--word-progress', '100%');
              });
            } else {
              // In word mode, set initial state for words on current line
              // Past/current words will be updated by word-level highlighting
              // Future words should be dimmed
              wordSpans.forEach(w => {
                const wordState = w.dataset.state || 'future';
                if (wordState === 'future') {
                  const futureColor = 'rgba(255, 248, 230, 0.35)';
                  w.style.color = 'transparent';
                  w.style.backgroundClip = 'text';
                  w.style.webkitBackgroundClip = 'text';
                  w.style.backgroundImage = `linear-gradient(to right, ${futureColor} 0%, ${futureColor} 100%)`;
                  w.style.fontWeight = '700';
                  w.style.setProperty('--word-progress', '0%');
                }
              });
            }

            // Smooth scroll to center current line
            if (!this._scrollTimeout) {
              const containerRect = this.lyricsContainer.getBoundingClientRect();
              const lineRect = line.getBoundingClientRect();
              const containerScrollTop = this.lyricsContainer.scrollTop;

              const lineRelativeTop = lineRect.top - containerRect.top + containerScrollTop;
              const containerHeight = this.lyricsContainer.clientHeight;
              const lineHeight = line.offsetHeight;
              const scrollPosition = lineRelativeTop - (containerHeight / 2) + (lineHeight / 2);

              this.lyricsContainer.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
              });
            }
          } else {
            line.classList.remove('current');
            if (isPast) {
              line.classList.add('past');
              line.classList.remove('future');
            } else {
              line.classList.add('future');
              line.classList.remove('past');
            }

            // Apple Music style - past lines bright cream, future lines dimmed
            const fadedColor = isPast ? 'rgba(255, 248, 230, 0.85)' : 'rgba(255, 248, 230, 0.35)';

            Object.assign(line.style, {
              fontSize: '28px',
              fontWeight: '700',
              color: fadedColor,
              transition: 'all 0.3s ease, text-align 0.3s ease, font-style 0.3s ease',
              textAlign: 'left',
              fontStyle: 'normal',
              letterSpacing: '-0.01em'
            });

            // Dim inner elements for non-current lines
            const orig2 = line.querySelector('.fullscreen-original-text');
            if (orig2) {
              orig2.style.color = fadedColor;
            }
            const romanElems2 = line.querySelectorAll('.fullscreen-romanization, .word-romanization');
            romanElems2.forEach(el => {
              el.style.color = 'rgba(255, 248, 230, 0.5)';
            });
            const wordSpans2 = line.querySelectorAll('.lyric-word');
            wordSpans2.forEach(w => {
              // Apply gradient-based coloring for non-current lines
              w.style.color = 'transparent';
              w.style.backgroundClip = 'text';
              w.style.webkitBackgroundClip = 'text';
              w.style.backgroundImage = `linear-gradient(to right, ${fadedColor} 0%, ${fadedColor} 100%)`;
              w.style.fontWeight = '700';
              // Clear any word-level highlighting state
              w.classList.remove('highlighted', 'active');
              w.classList.add(isPast ? 'past' : 'future');
              w.dataset.state = isPast ? 'past' : 'future';
              w.style.setProperty('--word-progress', isPast ? '100%' : '0%');
              w.style.textShadow = 'none';
              w.style.transform = 'scale(1) translateZ(0)';
            });
          }
        });
      });
    }

    // Word-level updates (happens every frame for word mode)
    if (currentTime !== null && this.highlightMode === 'word') {
      const currentLine = lyricLines[currentIndex];

      // Cache words for the current line if index changed or cache missing
      if (indexChanged || !this._cachedCurrentLineWords || this._cachedCurrentLineIndex !== currentIndex) {
        if (currentLine) {
          this._cachedCurrentLineWords = Array.from(currentLine.querySelectorAll('.lyric-word'));
          // Pre-parse word times to avoid repeated parseFloat calls
          this._cachedWordTimes = this._cachedCurrentLineWords.map(w => parseFloat(w.dataset.wordTime) || 0);
          this._cachedCurrentLineIndex = currentIndex;
        } else {
          this._cachedCurrentLineWords = [];
          this._cachedWordTimes = [];
          this._cachedCurrentLineIndex = -1;
        }
        // Reset active word index when line changes
        this._lastActiveWordIndex = -1;
      }

      const words = this._cachedCurrentLineWords;
      const wordTimes = this._cachedWordTimes || [];
      if (words.length > 0) {
        // Binary search for current word index (optimized)
        let low = 0, high = words.length - 1, activeWordIndex = -1;
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const wTime = wordTimes[mid];
          if (wTime <= currentTime) {
            activeWordIndex = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        // Update words - always update progress for active word
        words.forEach((word, wordIndex) => {
          const wordTime = parseFloat(word.dataset.wordTime);

          // Check current state to avoid redundant style writes
          const currentState = word.dataset.state || 'future';
          let newState = 'future';

          if (wordIndex === activeWordIndex) {
            newState = 'active';
          } else if (wordIndex < activeWordIndex) {
            newState = 'past';
          } else {
            newState = 'future';
          }

          // Calculate progress for current word
          let progress = 0;
          if (newState === 'active') {
            const nextWord = words[wordIndex + 1];
            const wordEndTime = nextWord ? (parseFloat(nextWord.dataset.wordTime) || wordTime + 1) : wordTime + 1;
            const wordDuration = wordEndTime - wordTime;
            const elapsed = currentTime - wordTime;
            progress = Math.min(100, Math.max(0, (elapsed / wordDuration) * 100));
          } else if (newState === 'past') {
            progress = 100;
          }

          // Always update progress for active word (continuous animation), or update when state changes
          const needsUpdate = currentState !== newState || newState === 'active' || indexChanged;
          
          if (needsUpdate) {
            word.dataset.state = newState;
            word.style.setProperty('--word-progress', `${progress}%`);

            // Apply gradient-based progressive fill
            word.style.color = 'transparent';
            word.style.backgroundClip = 'text';
            word.style.webkitBackgroundClip = 'text';

            if (newState === 'active') { // Active word - progressive fill
              const highlightColor = '#fff8e6';
              const futureColor = 'rgba(255, 248, 230, 0.35)';
              word.style.backgroundImage = `linear-gradient(to right, ${highlightColor} 0%, ${highlightColor} ${progress}%, ${futureColor} ${progress}%, ${futureColor} 100%)`;
              word.style.textShadow = '0 0 20px rgba(255, 248, 230, 0.4)';
              word.style.transform = 'scale(1.02) translateZ(0)';
              word.style.fontWeight = '700';
              word.style.filter = 'blur(0px)';

            } else if (newState === 'past') { // Past word - fully filled, bright cream
              const pastColor = 'rgba(255, 248, 230, 0.85)';
              word.style.backgroundImage = `linear-gradient(to right, ${pastColor} 0%, ${pastColor} 100%)`;
              word.style.textShadow = 'none';
              word.style.transform = 'scale(1) translateZ(0)';
              word.style.fontWeight = '700';
              word.style.filter = 'blur(0px)';

            } else { // Future word - dimmed
              const futureColor = 'rgba(255, 248, 230, 0.35)';
              word.style.backgroundImage = `linear-gradient(to right, ${futureColor} 0%, ${futureColor} 100%)`;
              word.style.textShadow = 'none';
              word.style.transform = 'scale(1) translateZ(0)';
              word.style.fontWeight = '700';
              word.style.filter = 'blur(0px)';
            }
          }
        });
        
        // Update last active word index
        this._lastActiveWordIndex = activeWordIndex;
      }
    }
  }

  /**
   * Create metadata overlay with album cover, song title, and artist name
   */
  createMetadataOverlay(imageUrl, songTitle, artistName) {
    const overlay = document.createElement('div');
    overlay.id = 'fullscreen-metadata-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem;
      background: rgba(20, 20, 25, 0.85);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-width: 250px;
      opacity: 1;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(0);
    `;

    // Album cover
    if (imageUrl) {
      const albumCover = document.createElement('img');
      albumCover.src = imageUrl;
      albumCover.alt = 'Album Cover';
      albumCover.style.cssText = `
        width: 180px;
        height: 180px;
        object-fit: cover;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      `;
      overlay.appendChild(albumCover);
    }

    // Song info container
    const songInfo = document.createElement('div');
    songInfo.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    `;

    // Song title
    if (songTitle) {
      const title = document.createElement('div');
      title.textContent = songTitle;
      title.style.cssText = `
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        text-align: center;
        line-height: 1.3;
        letter-spacing: -0.02em;
      `;
      songInfo.appendChild(title);
    }

    // Artist name
    if (artistName) {
      const artist = document.createElement('div');
      artist.textContent = artistName;
      artist.style.cssText = `
        font-size: 14px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.65);
        text-align: center;
        letter-spacing: 0.02em;
      `;
      songInfo.appendChild(artist);
    }

    overlay.appendChild(songInfo);
    return overlay;
  }

  /**
   * Toggle metadata overlay visibility
   */
  toggleMetadataVisibility() {
    if (!this.metadataOverlay) return;

    this.metadataVisible = !this.metadataVisible;

    if (this.metadataVisible) {
      this.metadataOverlay.style.opacity = '1';
      this.metadataOverlay.style.transform = 'translateY(0)';
      this.metadataOverlay.style.pointerEvents = 'auto';
    } else {
      this.metadataOverlay.style.opacity = '0';
      this.metadataOverlay.style.transform = 'translateY(-20px)';
      this.metadataOverlay.style.pointerEvents = 'none';
    }

    // Cancel auto-hide if user manually toggles
    if (this.metadataHideTimeout) {
      clearTimeout(this.metadataHideTimeout);
      this.metadataHideTimeout = null;
    }
  }

  /**
   * Schedule metadata overlay to auto-hide after specified delay
   */
  scheduleMetadataAutoHide(delaySeconds) {
    // Clear existing timeout
    if (this.metadataHideTimeout) {
      clearTimeout(this.metadataHideTimeout);
    }

    // Schedule new timeout
    this.metadataHideTimeout = setTimeout(() => {
      if (this.metadataOverlay && this.metadataVisible) {
        this.metadataVisible = false;
        this.metadataOverlay.style.opacity = '0';
        this.metadataOverlay.style.transform = 'translateY(-20px)';
        this.metadataOverlay.style.pointerEvents = 'none';
      }
      this.metadataHideTimeout = null;
    }, delaySeconds * 1000);
  }

  /**
   * Cancel metadata auto-hide
   */
  cancelMetadataAutoHide() {
    if (this.metadataHideTimeout) {
      clearTimeout(this.metadataHideTimeout);
      this.metadataHideTimeout = null;
    }
  }
}
