import { UI_CONFIG } from './constants.js';

/**
 * Sync Module - Handles synchronized lyrics playback with optimized performance
 */

export class LyricsSync {
  constructor() {
    this.syncedLyrics = [];
    this.currentIndex = -1;
    this.lastKnownIndex = 0;
    this.delay = UI_CONFIG.SYNC_DELAY_DEFAULT;
    this.isPlaying = false;
    this.videoElement = null;
    this.updateCallback = null;
    this.animationFrameId = null;
  }

  /**
   * Initialize sync with video element
   */
  initialize(videoElement, syncedLyrics, delay = 0) {
    this.videoElement = videoElement;
    this.syncedLyrics = syncedLyrics;
    this.delay = delay;
    this.currentIndex = -1;
    this.lastKnownIndex = 0;
  }

  /**
   * Set delay for lyrics sync (in milliseconds)
   */
  setDelay(delay) {
    this.delay = delay;
  }

  /**
   * Set callback for lyric updates
   */
  onUpdate(callback) {
    this.updateCallback = callback;
  }

  /**
   * Find current lyric using optimized binary search
   * More efficient than linear search, especially for long lyrics
   */
  findCurrentLyric(currentTime) {
    if (!this.syncedLyrics || this.syncedLyrics.length === 0) {
      return null;
    }

    const adjustedTime = currentTime + (this.delay / 1000);

    // Start from last known position for better performance
    // Most of the time, we're moving forward sequentially
    if (this.lastKnownIndex >= 0 && this.lastKnownIndex < this.syncedLyrics.length) {
      const lyric = this.syncedLyrics[this.lastKnownIndex];
      const nextLyric = this.syncedLyrics[this.lastKnownIndex + 1];
      
      // Check if still in range of current lyric
      if (lyric.time <= adjustedTime && 
          (!nextLyric || nextLyric.time > adjustedTime)) {
        return { lyric, index: this.lastKnownIndex };
      }
    }

    // Binary search for the current lyric
    let left = 0;
    let right = this.syncedLyrics.length - 1;
    let result = null;
    let resultIndex = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const lyric = this.syncedLyrics[mid];

      if (lyric.time <= adjustedTime) {
        result = lyric;
        resultIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    if (result) {
      this.lastKnownIndex = resultIndex;
      return { lyric: result, index: resultIndex };
    }

    return null;
  }

  /**
   * Get previous lyric
   */
  getPreviousLyric(currentIndex) {
    if (currentIndex <= 0) {
      return null;
    }
    return this.syncedLyrics[currentIndex - 1];
  }

  /**
   * Get next lyric
   */
  getNextLyric(currentIndex) {
    if (currentIndex < 0 || currentIndex >= this.syncedLyrics.length - 1) {
      return null;
    }
    return this.syncedLyrics[currentIndex + 1];
  }

  /**
   * Get context around current lyric (for display)
   */
  getLyricContext(currentIndex, beforeCount = 3, afterCount = 3) {
    const start = Math.max(0, currentIndex - beforeCount);
    const end = Math.min(this.syncedLyrics.length, currentIndex + afterCount + 1);
    
    return {
      lyrics: this.syncedLyrics.slice(start, end),
      startIndex: start,
      currentRelativeIndex: currentIndex - start
    };
  }

  /**
   * Start syncing with video playback
   */
  start() {
    if (!this.videoElement || !this.syncedLyrics.length) {
      console.error('Cannot start sync: missing video element or lyrics');
      return;
    }

    this.isPlaying = true;
    this.syncLoop();
  }

  /**
   * Main sync loop using requestAnimationFrame for smooth updates
   */
  syncLoop() {
    if (!this.isPlaying) {
      return;
    }

    const currentTime = this.videoElement.currentTime;
    const result = this.findCurrentLyric(currentTime);

    if (result) {
      const { lyric, index } = result;
      
      // Always trigger callback with current time for word-level updates
      if (this.updateCallback) {
        const previous = this.getPreviousLyric(index);
        const next = this.getNextLyric(index);
        
        this.updateCallback({
          current: lyric,
          currentIndex: index,
          currentTime: currentTime,
          previous,
          next,
          totalCount: this.syncedLyrics.length,
          progress: (index / this.syncedLyrics.length) * 100,
          indexChanged: index !== this.currentIndex
        });
        
        this.currentIndex = index;
      }
    }

    // Use requestAnimationFrame for smooth updates
    // This is more efficient than setInterval
    this.animationFrameId = requestAnimationFrame(() => this.syncLoop());
  }

  /**
   * Stop syncing
   */
  stop() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Pause syncing
   */
  pause() {
    this.stop();
  }

  /**
   * Resume syncing
   */
  resume() {
    if (!this.isPlaying) {
      this.start();
    }
  }

  /**
   * Seek to specific lyric
   */
  seekToLyric(index) {
    if (index >= 0 && index < this.syncedLyrics.length && this.videoElement) {
      const lyric = this.syncedLyrics[index];
      this.videoElement.currentTime = lyric.time - (this.delay / 1000);
      this.currentIndex = index;
      this.lastKnownIndex = index;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    this.videoElement = null;
    this.updateCallback = null;
    this.syncedLyrics = [];
    this.currentIndex = -1;
    this.lastKnownIndex = 0;
  }
}
