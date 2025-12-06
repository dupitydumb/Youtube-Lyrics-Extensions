import crypto from 'crypto';

class NetEaseLyricsProvider {
  constructor() {
    this.providerName = 'NetEase';
    this.searchUrl = 'https://music.163.com/weapi/search/get';
    this.lyricUrl = 'https://music.163.com/weapi/song/lyric?csrf_token=';
    this.referer = 'https://music.163.com';
  }

  // Main method to get lyrics
  async getLyrics(songName, artist, duration = null, searchDepth = 5) {
    try {
      // Step 1: Search for the song
      const songId = await this.searchSong(songName, artist, duration, searchDepth);
      
      // Step 2: Get lyrics using song ID
      const lyrics = await this.downloadLyrics(songId);
      
      return lyrics;
    } catch (error) {
      throw new Error(`Failed to get lyrics: ${error.message}`);
    }
  }

  // Search for song and return song ID
  async searchSong(songName, artist, duration, searchDepth) {
    const secretKey = this.createSecretKey(16);
    const encSecKey = this.rsaEncrypt(secretKey);
    
    const searchParams = {
      s: songName,
      type: 1,
      limit: searchDepth,
      offset: 0
    };

    const encryptedData = this.prepareRequest(searchParams, secretKey, encSecKey);
    
    const response = await fetch(this.searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': this.referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: new URLSearchParams(encryptedData)
    });

    const data = await response.json();
    
    // Validate response
    if (data.code !== 200) {
      throw new Error('Search request failed');
    }

    if (!data.result || !data.result.songs || data.result.songs.length === 0) {
      throw new Error('No matching songs found');
    }

    // Find best match based on song name and duration
    return this.findBestMatch(data.result.songs, songName, duration);
  }

  // Download lyrics using song ID
  async downloadLyrics(songId) {
    const secretKey = this.createSecretKey(16);
    const encSecKey = this.rsaEncrypt(secretKey);
    
    const lyricParams = {
      id: songId,
      lv: -1,
      tv: -1
    };

    const encryptedData = this.prepareRequest(lyricParams, secretKey, encSecKey);
    
    const response = await fetch(this.lyricUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': this.referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: new URLSearchParams(encryptedData)
    });

    const data = await response.json();
    
    return this.parseLyrics(data);
  }

  // Parse and format lyrics
  parseLyrics(data) {
    if (!data.lrc || !data.lrc.lyric) {
      return {
        original: null,
        translation: null,
        message: 'No lyrics available'
      };
    }

    const originalLyric = data.lrc.lyric;
    
    // Check for instrumental track
    if (originalLyric.includes('纯音乐，请欣赏')) {
      return {
        original: null,
        translation: null,
        message: 'Instrumental track'
      };
    }

    return {
      original: originalLyric,
      translation: data.tlyric?.lyric || null,
      romaji: data.romalrc?.lyric || null
    };
  }

  // Find best matching song
  findBestMatch(songs, songName, duration) {
    if (songs.length === 1) {
      return songs[0].id;
    }

    // Try to match by duration if provided
    if (duration) {
      const durationMs = duration * 1000;
      const match = songs.find(song => 
        Math.abs(song.duration - durationMs) < 3000 // Within 3 seconds
      );
      if (match) return match.id;
    }

    // Return first match
    return songs[0].id;
  }

  // Prepare encrypted request
  prepareRequest(params, secretKey, encSecKey) {
    const paramsStr = JSON.stringify(params);
    const nonce = '0CoJUm6Qyw8W8jud';
    
    // Double AES encryption
    const firstEncrypt = this.aesEncrypt(paramsStr, nonce);
    const secondEncrypt = this.aesEncrypt(firstEncrypt, secretKey);
    
    return {
      params: secondEncrypt,
      encSecKey: encSecKey
    };
  }

  // AES encryption
  aesEncrypt(text, key) {
    const iv = '0102030405060708';
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  // RSA encryption
  rsaEncrypt(text) {
    const publicKey = '010001';
    const modulus = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
    
    const reversedText = text.split('').reverse().join('');
    const hexText = Buffer.from(reversedText, 'utf8').toString('hex');
    
    // Using BigInt for RSA calculation
    const num = BigInt('0x' + hexText);
    const exp = BigInt('0x' + publicKey);
    const mod = BigInt('0x' + modulus);
    
    const result = this.powMod(num, exp, mod);
    return result.toString(16).padStart(256, '0');
  }

  // Modular exponentiation
  powMod(base, exponent, modulus) {
    let result = 1n;
    base = base % modulus;
    
    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent >> 1n;
      base = (base * base) % modulus;
    }
    
    return result;
  }

  // Generate random secret key
  createSecretKey(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

// Usage example
async function main() {
  const provider = new NetEaseLyricsProvider();
  
  try {
    const lyrics = await provider.getLyrics('Taylor Swift', 'Love Story');
    
    if (lyrics.original) {
      console.log('Original Lyrics:');
      console.log(lyrics.original);
      
      if (lyrics.translation) {
        console.log('\nTranslation:');
        console.log(lyrics.translation);
      }
    } else {
      console.log(lyrics.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

// Export for use as module
export default NetEaseLyricsProvider;

// Uncomment to run example
// main();