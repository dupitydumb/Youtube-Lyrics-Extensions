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
    this.urlObserver = null;
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

    // Store handlers on the instance so they can be removed later
    this._debounce = debounce;
    this._handleUrlChange = debounce(() => {
      const currentUrl = window.location.href;
      const currentVideoId = this.getVideoId();

      console.log('[YT Lyrics] URL change detected', {
        currentUrl,
        currentVideoId,
        storedUrl: this.currentUrl,
        storedVideoId: this.currentVideoId
      });

      if (this.isVideoPage()) {
        // Check both URL and video ID to catch all navigation types
        if (currentUrl !== this.currentUrl || currentVideoId !== this.currentVideoId) {
          console.log('[YT Lyrics] Video changed! Triggering navigate...');
          this.currentUrl = currentUrl;
          this.currentVideoId = currentVideoId;
          this.triggerNavigate();
        } else {
          console.log('[YT Lyrics] Same video, ignoring');
        }
      } else if (this.currentUrl.includes('/watch')) {
        console.log('[YT Lyrics] Navigated away from video');
        this.currentUrl = currentUrl;
        this.currentVideoId = '';
        this.triggerNavigate(true); // Navigate away
      }

    }, 250);

    this._handleTitleChange = debounce(() => {
      const title = this.getVideoTitle();
      console.log('[YT Lyrics] Title change detected', { title, storedTitle: this.currentTitle });
      if (title && title !== this.currentTitle) {
        console.log('[YT Lyrics] Title changed! Triggering navigate...');
        this.currentTitle = title;
        if (this.isVideoPage()) {
          this.triggerNavigate();
        }
      }
    }, 250);

    // Create title observer
    this.titleObserver = new MutationObserver(this._handleTitleChange);

    const titleContainer = document.querySelector(this.selectors.TITLE_CONTAINER);
    if (titleContainer) {
      this.titleObserver.observe(titleContainer, { childList: true, subtree: true });
      console.log('[YT Lyrics] Title observer created and watching');
    } else {
      console.warn('[YT Lyrics] Title container not found, title observer not created');
    }

    // Watch for YouTube navigation events
    window.addEventListener('yt-navigate-finish', this._handleUrlChange);
    window.addEventListener('popstate', this._handleUrlChange);
    console.log('[YT Lyrics] Navigation event listeners added');

    // Fallback: observe DOM changes to detect SPA navigation without polling
    try {
      this.urlObserver = new MutationObserver(() => {
        if (window.location.href !== this.currentUrl) {
          // Use the debounced handler for consistency
          if (this._handleUrlChange) this._handleUrlChange();
        }
      });

      this.urlObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
      console.log('[YT Lyrics] URL observer created');
    } catch (e) {
      // If MutationObserver not available, fall back to light polling
      this.urlCheckInterval = setInterval(() => {
        if (window.location.href !== this.currentUrl) {
          if (this._handleUrlChange) this._handleUrlChange();
        }
      }, 3000);
      console.log('[YT Lyrics] Using polling fallback');
    }

    // Initial check
    this.currentUrl = window.location.href;
    this.currentVideoId = this.getVideoId();
    if (this.isVideoPage()) {
      console.log('[YT Lyrics] Initial video page detected, triggering navigate');
      setTimeout(() => this.triggerNavigate(), 500);
    }
  }

  /**
   * Trigger navigation callback
   */
  async triggerNavigate(navigateAway = false) {
    console.log('[YT Lyrics] triggerNavigate called', { navigateAway });
    if (this.onNavigateCallback) {
      if (navigateAway) {
        this.onNavigateCallback(null);
      } else {
        // Wait for both title and secondary elements to be ready
        try {
          await this.waitForElement(this.selectors.VIDEO_TITLE, 5000);
          await this.waitForElement(this.selectors.SECONDARY_INNER, 5000);
          // Wait for title to actually change to the new video
          await this.waitForTitleChange(3000);

          // Recreate title observer if it was cleaned up
          if (!this.titleObserver && this._handleTitleChange) {
            console.log('[YT Lyrics] Recreating title observer after cleanup');
            this.titleObserver = new MutationObserver(this._handleTitleChange);
            const titleContainer = document.querySelector(this.selectors.TITLE_CONTAINER);
            if (titleContainer) {
              this.titleObserver.observe(titleContainer, { childList: true, subtree: true });
            }
          }
        } catch (error) {
          console.error('[YT Lyrics] Error waiting for elements', error);
        }

        const videoInfo = {
          title: this.getVideoTitle(),
          artist: this.getArtistName(),
          videoId: this.getVideoId(),
          url: window.location.href
        };
        console.log('[YT Lyrics] Calling onNavigateCallback with videoInfo', videoInfo);
        this.onNavigateCallback(videoInfo);
      }
    } else {
      console.warn('[YT Lyrics] onNavigateCallback not set!');
    }
  }

  /**
   * Cleanup per-video resources (called between videos)
   * Only resets title observer, keeps navigation listeners active
   */
  cleanup() {
    // Only disconnect title observer - it will be recreated for the new video
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }

    // Note: Navigation listeners (urlObserver, _handleUrlChange, etc.) are NOT removed
    // They must persist across video changes to enable auto-refresh
  }

  /**
   * Full cleanup/teardown (called when extension is disabled or unloaded)
   * Removes all observers and event listeners
   */
  destroy() {
    // Disconnect title observer
    if (this.titleObserver) {
      this.titleObserver.disconnect();
      this.titleObserver = null;
    }

    // Disconnect URL observer
    if (this.urlObserver) {
      try { this.urlObserver.disconnect(); } catch (e) { }
      this.urlObserver = null;
    }

    // Clear URL check interval
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
      this.urlCheckInterval = null;
    }

    // Remove navigation event listeners
    try {
      if (this._handleUrlChange) {
        window.removeEventListener('yt-navigate-finish', this._handleUrlChange);
        window.removeEventListener('popstate', this._handleUrlChange);
        this._handleUrlChange = null;
      }

      if (this._handleTitleChange) {
        this._handleTitleChange = null;
      }
    } catch (e) {
      // ignore
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

  /**
   * Wait for title to change from current stored title
   */
  waitForTitleChange(timeout = 3000) {
    return new Promise((resolve) => {
      const startTitle = this.currentTitle;
      const checkInterval = setInterval(() => {
        const newTitle = this.getVideoTitle();
        if (newTitle && newTitle !== startTitle) {
          clearInterval(checkInterval);
          this.currentTitle = newTitle;
          resolve(newTitle);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        // Resolve anyway after timeout, update currentTitle
        this.currentTitle = this.getVideoTitle();
        resolve(this.currentTitle);
      }, timeout);
    });
  }
}
