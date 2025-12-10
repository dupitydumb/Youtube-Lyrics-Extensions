import { API, ERROR_MESSAGES, CACHE_CONFIG, FILTER_WORDS } from './constants.js';

/**
 * API Module - Handles all API interactions with retry logic and caching
 */

/**
 * Title Parser - Intelligent parsing of YouTube video titles
 */
export class TitleParser {
  /**
   * Parse YouTube title to extract song and artist
   * Handles formats like:
   * - "Song - Artist"
   * - "Artist - Song"
   * - "Song" (with channel as artist)
   * - "Song (feat. Artist)"
   */
  static parseTitle(title, channelName = '') {
    if (!title) return { song: '', artist: channelName, confidence: 0 };

    const originalTitle = title;
    title = title.trim();

    // Remove common video markers
    title = this.removeVideoMarkers(title);

    // Strategy 1: Check for " - " separator (most common)
    if (title.includes(' - ')) {
      const parts = title.split(' - ').map(p => p.trim());
      
      if (parts.length === 2) {
        // Determine which is song vs artist
        const [part1, part2] = parts;
        
        // If channel name matches one part, that's likely the artist
        if (channelName && this.similarity(part1, channelName) > 0.7) {
          return { song: part2, artist: part1, confidence: 0.9 };
        }
        if (channelName && this.similarity(part2, channelName) > 0.7) {
          return { song: part1, artist: part2, confidence: 0.9 };
        }
        
        // If first part is likely artist name (shorter, capitalized)
        if (part1.length < part2.length * 0.7 && this.isLikelyArtistName(part1)) {
          return { song: part2, artist: part1, confidence: 0.8 };
        }
        
        // Default: assume "Song - Artist" format
        return { song: part1, artist: part2, confidence: 0.75 };
      }
    }

    // Strategy 2: Check for parentheses with featuring
    const featMatch = title.match(/(.+?)\s*\((?:feat\.|featuring|ft\.)\s*(.+?)\)/i);
    if (featMatch) {
      return { song: featMatch[1].trim(), artist: channelName || featMatch[2].trim(), confidence: 0.7 };
    }

    // Strategy 3: Check for pipe separator
    if (title.includes(' | ')) {
      const parts = title.split(' | ').map(p => p.trim());
      return { song: parts[0], artist: channelName || parts[1] || '', confidence: 0.6 };
    }

    // Strategy 4: Just song name, use channel as artist
    return { song: title, artist: channelName, confidence: channelName ? 0.8 : 0.4 };
  }

  /**
   * Remove video markers from title
   */
  static removeVideoMarkers(title) {
    // Remove brackets and parentheses with common terms
    const patterns = [
      /\[.*?(?:official|lyric|lyrics|video|audio|mv|music|visualizer|hd|4k).*?\]/gi,
      /\(.*?(?:official|lyric|lyrics|video|audio|mv|music|visualizer|hd|4k).*?\)/gi
    ];

    for (const pattern of patterns) {
      title = title.replace(pattern, '');
    }

    return title.trim();
  }

  /**
   * Check if string is likely an artist name
   */
  static isLikelyArtistName(str) {
    // Artist names are usually:
    // - Capitalized
    // - Shorter (1-3 words)
    // - Don't contain common song words
    const words = str.split(/\s+/);
    if (words.length > 4) return false;
    
    const songWords = ['the', 'a', 'an', 'my', 'your', 'our', 'their', 'in', 'on', 'at', 'to', 'for'];
    const hasSongWords = words.some(w => songWords.includes(w.toLowerCase()));
    
    return !hasSongWords;
  }

  /**
   * Calculate string similarity (0-1)
   */
  static similarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    if (str1 === str2) return 1;
    
