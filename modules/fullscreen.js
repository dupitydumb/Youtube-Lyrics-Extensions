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
            transition: 'color 0.15s ease, transform 0.15s ease',
            fontWeight: '400'
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
            
            // Use Object.assign instead of cssText to preserve inheritance
            Object.assign(line.style, {
              color: '#ffffff',
              fontSize: '48px',
              fontWeight: '700',
              transform: 'translateZ(0)',
              textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 2px 12px rgba(255, 255, 255, 0.3)',
              padding: '20px 30px',
              lineHeight: '1.8',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease, text-shadow 0.3s ease',
              opacity: '1',
              willChange: 'font-size, color'
            });

            // Force bright, fully opaque color to override page/global CSS
            try {
              line.style.setProperty('color', '#ffffff', 'important');
              line.style.setProperty('opacity', '1', 'important');
            } catch (e) {}

            // Ensure inner elements (original text and romanization) are fully visible
            const orig = line.querySelector('.fullscreen-original-text');
            if (orig) {
              orig.style.color = '#ffffff';
              orig.style.opacity = '1';
              try { orig.style.setProperty('color', '#ffffff', 'important'); orig.style.setProperty('opacity', '1', 'important'); } catch(e) {}
            }
            const romanElems = line.querySelectorAll('.fullscreen-romanization, .word-romanization');
            romanElems.forEach(el => {
              el.style.color = '#ffffff';
              el.style.opacity = '1';
              try { el.style.setProperty('color', '#ffffff', 'important'); el.style.setProperty('opacity', '1', 'important'); } catch(e) {}
            });
            const wordSpans = line.querySelectorAll('.lyric-word');
            wordSpans.forEach(w => {
              w.style.color = '#ffffff';
              w.style.fontWeight = '600';
              w.style.transform = 'scale(1)';
              w.style.textShadow = '0 2px 12px rgba(255,255,255,0.25)';
              try { w.style.setProperty('color', '#ffffff', 'important'); w.style.setProperty('opacity', '1', 'important'); } catch(e) {}
            });

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
            
            const fadedColor = isPast ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.5)';
            
            Object.assign(line.style, {
              fontSize: '32px',
              fontWeight: '400',
              transform: 'translateZ(0)',
              textShadow: 'none',
              color: fadedColor,
              transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.3s ease',
              willChange: 'font-size, color'
            });

            // Dim inner elements for non-current lines
            const orig2 = line.querySelector('.fullscreen-original-text');
            if (orig2) {
              orig2.style.color = 'rgba(255,255,255,0.6)';
              orig2.style.opacity = '0.9';
            }
            const romanElems2 = line.querySelectorAll('.fullscreen-romanization, .word-romanization');
            romanElems2.forEach(el => {
              el.style.color = 'rgba(255,255,255,0.7)';
              el.style.opacity = '0.9';
            });
            const wordSpans2 = line.querySelectorAll('.lyric-word');
            wordSpans2.forEach(w => {
              w.style.color = 'rgba(255,255,255,0.6)';
              w.style.fontWeight = '400';
              w.style.transform = 'scale(1)';
              w.style.textShadow = 'none';
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
