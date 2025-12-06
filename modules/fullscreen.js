/**
 * Fullscreen Module - Handles fullscreen karaoke mode
 */

export class FullscreenManager {
  constructor(backgroundManager) {
    this.backgroundManager = backgroundManager;
    this.settings = null;
    this.overlay = null;
    this.lyricsContainer = null;
    this.isActive = false;
    this.keyboardHandler = null;
    this.onExitCallback = null;
    this.highlightMode = 'line'; // 'line' or 'word'
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
  enter(lyrics, currentIndex = -1, imageUrl = null, settings = null) {
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
    
    // Hide scrollbar for webkit browsers
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
      }
      #fullscreen-lyrics-wrapper {
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
    `;
    this.overlay.appendChild(style);
    
    // Add background
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
    
    if (this.backgroundManager) {
      this.backgroundManager.updateFullscreenBackground(bgContainer, imageUrl);
    }
    
    this.overlay.appendChild(bgContainer);
    this.overlay.appendChild(this.lyricsContainer);
    
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
      
      // Remove keyboard handler
      if (this.keyboardHandler) {
        document.removeEventListener('keydown', this.keyboardHandler);
        this.keyboardHandler = null;
      }
      
      this.overlay = null;
      this.lyricsContainer = null;
      this.isActive = false;
      
      // Call exit callback if set
      if (this.onExitCallback) {
        this.onExitCallback();
      }
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
   * Setup keyboard event handler
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
    
    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Get the lyrics container element
   */
  getLyricsContainer() {
    return this.lyricsContainer;
  }

  /**
   * Set callback for when fullscreen exits
   */
  onExit(callback) {
    this.onExitCallback = callback;
  }

  /**
   * Update background in fullscreen mode
   */
  updateBackground(imageUrl) {
    if (!this.isActive) return;
    
    const bgContainer = document.getElementById('fullscreen-background');
    if (bgContainer && this.backgroundManager) {
      this.backgroundManager.updateFullscreenBackground(bgContainer, imageUrl);
    }
  }

  /**
   * Display lyrics in fullscreen container
   */
  displayLyricsInFullscreen(lyrics) {
    if (!this.lyricsContainer) return;
    
    // Clear cache when displaying new lyrics
    this._cachedFullscreenLines = null;
    
    this.lyricsContainer.replaceChildren();
    
    // Create wrapper for proper centering and scrolling
    const wrapper = document.createElement('div');
    wrapper.id = 'fullscreen-lyrics-wrapper';
    
    lyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'fullscreen-lyric-line future';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;
      
      // Check if lyric has word-level timing
      if (lyric.words && lyric.words.length > 0) {
        // Create word-by-word display
        const wordsContainer = document.createElement('div');
        lyric.words.forEach((wordData, wordIndex) => {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'lyric-word future';
          wordSpan.textContent = wordData.word;
          wordSpan.dataset.wordIndex = wordIndex;
          wordSpan.dataset.wordTime = wordData.time;
          wordsContainer.appendChild(wordSpan);
          
          // Add space after word (except last word)
          if (wordIndex < lyric.words.length - 1) {
            wordsContainer.appendChild(document.createTextNode(' '));
          }
        });
        lyricLine.appendChild(wordsContainer);
        
        // Add romanization if enabled (for word-level timing)
        if (this.settings?.showRomanization && lyric.romanized) {
          const romanDiv = document.createElement('div');
          romanDiv.className = 'fullscreen-romanization';
          romanDiv.textContent = lyric.romanized;
          Object.assign(romanDiv.style, {
            marginTop: '8px',
            fontSize: '0.75em',
            opacity: '0.9',
            fontStyle: 'italic',
            color: 'inherit'
          });
          lyricLine.appendChild(romanDiv);
        }
      } else {
        // Regular line-by-line display
        const shouldHideOriginal = lyric.romanized && 
                                   this.settings?.showRomanization && 
                                   this.settings?.hideOriginalLyrics;
        
        if (!shouldHideOriginal) {
          const textDiv = document.createElement('div');
          textDiv.textContent = lyric.text;
          lyricLine.appendChild(textDiv);
        }
        
        // Add romanization if enabled
        if (this.settings?.showRomanization && lyric.romanized) {
          const romanDiv = document.createElement('div');
          romanDiv.className = 'fullscreen-romanization';
          romanDiv.textContent = lyric.romanized;
          Object.assign(romanDiv.style, {
            marginTop: '8px',
            fontSize: shouldHideOriginal ? '1em' : '0.75em',
            opacity: shouldHideOriginal ? '1' : '0.9',
            fontStyle: 'italic',
            color: 'inherit'
          });
          lyricLine.appendChild(romanDiv);
        }
        
        // If only showing romanization, set it as text content
        if (shouldHideOriginal && !lyric.romanized) {
          lyricLine.textContent = lyric.text;
        }
      }

      Object.assign(lyricLine.style, {
        padding: '20px 30px',
        fontSize: '32px',
        lineHeight: '1.8',
        color: 'rgba(255, 255, 255, 0.5)',
        transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease',
        transform: 'translateZ(0)',
        fontWeight: '400',
        textAlign: 'center',
        cursor: 'pointer',
        willChange: 'font-size, color'
      });

      // Click to seek
      lyricLine.addEventListener('click', () => {
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
   */
  updateCurrentLyric(currentIndex, currentTime, indexChanged = true) {
    if (!this.lyricsContainer) return;

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
            line.style.cssText = `
              color: #ffffff !important;
              font-size: 48px !important;
              font-weight: 700 !important;
              transform: translateZ(0) !important;
              text-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 2px 12px rgba(255, 255, 255, 0.3) !important;
              padding: 20px 30px !important;
              line-height: 1.8 !important;
              text-align: center !important;
              cursor: pointer !important;
              transition: font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease, text-shadow 0.3s ease !important;
              opacity: 1 !important;
              will-change: font-size, color !important;
            `;

            // Debounced scroll - only on index change
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
            Object.assign(line.style, {
              fontSize: '32px',
              fontWeight: '400',
              transform: 'translateZ(0)',
              textShadow: 'none',
              color: isPast ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.5)',
              transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease',
              willChange: 'font-size, color'
            });
          }
        });
      });
    }
    
    // Word-level updates (happens every frame for word mode)
    if (currentTime !== null && this.highlightMode === 'word') {
      const currentLine = lyricLines[currentIndex];
      if (currentLine) {
        const words = currentLine.querySelectorAll('.lyric-word');
        words.forEach(word => {
          const wordTime = parseFloat(word.dataset.wordTime);
          
          if (!isNaN(wordTime)) {
            const timeDiff = currentTime - wordTime;
            
            if (timeDiff >= 0 && timeDiff < 0.3) {
              word.style.color = '#ffffff';
              word.style.textShadow = '0 2px 12px rgba(255, 255, 255, 0.3)';
              word.style.transform = 'scale(1.05)';
              word.style.fontWeight = '600';
            } else if (timeDiff >= 0.3) {
              word.style.color = 'rgba(255, 255, 255, 0.5)';
              word.style.textShadow = 'none';
              word.style.transform = 'scale(1)';
              word.style.fontWeight = '400';
            } else {
              word.style.color = 'rgba(255, 255, 255, 0.3)';
              word.style.textShadow = 'none';
              word.style.transform = 'scale(1)';
              word.style.fontWeight = '400';
            }
          }
        });
      }
    }
  }
}
