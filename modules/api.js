import { API, ERROR_MESSAGES, CACHE_CONFIG } from './constants.js';

/**
 * API Module - Handles all API interactions with retry logic and caching
 */

class LyricsAPI {
  constructor() {
    this.cache = new Map();
    this.loadCache();
  }

  /**
   * Load cache from Chrome storage
   */
  async loadCache() {
    try {
      const result = await chrome.storage.local.get(['lyricsCache']);
      if (result.lyricsCache) {
        this.cache = new Map(Object.entries(result.lyricsCache));
        this.cleanExpiredCache();
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  /**
   * Save cache to Chrome storage
   */
  async saveCache() {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      await chrome.storage.local.set({ lyricsCache: cacheObject });
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp && now - value.timestamp > CACHE_CONFIG.EXPIRY_TIME) {
        this.cache.delete(key);
      }
    }
    
    // Limit cache size
    if (this.cache.size > CACHE_CONFIG.MAX_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
      const toDelete = entries.slice(0, entries.length - CACHE_CONFIG.MAX_SIZE);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Get cached lyrics
   */
  getCached(query) {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.EXPIRY_TIME) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache entry
   */
  setCache(query, data) {
    this.cache.set(query, {
      data,
      timestamp: Date.now()
    });
    this.saveCache();
  }

  /**
   * Search for lyrics with retry logic
   */
  async searchLyrics(query, attemptCount = 0) {
    // Check cache first
    const cached = this.getCached(query);
    if (cached) {
      console.log('Lyrics found in cache');
      return cached;
    }

    const url = `${API.BASE_URL}${API.SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API.TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Cache the result
      this.setCache(query, data);
      
      return data;

    } catch (error) {
      console.error(`Lyrics search failed (attempt ${attemptCount + 1}):`, error);

      // Retry logic with exponential backoff
      if (attemptCount < API.RETRY_ATTEMPTS) {
        const delay = API.RETRY_DELAY * Math.pow(2, attemptCount);
        console.log(`Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.searchLyrics(query, attemptCount + 1);
      }

      // All retries failed
      if (error.name === 'AbortError') {
        throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
      }
      throw new Error(ERROR_MESSAGES.API_ERROR);
    }
  }

  /**
   * Find best matching lyrics from results
   */
  findBestMatch(results, artistName = '') {
    if (!results || results.length === 0) {
      return null;
    }

    if (!artistName) {
      return results[0];
    }

    // Try to find exact artist match
    const exactMatch = results.find(result => 
      result.artistName && 
      result.artistName.toLowerCase() === artistName.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch;
    }

    // Try partial match
    const partialMatch = results.find(result => 
      result.artistName && 
      result.artistName.toLowerCase().includes(artistName.toLowerCase())
    );

    return partialMatch || results[0];
  }

  /**
   * Parse synced lyrics from LRC format
   */
  parseSyncedLyrics(lrcString) {
    if (!lrcString) {
      return [];
    }

    try {
      const lines = lrcString.split('\n');
      const syncedLyrics = [];

      for (const line of lines) {
        // Match LRC format: [mm:ss.xx] or [mm:ss]
        const match = line.match(/\[(\d+):(\d+)\.?(\d+)?\]\s*(.+)/);
        
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const centiseconds = match[3] ? parseInt(match[3]) : 0;
          const text = match[4].trim();

          if (text) {
            const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
            const lyricObj = {
              time: timeInSeconds,
              text: text
            };
            
            // Try to parse word-level timing from enhanced LRC format
            // Format: <mm:ss.xx>word <mm:ss.xx>word2
            const wordTimings = this.parseWordTimings(text, timeInSeconds);
            if (wordTimings.length > 0) {
              lyricObj.words = wordTimings;
            }
            
            syncedLyrics.push(lyricObj);
          }
        }
      }

      return syncedLyrics.sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error('Failed to parse synced lyrics:', error);
      return [];
    }
  }

  /**
   * Parse word-level timings from lyrics text
   * Supports formats like: <00:12.34>word <00:12.56>another
   */
  parseWordTimings(text, lineTime) {
    const words = [];
    
    // Check if text contains word-level timing markers
    const wordTimingRegex = /<(\d+):(\d+)\.(\d+)>([^<]+)/g;
    let match;
    let hasWordTimings = false;
    
    while ((match = wordTimingRegex.exec(text)) !== null) {
      hasWordTimings = true;
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const centiseconds = parseInt(match[3]);
      const word = match[4].trim();
      
      words.push({
        word: word,
        time: minutes * 60 + seconds + centiseconds / 100
      });
    }
    
    // If no word timings found, estimate based on word position
    if (!hasWordTimings && text) {
      const plainWords = text.split(/\s+/);
      const wordsPerSecond = 2.5; // Average speaking rate
      const timePerWord = 1 / wordsPerSecond;
      
      plainWords.forEach((word, index) => {
        words.push({
          word: word,
          time: lineTime + (index * timePerWord)
        });
      });
    }
    
    return words;
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    this.cache.clear();
    await chrome.storage.local.remove(['lyricsCache']);
  }
}

// Export singleton instance
export const lyricsAPI = new LyricsAPI();
