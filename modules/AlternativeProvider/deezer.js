/**
 * Deezer LRC provider (API powered by LyricFind)
 * Converted from Python to JavaScript
 * Based on https://gist.github.com/akashrchandran/95915c2081397c454bd8aa4a118b5
 * 
 * Note: Currently may have CSRF token issues
 */

class Deezer {
  constructor(customFetch = null) {
    this.providerName = 'Deezer';
    this.SEARCH_ENDPOINT = 'https://api.deezer.com/search?q=';
    this.API_ENDPOINT = 'https://www.deezer.com/ajax/gw-light.php';
    this.token = 'null';
    // Custom fetch function to bypass CORS via background script
    this.customFetch = customFetch;
  }

  /**
   * Initialize the provider by fetching user token
   */
  async init() {
    try {
      const userData = await this._apiCall('deezer.getUserData');
      if (userData?.results?.checkForm) {
        this.token = userData.results.checkForm;
        console.log('[Deezer] Token obtained successfully');
      } else {
        console.warn('[Deezer] Failed to obtain token from getUserData');
      }
    } catch (error) {
      console.error('[Deezer] Error initializing:', error);
    }
    return this;
  }

  /**
   * Make an API call to Deezer
   * @param {string} method - API method to call
   * @param {object} json - JSON body to send
   * @returns {Promise<object>} - API response
   */
  async _apiCall(method, json = null) {
    const params = new URLSearchParams({
      api_version: '1.0',
      api_token: this.token,
      input: '3',
      method: method
    });

    const url = `${this.API_ENDPOINT}?${params.toString()}`;
    console.log(`[Deezer] API call: ${method}, token: ${this.token?.substring(0, 10)}...`);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    if (json) {
      options.body = JSON.stringify(json);
    }

    let response;
    try {
      if (this.customFetch) {
        response = await this.customFetch(url, options);
      } else {
        response = await fetch(url, options);
      }

      let data;
      if (typeof response.json === 'function') {
        data = await response.json();
      } else {
        data = response;
      }
      
      console.log(`[Deezer] API response for ${method}:`, data?.error ? data.error : 'OK');
      return data;
    } catch (error) {
      console.error(`[Deezer] API call failed for ${method}:`, error);
      throw error;
    }
  }

  /**
   * Get lyrics by track ID - returns in same format as Musixmatch
   * @param {string|number} trackId - Deezer track ID
   * @returns {Promise<object>} - Lyrics object with synced property
   */
  async getLrcById(trackId) {
    try {
      console.log(`[Deezer] Fetching lyrics for track ID: ${trackId}`);
      // Pass country as US to ensure lyrics availability
      const lrcResponse = await this._apiCall('song.getLyrics', { 
        sng_id: String(trackId),
        COUNTRY: 'US'
      });
      console.log('[Deezer] Lyrics API response:', JSON.stringify(lrcResponse, null, 2));

      if (!lrcResponse?.results) {
        console.log('[Deezer] No results in lyrics response');
        return { synced: null };
      }

      const lrcJsonObjs = lrcResponse.results.LYRICS_SYNC_JSON;
      console.log(`[Deezer] Found ${lrcJsonObjs?.length || 0} synced lyrics entries`);

      if (!lrcJsonObjs || lrcJsonObjs.length === 0) {
        // No synced lyrics available
        const unsyncedText = lrcResponse.results.LYRICS_TEXT;
        if (unsyncedText) {
          console.log('[Deezer] No synced lyrics, using unsynced text');
          // Convert unsynced to pseudo-synced format (one line at a time)
          const lines = unsyncedText.split('\n').filter(l => l.trim());
          let lrcStr = '';
          lines.forEach((line, idx) => {
            // Use placeholder timestamps for unsynced lyrics
            const min = Math.floor(idx * 5 / 60);
            const sec = (idx * 5) % 60;
            lrcStr += `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.00] ${line}\n`;
          });
          return { synced: lrcStr.trim(), isUnsyncedFallback: true };
        }
        console.log('[Deezer] No lyrics available (neither synced nor unsynced)');
        return { synced: null };
      }

      // Build synced lyrics string in LRC format
      let lrcStr = '';
      for (const chunk of lrcJsonObjs) {
        if (chunk.lrc_timestamp && chunk.line) {
          lrcStr += `${chunk.lrc_timestamp} ${chunk.line}\n`;
        }
      }

      console.log(`[Deezer] Built LRC string with ${lrcStr.split('\n').length} lines`);
      return { synced: lrcStr.trim() || null };

    } catch (error) {
      console.error('[Deezer] Error getting lyrics by track ID:', error);
      return { synced: null };
    }
  }

  /**
   * Search for a track and get its lyrics (matches Musixmatch getLrc interface)
   * @param {string} searchTerm - Search query (song + artist)
   * @returns {Promise<object>} - Lyrics object with synced property
   */
  async getLrc(searchTerm) {
    try {
      // Initialize token if not already done
      if (this.token === 'null') {
        await this.init();
      }

      console.log(`[Deezer] Searching for: "${searchTerm}"`);
      const url = this.SEARCH_ENDPOINT + encodeURIComponent(searchTerm);

      let response;
      if (this.customFetch) {
        response = await this.customFetch(url, { method: 'GET' });
      } else {
        response = await fetch(url);
      }

      let searchResults;
      if (typeof response.json === 'function') {
        searchResults = await response.json();
      } else {
        searchResults = response;
      }

      const data = searchResults?.data;
      if (!data || data.length === 0) {
        console.log('[Deezer] No search results found');
        return null;
      }

      console.log(`[Deezer] Found ${data.length} tracks`);

      // Find best match
      const track = this._getBestMatch(data, searchTerm);
      if (!track) {
        console.log('[Deezer] No suitable match found');
        return null;
      }

      console.log(`[Deezer] Best match: "${track.title}" by "${track.artist?.name}" (ID: ${track.id})`);
      return await this.getLrcById(track.id);

    } catch (error) {
      console.error('[Deezer] Error getting lyrics:', error);
      return null;
    }
  }

  /**
   * Find the best matching track from search results
   * @param {Array} tracks - Array of track objects
   * @param {string} searchTerm - Original search term
   * @returns {object|null} - Best matching track or null
   */
  _getBestMatch(tracks, searchTerm) {
    if (!tracks || tracks.length === 0) {
      return null;
    }

    const normalizedSearch = this._normalize(searchTerm);

    let bestMatch = null;
    let bestScore = -1;

    for (const track of tracks) {
      const trackStr = `${track.title || ''} ${track.artist?.name || ''}`;
      const normalizedTrack = this._normalize(trackStr);

      // Calculate similarity score
      let score = this._similarity(normalizedSearch, normalizedTrack);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = track;
      }
    }

    // Return match only if score is above threshold, otherwise first result
    return bestScore >= 0.3 ? bestMatch : (tracks[0] || null);
  }

  /**
   * Normalize string for comparison
   * @param {string} str - Input string
   * @returns {string} - Normalized string
   */
  _normalize(str) {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score between 0 and 1
   */
  _similarity(str1, str2) {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    let matches = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }
}

export { Deezer };
