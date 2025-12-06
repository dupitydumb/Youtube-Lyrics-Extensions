/**
 * Main Orchestrator - Wires all modules together
 */

import { LyricsAPI } from './api.js';
import { LyricsSync } from './sync.js';
import { LyricsUI } from './ui.js';
import { BackgroundManager } from './background.js';
import { YouTubeIntegration } from './youtube.js';
import { SettingsManager } from './settings.js';
import { FullscreenManager } from './fullscreen.js';
import { EventBus, EVENTS } from './events.js';
import { FILTER_WORDS } from './constants.js';

class YouTubeLyricsApp {
  constructor() {
    this.eventBus = new EventBus();
    this.settings = new SettingsManager();
    this.api = new LyricsAPI();
    this.sync = new LyricsSync();
    this.ui = new LyricsUI();
    this.background = new BackgroundManager();
    this.youtube = new YouTubeIntegration();
    this.fullscreen = new FullscreenManager(this.background);
    
    this.currentVideoInfo = null;
    this.currentLyrics = null;
    this.albumArtUrl = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Load settings
    await this.settings.load();
    await this.background.loadSettings();
    
    // Load highlight mode
    this.highlightMode = this.settings.get('highlightMode') || 'line';
    this.ui.setHighlightMode(this.highlightMode);
    
    // Check if extension is enabled
    if (!this.settings.get('enabled')) {
      return;
    }
    
    // Setup settings listener
    this.settings.listenToStorageChanges();
    this.setupSettingsHandlers();
    this.setupMessageListeners();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Watch for YouTube navigation
    this.youtube.watchNavigation((videoInfo) => {
      if (videoInfo) {
        this.handleVideoChange(videoInfo);
      } else {
        this.handleNavigateAway();
      }
    });
    
    // Check if already on a video page when extension loads
    if (this.youtube.isVideoPage()) {
      const observer = new MutationObserver((mutations, obs) => {
        const secondaryInner = document.querySelector('#secondary-inner');
        if (secondaryInner && this.youtube.getVideoTitle()) {
          obs.disconnect();
          // Trigger initial load
          const videoInfo = {
            title: this.youtube.getVideoTitle(),
            artist: this.youtube.getArtistName(),
            videoId: this.youtube.getVideoId(),
            url: window.location.href
          };
          this.handleVideoChange(videoInfo);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  /**
   * Setup settings change handlers
   */
  setupSettingsHandlers() {
    this.settings.onChange((changes) => {
      if (changes.fontSize !== undefined) {
        this.ui.setFontSize(changes.fontSize);
      }
      
      if (changes.syncDelay !== undefined) {
        this.sync.setDelay(changes.syncDelay);
      }
      
      if (changes.highlightMode !== undefined) {
        this.highlightMode = changes.highlightMode;
        this.ui.setHighlightMode(changes.highlightMode);
      }
      
      if (changes.backgroundMode !== undefined || 
          changes.gradientTheme !== undefined || 
          changes.customColors !== undefined) {
        this.background.mode = changes.backgroundMode || this.background.mode;
        this.background.gradientTheme = changes.gradientTheme || this.background.gradientTheme;
        this.background.customColors = changes.customColors || this.background.customColors;
        this.background.updateBackground(this.albumArtUrl);
      }
    });
  }

  /**
   * Setup message listeners for popup commands
   */
  setupMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'updateFontSize') {
          this.ui.setFontSize(message.fontSize);
        } else if (message.type === 'updateSyncDelay') {
          this.sync.setDelay(message.syncDelay);
        } else if (message.type === 'updateBackgroundMode') {
          this.background.mode = message.backgroundMode;
          this.background.updateBackground(this.albumArtUrl);
        } else if (message.type === 'updateGradientTheme') {
          this.background.gradientTheme = message.gradientTheme;
          this.background.updateBackground(this.albumArtUrl);
        } else if (message.type === 'updateCustomColors') {
          this.background.customColors = message.customColors;
          this.background.updateBackground(this.albumArtUrl);
        } else if (message.type === 'updateHighlightMode') {
          this.highlightMode = message.highlightMode;
          this.ui.setHighlightMode(message.highlightMode);
        } else if (message.type === 'updatePlaybackMode') {
          // Handle playback mode changes if needed
        }
      });
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Sync events
    this.sync.onUpdate((data) => {
      this.ui.updateCurrentLyric(data.currentIndex, data.currentTime);
      
      // If fullscreen is active, update there too
      if (this.fullscreen.isActive) {
        this.fullscreen.updateCurrentLyric(data.currentIndex, data.currentTime);
      }
    });
    
    // Fullscreen exit handler
    this.fullscreen.onExit(() => {
      // Restore UI in panel
      if (this.currentLyrics) {
        this.ui.displayLyrics(this.currentLyrics);
        if (this.sync.currentIndex >= 0) {
          this.ui.updateCurrentLyric(this.sync.currentIndex);
        }
      }
    });
  }

  /**
   * Handle video change
   */
  async handleVideoChange(videoInfo) {
    this.currentVideoInfo = videoInfo;
    
    // Reset state
    this.cleanup();
    
    // Wait for secondary panel to be ready (should already be available since we waited in triggerNavigate)
    try {
      const secondaryInner = document.querySelector('#secondary-inner');
      
      // Create UI
      const panel = this.ui.createPanel(secondaryInner);
      
      // Create background layer
      const bgLayer = this.background.createBackgroundLayer();
      if (panel && bgLayer) {
        panel.insertBefore(bgLayer, panel.firstChild);
      }
      
      // Create video player controls (toggle and fullscreen buttons)
      this.ui.createVideoPlayerControls(
        () => {
          // Fullscreen callback
          this.toggleFullscreen();
        },
        () => {
          // Toggle panel callback
          this.togglePanelVisibility();
        },
        {
          // Settings object with current values and callbacks
          fontSize: this.settings.get('fontSize'),
          syncDelay: this.settings.get('syncDelay'),
          backgroundMode: this.settings.get('backgroundMode'),
          highlightMode: this.settings.get('highlightMode'),
          onFontSizeChange: (value) => {
            this.settings.set('fontSize', value);
            this.ui.setFontSize(value);
          },
          onSyncDelayChange: (value) => {
            this.settings.set('syncDelay', value);
            this.sync.setDelay(value);
          },
          onBackgroundModeChange: (value) => {
            this.settings.set('backgroundMode', value);
            this.background.mode = value;
            this.background.updateBackground(this.albumArtUrl);
          },
          onHighlightModeChange: (value) => {
            this.settings.set('highlightMode', value);
            this.highlightMode = value;
            this.ui.setHighlightMode(value);
          },
          onGradientThemeChange: (value) => {
            this.settings.set('gradientTheme', value);
            this.background.gradientTheme = value;
            this.background.updateBackground(this.albumArtUrl);
          }
        }
      );
      
      // Show loading
      this.ui.showLoading();
      
      // Load lyrics
      await this.loadLyrics(videoInfo);
      
    } catch (error) {
      // Failed to initialize panel
    }
  }

  /**
   * Toggle panel visibility
   */
  togglePanelVisibility() {
    if (this.ui.container) {
      const isHidden = this.ui.container.style.display === 'none';
      this.ui.container.style.display = isHidden ? 'block' : 'none';
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    if (!this.currentLyrics) return;
    
    if (this.fullscreen.isActive) {
      this.fullscreen.exit();
    } else {
      this.fullscreen.enter(this.currentLyrics, this.sync.currentIndex, this.albumArtUrl);
    }
  }

  /**
   * Load lyrics for video
   */
  async loadLyrics(videoInfo) {
    try {
      // Try with video title only first
      let results = null;
      
      if (videoInfo.title) {
        const titleOnlyQuery = this.youtube.formatTitle(videoInfo.title, FILTER_WORDS);
        
        if (titleOnlyQuery.length >= 3) {
          results = await this.api.searchLyrics(titleOnlyQuery);
        }
      }
      
      // If no results with title only, try with title + artist
      if ((!results || results.length === 0) && videoInfo.artist) {
        const searchParts = [];
        if (videoInfo.title) {
          searchParts.push(videoInfo.title);
        }
        if (videoInfo.artist) {
          searchParts.push(videoInfo.artist);
        }
        
        const rawQuery = searchParts.join(' ');
        const query = this.youtube.formatTitle(rawQuery, FILTER_WORDS);
        
        if (query.length >= 3) {
          results = await this.api.searchLyrics(query);
        } else {
          results = await this.api.searchLyrics(rawQuery);
        }
      }
      
      if (!results || results.length === 0) {
        this.ui.showError('No lyrics found for this song');
        return;
      }
      
      this.processLyricsResults(results, videoInfo);
      
    } catch (error) {
      this.ui.showError('Failed to load lyrics');
    }
  }

  /**
   * Process lyrics results
   */
  async processLyricsResults(results, videoInfo) {
    // Find best match
    const bestMatch = this.api.findBestMatch(results, videoInfo.artist);
    
    if (!bestMatch) {
      this.ui.showError('No lyrics found for this song');
      return;
    }
    
    // Parse synced lyrics
    if (bestMatch.syncedLyrics) {
      const syncedLyrics = this.api.parseSyncedLyrics(bestMatch.syncedLyrics);
      this.currentLyrics = syncedLyrics;
        
        // Update title and artist in header
        this.ui.updateTitle(bestMatch.trackName || videoInfo.title, bestMatch.artistName || videoInfo.artist);
        
        // Display lyrics
        this.ui.displaySyncedLyrics(syncedLyrics);
        
        // Apply stored font size
        const storedFontSize = this.settings.get('fontSize');
        if (storedFontSize) {
          this.ui.setFontSize(storedFontSize);
        }
        
        // Create controls
        this.createControls(bestMatch, results);
        
        // Setup sync
        const videoElement = this.youtube.getVideoElement();
        if (videoElement) {
          this.sync.initialize(videoElement, syncedLyrics, this.settings.get('syncDelay'));
          this.sync.start();
        }
        
        // Load album art and update background
        this.albumArtUrl = await this.youtube.extractAlbumArt();
        if (this.albumArtUrl) {
          this.background.updateBackground(this.albumArtUrl);
        }
        
      } else if (bestMatch.plainLyrics) {
        // Update title and artist in header
        this.ui.updateTitle(bestMatch.trackName || videoInfo.title, bestMatch.artistName || videoInfo.artist);
        
        // Display plain lyrics
        this.ui.displayPlainLyrics(bestMatch.plainLyrics);
        
        // Apply stored font size
        const storedFontSize = this.settings.get('fontSize');
        if (storedFontSize) {
          this.ui.setFontSize(storedFontSize);
        }
        
        this.createControls(bestMatch, results);
      } else {
        this.ui.showError('No lyrics available for this song');
      }
  }

  /**
   * Create UI controls (deprecated - controls moved to video player)
   */
  createControls(currentResult, allResults) {
    // Controls are now in the video player settings panel
    // This method is kept for backward compatibility but does nothing
  }

  /**
   * Handle navigate away from video
   */
  handleNavigateAway() {
    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Stop sync
    if (this.sync) {
      this.sync.stop();
    }
    
    // Reset state BEFORE exiting fullscreen to prevent old lyrics from being restored
    this.currentVideoInfo = null;
    this.currentLyrics = null;
    this.albumArtUrl = null;
    
    // Exit fullscreen
    if (this.fullscreen && this.fullscreen.isActive) {
      this.fullscreen.exit();
    }
    
    // Remove UI
    if (this.ui) {
      this.ui.removePanel();
      this.ui.removeVideoPlayerControls();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new YouTubeLyricsApp();
    app.initialize();
  });
} else {
  const app = new YouTubeLyricsApp();
  app.initialize();
}
