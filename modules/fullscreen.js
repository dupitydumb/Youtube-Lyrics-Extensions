/**
 * Fullscreen Module - Handles fullscreen karaoke mode
 */

export class FullscreenManager {
  constructor(backgroundManager) {
    this.backgroundManager = backgroundManager;
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
  enter(lyrics, currentIndex = -1, imageUrl = null) {
    if (this.isActive) return;
    
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
    
    this.lyricsContainer.replaceChildren();
    
    // Create wrapper for proper centering and scrolling
    const wrapper = document.createElement('div');
    wrapper.id = 'fullscreen-lyrics-wrapper';
    
    lyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyric-line future';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;
      
      // Check if lyric has word-level timing
      if (lyric.words && lyric.words.length > 0) {
        // Create word-by-word display
        lyric.words.forEach((wordData, wordIndex) => {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'lyric-word future';
          wordSpan.textContent = wordData.word;
          wordSpan.dataset.wordIndex = wordIndex;
          wordSpan.dataset.wordTime = wordData.time;
          lyricLine.appendChild(wordSpan);
          
          // Add space after word (except last word)
          if (wordIndex < lyric.words.length - 1) {
            lyricLine.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        // Regular line-by-line display
        lyricLine.textContent = lyric.text;
      }

      Object.assign(lyricLine.style, {
        padding: '20px 30px',
        fontSize: '32px',
        lineHeight: '1.8',
        color: 'rgba(255, 255, 255, 0.5)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'scale(1)',
        fontWeight: '400',
        textAlign: 'center',
        cursor: 'pointer'
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
  updateCurrentLyric(currentIndex, currentTime) {
    if (!this.lyricsContainer) return;

    const lyricLines = this.lyricsContainer.querySelectorAll('.lyric-line');

    lyricLines.forEach((line, index) => {
      const isPast = index < currentIndex;
      const isCurrent = index === currentIndex;

      if (isCurrent) {
        line.classList.add('current');
        line.classList.remove('past', 'future');
        Object.assign(line.style, {
          color: '#ffffff',
          fontSize: '48px',
          fontWeight: '700',
          transform: 'scale(1.1)',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 2px 12px rgba(255, 255, 255, 0.3)'
        });

        // Update word-by-word highlighting if available and in word mode
        if (currentTime !== null && this.highlightMode === 'word') {
          const words = line.querySelectorAll('.lyric-word');
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

        // Smooth scroll to current lyric - center it in the viewport
        setTimeout(() => {
          const containerRect = this.lyricsContainer.getBoundingClientRect();
          const lineRect = line.getBoundingClientRect();
          const containerScrollTop = this.lyricsContainer.scrollTop;
          
          // Calculate position to center the line
          const lineRelativeTop = lineRect.top - containerRect.top + containerScrollTop;
          const containerHeight = this.lyricsContainer.clientHeight;
          const lineHeight = line.offsetHeight;
          const scrollPosition = lineRelativeTop - (containerHeight / 2) + (lineHeight / 2);
          
          this.lyricsContainer.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }, 50);
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
          transform: 'scale(1)',
          textShadow: 'none',
          color: isPast ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.5)'
        });
      }
    });
  }
}