    // Simple character overlap ratio
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Format title for search (remove filter words)
   */
  static formatForSearch(title) {
    if (!title) return '';
    
    const notAllowed = new Set([...FILTER_WORDS.BASIC.map(w => w.toLowerCase())]);
    
    let formatted = title.toLowerCase().split(/\s+/)
      .filter(word => !notAllowed.has(word) && !/[\uAC00-\uD7AF]/.test(word))
      .join(' ');
    
    return formatted.trim();
  }
}

export class LyricsAPI {
  constructor() {
    this.cache = new Map();
    this._saveTimeout = null; // debounce save to storage
    this.loadCache();
  }

  /**
   * Load cache from Chrome storage
   */
  async loadCache() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }
      const result = await chrome.storage.local.get(['lyricsCache']);
      if (result.lyricsCache) {
        this.cache = new Map(Object.entries(result.lyricsCache));
        this.cleanExpiredCache();
      }
    } catch (error) {
      // Failed to load cache
    }
  }

  /**
   * Save cache to Chrome storage
   */
  async saveCache() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }
      const cacheObject = Object.fromEntries(this.cache);
      await chrome.storage.local.set({ lyricsCache: cacheObject });
    } catch (error) {
      // Failed to save cache
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
      // Evict oldest by insertion order (Map preserves insertion order)
      const excess = this.cache.size - CACHE_CONFIG.MAX_SIZE;
      const keys = this.cache.keys();
      for (let i = 0; i < excess; i++) {
        const k = keys.next().value;
        if (k) this.cache.delete(k);
      }
    }
  }

  /**
   * Get cached lyrics
   */
  getCached(query) {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.EXPIRY_TIME) {
      // Move to most-recent (LRU) by re-inserting
      try {
        this.cache.delete(query);
        this.cache.set(query, cached);
      } catch (e) {}
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

    // Enforce max size immediately (evict oldest)
    if (this.cache.size > CACHE_CONFIG.MAX_SIZE) {
      const excess = this.cache.size - CACHE_CONFIG.MAX_SIZE;
      const keys = this.cache.keys();
      for (let i = 0; i < excess; i++) {
        const k = keys.next().value;
        if (k) this.cache.delete(k);
      }
    }

    // Debounce saving to chrome.storage to avoid frequent writes
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this.saveCache().catch(() => {});
      this._saveTimeout = null;
    }, 1000);
  }

  /**
   * Search for lyrics with retry logic
   */
  async searchLyrics(query, attemptCount = 0) {
    // Check cache first
    const cached = this.getCached(query);
    if (cached) {
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
      // Retry logic with exponential backoff
      if (attemptCount < API.RETRY_ATTEMPTS) {
        const delay = API.RETRY_DELAY * Math.pow(2, attemptCount);
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
   * Find best matching lyrics from results with fuzzy matching
   */
  findBestMatch(results, artistName = '', songName = '') {
    if (!results || results.length === 0) {
      return null;
    }

    if (!artistName && !songName) {
      return results[0];
    }

    // Score each result
    const scoredResults = results.map(result => {
      let score = 0;
      
      // Artist matching (weighted 60%)
      if (artistName && result.artistName) {
        const artistSimilarity = TitleParser.similarity(artistName, result.artistName);
        score += artistSimilarity * 0.6;
        
        // Bonus for exact match
        if (artistName.toLowerCase() === result.artistName.toLowerCase()) {
          score += 0.2;
        }
      }
      
      // Song name matching (weighted 40%)
      if (songName && result.trackName) {
        const songSimilarity = TitleParser.similarity(songName, result.trackName);
        score += songSimilarity * 0.4;
      }
      
      // Bonus for having synced lyrics
      if (result.syncedLyrics) {
        score += 0.1;
      }
      
      return { result, score };
    });

    // Sort by score (highest first)
    scoredResults.sort((a, b) => b.score - a.score);

    // Return best match if confidence is reasonable
    if (scoredResults[0].score > 0.3) {
      return scoredResults[0].result;
    }

    // Low confidence, return first result
    return results[0];
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
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove(['lyricsCache']);
    }
  }
}
