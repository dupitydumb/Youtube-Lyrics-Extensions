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
    console.log('YouTube Lyrics Extension - Initializing...');
    
    // Load settings
    await this.settings.load();
    await this.background.loadSettings();
    
    // Setup settings listener
    this.settings.listenToStorageChanges();
    this.setupSettingsHandlers();
    
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
    
    console.log('YouTube Lyrics Extension - Ready');
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
   * Setup event handlers
   */
  setupEventHandlers() {
    // Sync events
    this.sync.onUpdate((data) => {
      this.ui.updateCurrentLyric(data.currentIndex, data.currentTime);
      
      // If fullscreen is active, update there too
      if (this.fullscreen.isActive) {
        const container = this.fullscreen.getLyricsContainer();
        if (container) {
          this.ui.updateLyricInContainer(container, data.currentIndex, data.current);
        }
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
    console.log('Video changed:', videoInfo.title);
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
      
      // Show loading
      this.ui.showLoading();
      
      // Load lyrics
      await this.loadLyrics(videoInfo);
      
    } catch (error) {
      console.error('Failed to initialize panel:', error);
    }
  }

  /**
   * Load lyrics for video
   */
  async loadLyrics(videoInfo) {
    try {
      // Build search query from title and artist
      const searchParts = [];
      if (videoInfo.title) {
        searchParts.push(videoInfo.title);
      }
      if (videoInfo.artist) {
        searchParts.push(videoInfo.artist);
      }
      
      const rawQuery = searchParts.join(' ');
      const query = this.youtube.formatTitle(rawQuery, FILTER_WORDS);
      
      console.log('🎵 Video Info:', videoInfo);
      console.log('🎵 Title:', videoInfo.title);
      console.log('🎵 Artist:', videoInfo.artist);
      console.log('🔍 Raw query:', rawQuery);
      console.log('🔍 Formatted query:', query);
      console.log('🔍 Query length:', query.length);
      
      // If query is too short, use raw query without filtering
      if (query.length < 3) {
        console.warn('⚠️ Query too short, using raw query');
        console.log('🔍 Fallback query:', rawQuery);
        
        const results = await this.api.searchLyrics(rawQuery);
        console.log('📊 API Results (fallback):', results);
        console.log('📊 Results count (fallback):', results ? results.length : 0);
        
        if (!results || results.length === 0) {
          console.warn('❌ No results from API even with fallback');
          this.ui.showError('No lyrics found for this song');
          return;
        }
        
        this.processLyricsResults(results, videoInfo);
        return;
      }
      
      console.log('🔍 Search query:', query);
      
      // Search lyrics
      const results = await this.api.searchLyrics(query);
      
      console.log('📊 API Results:', results);
      console.log('📊 Results count:', results ? results.length : 0);
      
      if (!results || results.length === 0) {
        console.warn('❌ No results from API');
        this.ui.showError('No lyrics found for this song');
        return;
      }
      
      this.processLyricsResults(results, videoInfo);
      
    } catch (error) {
      console.error('Error loading lyrics:', error);
      this.ui.showError('Failed to load lyrics');
    }
  }

  /**
   * Process lyrics results
   */
  async processLyricsResults(results, videoInfo) {
    // Log each result
    results.forEach((result, index) => {
      console.log(`📝 Result ${index + 1}:`, {
        trackName: result.trackName,
        artistName: result.artistName,
        albumName: result.albumName,
        hasSyncedLyrics: !!result.syncedLyrics,
        hasPlainLyrics: !!result.plainLyrics
      });
    });
    
    // Find best match
    const bestMatch = this.api.findBestMatch(results, videoInfo.artist);
    
    console.log('✅ Best match:', bestMatch ? {
      trackName: bestMatch.trackName,
      artistName: bestMatch.artistName,
      hasSyncedLyrics: !!bestMatch.syncedLyrics,
      hasPlainLyrics: !!bestMatch.plainLyrics
    } : 'None');
    
    if (!bestMatch) {
      console.warn('❌ No best match found');
      this.ui.showError('No lyrics found for this song');
      return;
    }
    
    // Parse synced lyrics
    if (bestMatch.syncedLyrics) {
      console.log('🎼 Parsing synced lyrics...');
      const syncedLyrics = this.api.parseSyncedLyrics(bestMatch.syncedLyrics);
      console.log('🎼 Parsed lyrics count:', syncedLyrics.length);
      this.currentLyrics = syncedLyrics;
        
        // Display lyrics
        this.ui.displaySyncedLyrics(syncedLyrics);
        
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
        // Display plain lyrics
        this.ui.displayPlainLyrics(bestMatch.plainLyrics);
        this.createControls(bestMatch, results);
      } else {
        this.ui.showError('No lyrics available for this song');
      }
  }

  /**
   * Create UI controls
   */
  createControls(currentResult, allResults) {
    // Create song selector
    this.ui.createSongSelector(allResults, (selectedResult) => {
      if (selectedResult.syncedLyrics) {
        const syncedLyrics = this.api.parseSyncedLyrics(selectedResult.syncedLyrics);
        this.currentLyrics = syncedLyrics;
        this.ui.displayLyrics(syncedLyrics);
        this.sync.initialize(this.youtube.getVideoElement(), syncedLyrics, this.settings.get('syncDelay'));
        this.sync.start();
      } else if (selectedResult.plainLyrics) {
        this.ui.displayPlainLyrics(selectedResult.plainLyrics);
      }
    });
    
    // Create background mode selector
    this.ui.createBackgroundSelector(
      this.background.mode,
      this.background.gradientTheme,
      (mode, theme) => {
        this.background.mode = mode;
        this.background.gradientTheme = theme;
        this.background.updateBackground(this.albumArtUrl);
        this.background.saveSettings();
      }
    );
    
    // Create fullscreen button
    this.ui.createFullscreenButton(() => {
      if (this.currentLyrics && this.currentLyrics.length > 0) {
        this.fullscreen.toggle(this.currentLyrics, this.sync.currentIndex, this.albumArtUrl);
        
        // If entering fullscreen, display lyrics there
        if (this.fullscreen.isActive) {
          const container = this.fullscreen.getLyricsContainer();
          if (container) {
            this.ui.displayLyricsInContainer(container, this.currentLyrics);
            if (this.sync.currentIndex >= 0) {
              this.ui.updateLyricInContainer(container, this.sync.currentIndex);
            }
          }
        }
      }
    });
    
    // Create video player controls
    this.ui.createVideoPlayerControls(() => {
      // Toggle fullscreen
      if (this.currentLyrics && this.currentLyrics.length > 0) {
        this.fullscreen.toggle(this.currentLyrics, this.sync.currentIndex, this.albumArtUrl);
        
        if (this.fullscreen.isActive) {
          const container = this.fullscreen.getLyricsContainer();
          if (container) {
            this.ui.displayLyricsInContainer(container, this.currentLyrics);
            if (this.sync.currentIndex >= 0) {
              this.ui.updateLyricInContainer(container, this.sync.currentIndex);
            }
          }
        }
      }
    });
  }

  /**
   * Handle navigate away from video
   */
  handleNavigateAway() {
    console.log('Navigated away from video page');
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
    
    // Exit fullscreen
    if (this.fullscreen && this.fullscreen.isActive) {
      this.fullscreen.exit();
    }
    
    // Remove UI
    if (this.ui) {
      this.ui.removePanel();
    }
    
    // Reset state
    this.currentVideoInfo = null;
    this.currentLyrics = null;
    this.albumArtUrl = null;
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
