class KuGouLyricsProvider {
  constructor(searchDepth = 5) {
    this.providerName = 'KuGou';
    this.searchDepth = searchDepth;
    this.searchUrl = 'https://songsearch.kugou.com/song_search_v2';
    this.accessKeyUrl = 'http://lyrics.kugou.com/search';
    this.lyricUrl = 'http://lyrics.kugou.com/download';
  }

  // Main method to get lyrics
  async getLyrics(songName, artist, duration = null) {
    try {
      // Step 1: Search for the song
      const searchResult = await this.searchSong(songName, artist);
      
      // Step 2: Get access key for lyrics
      const accessKey = await this.getAccessKey(searchResult.fileHash);
      
      // Step 3: Download lyrics
      const lyrics = await this.downloadLyrics(accessKey.id, accessKey.accessKey);
      
      return lyrics;
    } catch (error) {
      throw new Error(`Failed to get lyrics: ${error.message}`);
    }
  }

  // Search for song
  async searchSong(songName, artist) {
    const params = new URLSearchParams({
      keyword: `${songName} ${artist}`.trim(),
      page: 1,
      pagesize: this.searchDepth,
      userid: '-1',
      clientver: '',
      platform: 'WebFilter',
      tag: 'em',
      filter: 2,
      iscorrection: 1,
      privilege_filter: 0
    });

    const response = await fetch(`${this.searchUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await response.json();
    
    // Validate response
    if ((data.error_code !== 0 && data.status !== 1) || !data.data?.lists || data.data.lists.length === 0) {
      throw new Error('No matching songs found');
    }

    // Return first match
    return {
      fileHash: data.data.lists[0].FileHash,
      songName: data.data.lists[0].SongName,
      singerName: data.data.lists[0].SingerName
    };
  }

  // Get access key for lyrics
  async getAccessKey(fileHash) {
    const params = new URLSearchParams({
      ver: 1,
      man: 'yes',
      client: 'pc',
      keyword: '',
      hash: fileHash,
      timelength: ''
    });

    const response = await fetch(`${this.accessKeyUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No lyrics access key found');
    }

    const firstCandidate = data.candidates[0];
    
    return {
      id: firstCandidate.id,
      accessKey: firstCandidate.accesskey
    };
  }

  // Download and decode lyrics
  async downloadLyrics(id, accessKey) {
    const params = new URLSearchParams({
      ver: 1,
      client: 'pc',
      id: id,
      accesskey: accessKey,
      fmt: 'lrc',
      charset: 'utf8'
    });

    const response = await fetch(`${this.lyricUrl}?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await response.json();
    
    // Validate response
    if (data.status !== 200) {
      throw new Error('Failed to download lyrics');
    }

    // Decode base64 lyrics
    const lyricText = this.decodeBase64(data.content);
    
    return {
      original: lyricText,
      translation: null // KuGou typically doesn't provide translations
    };
  }

  // Decode base64 string
  decodeBase64(base64String) {
    if (!base64String) {
      throw new Error('No lyrics content available');
    }
    
    // Node.js environment
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64String, 'base64').toString('utf8');
    }
    
    // Browser environment
    return decodeURIComponent(escape(atob(base64String)));
  }

  // Parse LRC format to structured data (optional utility)
  parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];
    const metadata = {};

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const metaRegex = /\[([a-z]+):([^\]]+)\]/i;

    for (const line of lines) {
      const metaMatch = line.match(metaRegex);
      
      if (metaMatch && !line.includes(':') || metaMatch && line.indexOf('[') === line.lastIndexOf('[')) {
        // Metadata line like [ar:Artist] or [ti:Title]
        metadata[metaMatch[1]] = metaMatch[2];
      } else {
        // Lyric line with timestamps
        let match;
        const timestamps = [];
        
        while ((match = timeRegex.exec(line)) !== null) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const milliseconds = parseInt(match[3].padEnd(3, '0'));
          const totalMs = (minutes * 60 + seconds) * 1000 + milliseconds;
          timestamps.push(totalMs);
        }

        if (timestamps.length > 0) {
          const text = line.replace(timeRegex, '').trim();
          timestamps.forEach(time => {
            lyrics.push({ time, text });
          });
        }
      }
    }

    // Sort by time
    lyrics.sort((a, b) => a.time - b.time);

    return {
      metadata,
      lyrics
    };
  }
}

// Usage example
async function main() {
  const provider = new KuGouLyricsProvider();
  
  try {
    const lyrics = await provider.getLyrics('Taylor Swift', 'Love Story');
    
    console.log('Original Lyrics:');
    console.log(lyrics.original);
    
    // Optional: Parse LRC format
    console.log('\n--- Parsed LRC ---');
    const parsed = provider.parseLRC(lyrics.original);
    console.log('Metadata:', parsed.metadata);
    console.log('First 5 lines:');
    parsed.lyrics.slice(0, 5).forEach(line => {
      const seconds = (line.time / 1000).toFixed(2);
      console.log(`[${seconds}s] ${line.text}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Export for use as module
export default KuGouLyricsProvider;

// Uncomment to run example
main();