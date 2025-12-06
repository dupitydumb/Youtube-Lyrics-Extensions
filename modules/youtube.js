/**
 * YouTube Integration Module - Handles YouTube-specific logic
 */

export class YouTubeIntegration {
  constructor() {
    this.selectors = {
      SECONDARY_INNER: '#secondary-inner',
      VIDEO_TITLE: '#title > h1 > yt-formatted-string',
      ARTIST_NAME: '#text > a',
      VIDEO_PLAYER: 'video',
      TITLE_CONTAINER: '#title'
    };
    
    this.currentUrl = '';
    this.currentVideoId = '';
    this.currentTitle = '';
    this.titleObserver = null;
    this.urlCheckInterval = null;
    this.onNavigateCallback = null;
  }

  /**
   * Get the secondary inner element for panel injection
   */
  getSecondaryInner() {
    return document.querySelector(this.selectors.SECONDARY_INNER);
  }

  /**
   * Get the video player element
   */
  getVideoElement() {
    return document.querySelector(this.selectors.VIDEO_PLAYER);
  }

  /**
   * Get the current video title
   */
  getVideoTitle() {
    const titleEl = document.querySelector(this.selectors.VIDEO_TITLE);
    console.log('🎬 Title element found:', titleEl);
    console.log('🎬 Title element selector:', this.selectors.VIDEO_TITLE);
    if (titleEl) {
      console.log('🎬 Title text content:', titleEl.textContent);
      console.log('🎬 Title innerHTML:', titleEl.innerHTML);
    }
    return titleEl ? titleEl.textContent.trim() : '';
  }

  /**
   * Get the artist/channel name
   */
  getArtistName() {
    const artistEl = document.querySelector(this.selectors.ARTIST_NAME);
    return artistEl ? artistEl.textContent.trim() : '';
  }

  /**
   * Extract album art/thumbnail from video
   */
  async extractAlbumArt() {
    try {
      const videoId = this.getVideoId();
      if (!videoId) return null;
      
      // Try high quality thumbnails in order
      const thumbnailUrls = [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      ];
      
      for (const url of thumbnailUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return url;
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting album art:', error);
      return null;
    }
  }

  /**
   * Get video ID from current URL
   */
  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  /**
   * Check if currently on a video page
   */
  isVideoPage() {
    return /^https:\/\/www\.youtube\.com\/watch\?v=/.test(window.location.href);
  }

  /**
   * Format title for lyrics search
   */
  formatTitle(title, filterWords) {
    if (!title) return '';
    
    const NOT_ALLOWED = new Set([...filterWords.BASIC]);
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => !NOT_ALLOWED.has(word))
      .join(' ');
    
    if (formatted.includes('|') && formatted.includes('-')) {
      formatted = formatted.split('|')[0];
    }
    
    return formatted.trim();
  }

  /**
   * Format to song only (more aggressive filtering)
   */
  formatSongOnly(title, filterWords) {
    if (!title) return '';
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => 
        !filterWords.EXTENDED.map(w => w.toLowerCase()).includes(word) && 
        !/[\uAC00-\uD7AF]/.test(word)
      )
      .join(' ');
    
    formatted = formatted.split('|')[0];
    formatted = formatted.replace(/\[.*?\]/g, '');
    formatted = formatted.replace(/\(.*?\)/g, '');
    formatted = formatted.replace(/''/g, '').replace(/"/g, '');
    
    return formatted.trim();
  }

  /**
   * Watch for navigation changes
   */
  watchNavigation(callback) {
    this.onNavigateCallback = callback;
    
    // Debounce helper
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };

    const handleUrlChange = debounce(() => {
      const currentUrl = window.location.href;
      const currentVideoId = this.getVideoId();
      
      if (this.isVideoPage()) {
        // Check both URL and video ID to catch all navigation types
        if (currentUrl !== this.currentUrl || currentVideoId !== this.currentVideoId) {
          this.currentUrl = currentUrl;
          this.currentVideoId = currentVideoId;
          console.log('Video changed - URL:', currentUrl, 'VideoID:', currentVideoId);
          this.triggerNavigate();
        }
      } else if (this.currentUrl.includes('/watch')) {
        this.currentUrl = currentUrl;
        this.currentVideoId = '';
        this.triggerNavigate(true); // Navigate away
      }
    }, 250);

    const handleTitleChange = debounce(() => {
      const title = this.getVideoTitle();
      if (title && title !== this.currentTitle) {
        this.currentTitle = title;
        if (this.isVideoPage()) {
          this.triggerNavigate();
        }
      }
    }, 250);

    // Create title observer
    this.titleObserver = new MutationObserver(handleTitleChange);
    
    const titleContainer = document.querySelector(this.selectors.TITLE_CONTAINER);
    if (titleContainer) {
      this.titleObserver.observe(titleContainer, { childList: true, subtree: true });
    }

    // Watch for YouTube navigation events
    window.addEventListener('yt-navigate-finish', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    // Fallback: Poll for URL changes
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        handleUrlChange();
      }
    }, 1000);

    // Initial check
    this.currentUrl = window.location.href;
    this.currentVideoId = this.getVideoId();
    if (this.isVideoPage()) {
      setTimeout(() => this.triggerNavigate(), 500);
    }
  }

  /**
   * Trigger navigation callback
   */
  async triggerNavigate(navigateAway = false) {
    console.log('🚀 triggerNavigate called, navigateAway:', navigateAway);
    if (this.onNavigateCallback) {
      if (navigateAway) {
        console.log('🚀 Navigating away');
        this.onNavigateCallback(null);
      } else {
        // Wait for both title and secondary elements to be ready
        try {
          console.log('⏳ Waiting for title element...');
          await this.waitForElement(this.selectors.VIDEO_TITLE, 5000);
          console.log('✅ Title element found');

          console.log('⏳ Waiting for secondary inner element...');
          await this.waitForElement(this.selectors.SECONDARY_INNER, 5000);
          console.log('✅ Secondary inner element found');
        } catch (error) {
          console.warn('⚠️ Required elements not found, proceeding anyway:', error);
        }
        
        const videoInfo = {
          title: this.getVideoTitle(),
          artist: this.getArtistName(),
          videoId: this.getVideoId(),
          url: window.location.href
        };
        console.log('📹 Video info extracted:', videoInfo);
        this.onNavigateCallback(videoInfo);
      }
    }
  }

  /**
   * Cleanup observers and intervals
   */
  cleanup() {
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }

    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }
  }

  /**
   * Wait for element to appear in DOM
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }
}
