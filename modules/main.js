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
import { Romanizer } from './romanization.js';
import { Musixmatch } from './AlternativeProvider/musicmatch.js';
import { Deezer } from './AlternativeProvider/deezer.js';

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

    // Create custom fetch function that routes through content script bridge (bypasses CORS)
    // Uses window.postMessage to communicate with loader.js content script
    const pendingRequests = new Map();
    let requestCounter = 0;

    // Listen for responses from the content script bridge
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      // Handle both Musixmatch and generic provider fetch responses
      if (event.data && (event.data.type === 'MUSIXMATCH_FETCH_RESPONSE' || event.data.type === 'PROVIDER_FETCH_RESPONSE')) {
        const requestId = event.data.requestId;
        const handler = pendingRequests.get(requestId);
        if (handler) {
          pendingRequests.delete(requestId);
          if (event.data.error) {
            handler.reject(new Error(event.data.error));
          } else if (event.data.response && event.data.response.success) {
            handler.resolve({
              ok: true,
              json: async () => event.data.response.data,
              text: async () => typeof event.data.response.data === 'string'
                ? event.data.response.data
                : JSON.stringify(event.data.response.data)
            });
          } else {
            handler.reject(new Error(event.data.response?.error || 'Fetch failed'));
          }
        }
      }
    });

    // Background fetch for Musixmatch (GET only, uses MUSIXMATCH message type)
    const backgroundFetch = (url) => {
      return new Promise((resolve, reject) => {
        const requestId = ++requestCounter;
        pendingRequests.set(requestId, { resolve, reject });

        // Send request to content script bridge via postMessage
        window.postMessage({
          type: 'MUSIXMATCH_FETCH_REQUEST',
          requestId: requestId,
          url: url
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    };

    // Generic provider fetch that supports GET and POST with options
    const providerFetch = (url, options = {}) => {
      return new Promise((resolve, reject) => {
        const requestId = ++requestCounter;
        pendingRequests.set(requestId, { resolve, reject });

        // Send request to content script bridge via postMessage
        window.postMessage({
          type: 'PROVIDER_FETCH_REQUEST',
          requestId: requestId,
          url: url,
          options: options
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.has(requestId)) {
            pendingRequests.delete(requestId);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    };

    this.musixmatch = new Musixmatch(null, true, backgroundFetch); // Enhanced mode with custom fetch
    this.deezer = new Deezer(providerFetch); // Deezer provider with generic fetch that supports POST

    this.currentVideoInfo = null;
    this.currentLyrics = null;
    this.albumArtUrl = null;
    this.currentProvider = null; // Track which provider supplied the lyrics
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

      if (changes.showRomanization !== undefined) {
        this.showRomanization = changes.showRomanization === true;
        // Re-render lyrics with romanization if available
        if (this.currentLyrics && this.ui.lyricsContainer) {
          this.renderCurrentLyrics();
        }
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
        } else if (message.type === 'updateRomanization') {
          this.settings.set('showRomanization', message.showRomanization === true);
          if (this.currentLyrics) {
            const rebuilt = this.applyRomanizationIfNeeded(
              this.currentLyrics.map(l => ({ time: l.time, text: l.text, words: l.words }))
            );
            this.currentLyrics = rebuilt;
            this.renderCurrentLyrics();
          }
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
      this.ui.updateCurrentLyric(data.currentIndex, data.currentTime, data.indexChanged);

      // Update progress bar
      if (data.progress !== undefined) {
        this.ui.updateProgressBar(data.progress);
      }

      // If fullscreen is active, update there too
      if (this.fullscreen.isActive) {
        this.fullscreen.updateCurrentLyric(data.currentIndex, data.currentTime, data.indexChanged);
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
          showRomanization: this.settings.get('showRomanization') === true,
          hideOriginalLyrics: this.settings.get('hideOriginalLyrics') === true,
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
          },
          onRomanizationChange: (enabled) => {
            this.settings.set('showRomanization', enabled);
            // Recompute romanization for current lyrics
            if (this.currentLyrics) {
              // If we have synced lyrics, rebuild with/without romanization
              const rebuilt = this.applyRomanizationIfNeeded(
                this.currentLyrics.map(l => ({ time: l.time, text: l.text, words: l.words }))
              );
              this.currentLyrics = rebuilt;
              this.renderCurrentLyrics();
            }
          },
          onHideOriginalLyricsChange: (enabled) => {
            this.settings.set('hideOriginalLyrics', enabled);
            // Re-render current lyrics with the new setting
            if (this.currentLyrics) {
              this.renderCurrentLyrics();
            }
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
      this.fullscreen.setHighlightMode(this.highlightMode);
      // Pass song title and artist name to fullscreen
      const songTitle = this.currentVideoInfo?.title || '';
      const artistName = this.currentVideoInfo?.artist || '';
      this.fullscreen.enter(
        this.currentLyrics,
        this.sync.currentIndex,
        this.albumArtUrl,
        this.ui.settingsRef,
        songTitle,
        artistName
      );
    }
  }

  /**
   * Load lyrics for video with multi-strategy search
   * Prioritizes Musixmatch provider, falls back to LRCLIB API
   */
  async loadLyrics(videoInfo) {
    try {
      // Import TitleParser from api module
      const { TitleParser } = await import('./api.js');

      // Parse the title to extract song and artist intelligently
      const parsed = TitleParser.parseTitle(videoInfo.title, videoInfo.artist);

      // Define search strategies in priority order
      const strategies = [
        // Strategy 1: Parsed song + parsed artist (highest confidence)
        {
          name: 'parsed_full',
          query: `${parsed.song} ${parsed.artist}`.trim(),
          songName: parsed.song,
          artistName: parsed.artist,
          enabled: parsed.song && parsed.artist && parsed.confidence > 0.6
        },
        // Strategy 2: Formatted title + channel name
        {
          name: 'formatted_with_channel',
          query: `${TitleParser.formatForSearch(videoInfo.title)} ${videoInfo.artist}`.trim(),
          songName: videoInfo.title,
          artistName: videoInfo.artist,
          enabled: videoInfo.title && videoInfo.artist
        },
        // Strategy 3: Raw title + channel
        {
          name: 'raw_with_channel',
          query: `${videoInfo.title} ${videoInfo.artist}`.trim(),
          songName: videoInfo.title,
          artistName: videoInfo.artist,
          enabled: videoInfo.title && videoInfo.artist
        },
        // Strategy 4: Parsed song only (for official channel uploads like "Sparks" by Coldplay)
        {
          name: 'parsed_song_only',
          query: parsed.song,
          songName: parsed.song,
          artistName: parsed.artist,
          enabled: parsed.song && parsed.confidence > 0.7
        },
        // Strategy 5: Formatted title only
        {
          name: 'formatted_title',
          query: TitleParser.formatForSearch(videoInfo.title),
          songName: videoInfo.title,
          artistName: videoInfo.artist,
          enabled: videoInfo.title
        },
        // Strategy 6: Aggressive format (formatSongOnly equivalent)
        {
          name: 'aggressive_format',
          query: this.youtube.formatSongOnly(videoInfo.title, FILTER_WORDS),
          songName: videoInfo.title,
          artistName: videoInfo.artist,
          enabled: videoInfo.title
        },
        // Strategy 7: Raw title as last resort
        {
          name: 'raw_title',
          query: videoInfo.title,
          songName: videoInfo.title,
          artistName: videoInfo.artist,
          enabled: videoInfo.title
        }
      ];

      // PRIORITY 1: Try Musixmatch first with different strategies
      let musixmatchResult = null;
      let successfulStrategy = null;
      let musixmatchRateLimited = false; // Track if Musixmatch is rate limited

      for (const strategy of strategies) {
        if (!strategy.enabled || !strategy.query || strategy.query.length < 2) {
          continue;
        }

        // If Musixmatch is rate limited, skip remaining strategies
        if (musixmatchRateLimited) {
          console.log(`[Musixmatch] Skipping strategy ${strategy.name} due to rate limit, moving to fallback...`);
          break;
        }

        try {
          console.log(`[Musixmatch] Trying strategy: ${strategy.name} with query: "${strategy.query}"`);
          musixmatchResult = await this.musixmatch.getLrc(strategy.query);
          console.log('[Musixmatch] Response:', JSON.stringify(musixmatchResult, null, 2));

          if (musixmatchResult && musixmatchResult.synced) {
            console.log(`[Musixmatch] Found lyrics with strategy: ${strategy.name}`);
            successfulStrategy = strategy;
            break;
          }
        } catch (error) {
          console.log(`[Musixmatch] Strategy ${strategy.name} failed:`, error.message);
          // Check if this is a rate limit/token error - if so, skip remaining Musixmatch strategies
          if (error.message.includes('token') || error.message.includes('401') || error.message.includes('rate') || error.message.includes('retries')) {
            console.log('[Musixmatch] Rate limited or token error detected, skipping remaining strategies...');
            musixmatchRateLimited = true;
          }
          continue;
        }
      }

      // If Musixmatch found lyrics, process them
      if (musixmatchResult && musixmatchResult.synced) {
        this.currentProvider = 'Musixmatch';
        this.processProviderResults(
          musixmatchResult,
          videoInfo,
          successfulStrategy ? successfulStrategy.songName : videoInfo.title,
          successfulStrategy ? successfulStrategy.artistName : videoInfo.artist,
          'Musixmatch'
        );
        return;
      }

      // PRIORITY 2: Try Deezer as fallback
      console.log('[Deezer] Trying Deezer as fallback...');
      let deezerResult = null;

      for (const strategy of strategies) {
        if (!strategy.enabled || !strategy.query || strategy.query.length < 2) {
          continue;
        }

        try {
          console.log(`[Deezer] Trying strategy: ${strategy.name} with query: "${strategy.query}"`);
          deezerResult = await this.deezer.getLrc(strategy.query);

          if (deezerResult && deezerResult.synced) {
            console.log(`[Deezer] Found lyrics with strategy: ${strategy.name}`);
            successfulStrategy = strategy;
            break;
          }
        } catch (error) {
          console.log(`[Deezer] Strategy ${strategy.name} failed:`, error.message);
          continue;
        }
      }

      // If Deezer found lyrics, process them
      if (deezerResult && deezerResult.synced) {
        this.currentProvider = 'Deezer';
        this.processProviderResults(
          deezerResult,
          videoInfo,
          successfulStrategy ? successfulStrategy.songName : videoInfo.title,
          successfulStrategy ? successfulStrategy.artistName : videoInfo.artist,
          'Deezer'
        );
        return;
      }

      // PRIORITY 3: Fall back to LRCLIB API
      console.log('[LRCLIB] Falling back to LRCLIB API...');
      let results = null;

      for (const strategy of strategies) {
        if (!strategy.enabled || !strategy.query || strategy.query.length < 2) {
          continue;
        }

        try {
          results = await this.api.searchLyrics(strategy.query);

          if (results && results.length > 0) {
            successfulStrategy = strategy;
            break;
          }
        } catch (error) {
          // Continue to next strategy
          continue;
        }
      }

      if (!results || results.length === 0) {
        this.ui.showError('No lyrics found for this song');
        return;
      }

      // Process results with enhanced metadata
      this.currentProvider = 'LRCLIB';
      this.processLyricsResults(
        results,
        videoInfo,
        successfulStrategy ? successfulStrategy.songName : videoInfo.title,
        successfulStrategy ? successfulStrategy.artistName : videoInfo.artist,
        'LRCLIB'
      );

    } catch (error) {
      console.error('[Lyrics] Failed to load lyrics:', error);
      this.ui.showError('Failed to load lyrics');
    }
  }

  /**
   * Process lyrics results from any provider (Musixmatch, Deezer, etc.)
   * @param {object} result - Lyrics result with synced property
   * @param {object} videoInfo - Video information
   * @param {string} songName - Song name
   * @param {string} artistName - Artist name
   * @param {string} providerName - Name of the provider (e.g., 'Musixmatch', 'Deezer')
   */
  async processProviderResults(result, videoInfo, songName = '', artistName = '', providerName = 'Unknown') {
    // Parse synced lyrics from LRC format
    const syncedLyrics = this.api.parseSyncedLyrics(result.synced);

    if (!syncedLyrics || syncedLyrics.length === 0) {
      // Fall back to LRCLIB if parsing failed
      console.log(`[${providerName}] Failed to parse lyrics, falling back to LRCLIB...`);
      return this.loadLyricsFromLRCLIB(videoInfo, songName, artistName);
    }

    // Store provider name
    this.currentProvider = providerName;

    // Attach romanization if enabled
    const withRoman = this.applyRomanizationIfNeeded(syncedLyrics);
    this.currentLyrics = withRoman;

    // Update title, artist, and provider attribution in header
    this.ui.updateTitle(songName || videoInfo.title, artistName || videoInfo.artist, providerName);

    // Check if we have word-level timings (prioritize word-by-word sync)
    const hasWordTimings = syncedLyrics.some(line => line.words && line.words.length > 0);

    if (hasWordTimings) {
      console.log(`[${providerName}] Word-level timings detected, switching to WORD mode`);
      // Update internal state, settings, and UI
      this.highlightMode = 'word';
      this.settings.set('highlightMode', 'word');
      this.ui.setHighlightMode('word');

      // Also update fullscreen manager if it exists
      if (this.fullscreen) {
        this.fullscreen.setHighlightMode('word');
      }
    }

    // Display lyrics
    this.ui.displaySyncedLyrics(this.currentLyrics);

    // Apply stored font size
    const storedFontSize = this.settings.get('fontSize');
    if (storedFontSize) {
      this.ui.setFontSize(storedFontSize);
    }

    // Create controls (no-op for now but kept for compatibility)
    this.createControls(null, []);

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
      // Update album cover in panel if setting is enabled
      const showInPanel = this.settings.get('showAlbumCoverInPanel');
      this.ui.updateAlbumCover(this.albumArtUrl, showInPanel);
    }

    console.log(`[${providerName}] Successfully loaded lyrics`);
  }

  /**
   * Load lyrics from LRCLIB API only (fallback method)
   */
  async loadLyricsFromLRCLIB(videoInfo, songName, artistName) {
    const { TitleParser } = await import('./api.js');
    const parsed = TitleParser.parseTitle(videoInfo.title, videoInfo.artist);

    const strategies = [
      { query: `${parsed.song} ${parsed.artist}`.trim(), enabled: parsed.song && parsed.artist },
      { query: `${videoInfo.title} ${videoInfo.artist}`.trim(), enabled: videoInfo.title && videoInfo.artist },
      { query: videoInfo.title, enabled: videoInfo.title }
    ];

    let results = null;
    for (const strategy of strategies) {
      if (!strategy.enabled || !strategy.query) continue;
      try {
        results = await this.api.searchLyrics(strategy.query);
        if (results && results.length > 0) break;
      } catch (error) {
        continue;
      }
    }

    if (!results || results.length === 0) {
      this.ui.showError('No lyrics found for this song');
      return;
    }

    this.currentProvider = 'LRCLIB';
    this.processLyricsResults(results, videoInfo, songName, artistName, 'LRCLIB');
  }

  /**
   * Process lyrics results
   */
  async processLyricsResults(results, videoInfo, songName = '', artistName = '', providerName = 'LRCLIB') {
    // Find best match with enhanced fuzzy matching
    const bestMatch = this.api.findBestMatch(
      results,
      artistName || videoInfo.artist,
      songName || videoInfo.title
    );

    if (!bestMatch) {
      this.ui.showError('No lyrics found for this song');
      return;
    }

    // Parse synced lyrics
    if (bestMatch.syncedLyrics) {
      const syncedLyrics = this.api.parseSyncedLyrics(bestMatch.syncedLyrics);
      // Attach romanization if enabled
      const withRoman = this.applyRomanizationIfNeeded(syncedLyrics);
      this.currentLyrics = withRoman;

      // Update title, artist, and provider in header
      this.ui.updateTitle(bestMatch.trackName || videoInfo.title, bestMatch.artistName || videoInfo.artist, providerName);

      // Check if we have word-level timings and auto-switch to word mode
      const hasWordTimings = syncedLyrics.some(line => line.words && line.words.length > 0);
      if (hasWordTimings) {
        console.log('[LRCLIB] Word-level timings detected, switching to WORD mode');
        this.highlightMode = 'word';
        this.settings.set('highlightMode', 'word');
        this.ui.setHighlightMode('word');
        if (this.fullscreen) {
          this.fullscreen.setHighlightMode('word');
        }
      }

      // Display lyrics
      this.ui.displaySyncedLyrics(this.currentLyrics);

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
        // Update album cover in panel if setting is enabled
        const showInPanel = this.settings.get('showAlbumCoverInPanel');
        this.ui.updateAlbumCover(this.albumArtUrl, showInPanel);
      }

    } else if (bestMatch.plainLyrics) {
      // Update title, artist, and provider in header
      this.ui.updateTitle(bestMatch.trackName || videoInfo.title, bestMatch.artistName || videoInfo.artist, providerName);

      // Display plain lyrics
      const plain = bestMatch.plainLyrics;
      const romanizedPlain = this.applyRomanizationToPlainIfNeeded(plain);
      this.ui.displayPlainLyrics(romanizedPlain);

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

  renderCurrentLyrics() {
    // Re-display current lyrics respecting romanization setting
    if (!this.currentLyrics) return;
    this.ui.displaySyncedLyrics(this.currentLyrics);
    if (this.sync?.currentIndex >= 0) {
      this.ui.updateCurrentLyric(this.sync.currentIndex);
    }
  }

  applyRomanizationIfNeeded(syncedLyrics) {
    const enabled = this.settings.get('showRomanization') === true;
    if (!enabled) return syncedLyrics;
    return syncedLyrics.map(line => {
      // Remove any inline word-timing markers like <00:12.34> before romanizing
      const cleanedLineText = line.text ? line.text.replace(/<\d{2}:\d{2}\.\d+>/g, '').trim() : '';
      const romanLine = Romanizer.romanize(cleanedLineText);

      const out = { ...line };
      if (romanLine) out.romanized = romanLine;

      // If word-level timings exist, attach per-word romanization as well
      if (line.words && Array.isArray(line.words)) {
        out.words = line.words.map(w => {
          const cleanedWord = w.word ? w.word.replace(/<\d{2}:\d{2}\.\d+>/g, '').trim() : w.word;
          const r = Romanizer.romanize(cleanedWord || '');
          return { ...w, roman: r || '' };
        });
      }

      return out;
    });
  }

  applyRomanizationToPlainIfNeeded(plainText) {
    const enabled = this.settings.get('showRomanization') === true;
    if (!enabled || !plainText) return plainText;
    const lines = plainText.split(/\r?\n/);
    const out = lines.map(l => {
      const r = Romanizer.romanize(l);
      return r ? `${l}\n${r}` : l;
    });
    return out.join('\n');
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

    // Destroy background elements to avoid leaking DOM/style nodes
    if (this.background && typeof this.background.destroy === 'function') {
      try { this.background.destroy(); } catch (e) { /* ignore */ }
    }

    // Cleanup YouTube integration (observers, intervals, listeners)
    if (this.youtube && typeof this.youtube.cleanup === 'function') {
      try { this.youtube.cleanup(); } catch (e) { /* ignore */ }
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
