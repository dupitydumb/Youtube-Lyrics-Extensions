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
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      overflow-y: auto;
      padding: 40px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;
    
    // Hide scrollbar for webkit browsers
    const style = document.createElement('style');
    style.textContent = `
      #fullscreen-lyrics-container::-webkit-scrollbar {
        display: none;
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
}
