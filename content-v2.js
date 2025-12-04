/**
 * YouTube Lyrics Extension v2.0 - Refactored with Apple Music Style UI
 * All-in-one file compatible with Chrome extensions (no ES6 imports)
 */

(function() {
  'use strict';

  // ==================== INJECT EXTERNAL CSS ====================
  
  function injectCSS() {
    if (document.getElementById('lyrics-external-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'lyrics-external-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles/content.css');
    document.head.appendChild(link);
  }
  
  injectCSS();

  // ==================== CONSTANTS ====================
  
  const CONSTANTS = {
    API: {
      BASE_URL: 'https://lrclib.net/api',
      SEARCH_ENDPOINT: '/search',
      TIMEOUT: 10000,
      RETRY_ATTEMPTS: 2,
      RETRY_DELAY: 1000
    },
    
    SELECTORS: {
      SECONDARY_INNER: '#secondary-inner',
      VIDEO_TITLE: '#title > h1 > yt-formatted-string',
      ARTIST_NAME: '#text > a',
      VIDEO_PLAYER: 'video'
    },
    
    PRESET_GRADIENTS: [
      { name: 'Sunset', colors: ['#FF6B6B', '#FFE66D', '#4ECDC4', '#FF6B9D'] },
      { name: 'Ocean', colors: ['#667eea', '#764ba2', '#f093fb', '#4facfe'] },
      { name: 'Forest', colors: ['#56ab2f', '#a8e063', '#38ef7d', '#11998e'] },
      { name: 'Fire', colors: ['#f83600', '#f9d423', '#ff0844', '#ffb199'] },
      { name: 'Purple Dream', colors: ['#c471f5', '#fa71cd', '#a770ef', '#fdb99b'] },
      { name: 'Cool Blues', colors: ['#2193b0', '#6dd5ed', '#00d2ff', '#3a7bd5'] },
      { name: 'Warm Sunset', colors: ['#ff9a56', '#ff6a00', '#ee0979', '#ff6a00'] },
      { name: 'Northern Lights', colors: ['#00c6ff', '#0072ff', '#00f260', '#0575e6'] },
      { name: 'Peach', colors: ['#ffecd2', '#fcb69f', '#ff9a9e', '#fecfef'] },
      { name: 'Neon', colors: ['#f953c6', '#b91d73', '#12c2e9', '#c471ed'] }
    ],
    
    UI: {
      PANEL_ID: 'Lyric-Panel',
      PANEL_CONTAINER_ID: 'Lyric-Panel-Container',
      SYNC_DELAY_DEFAULT: 0,
      
      // Control Sections
      SECTIONS: {
        SONG: { id: 'song-section', title: '🎵 Song Selection', icon: '🎵', defaultOpen: false },
        PLAYBACK: { id: 'playback-section', title: '▶️ Playback Mode', icon: '▶️', defaultOpen: true },
        SYNC: { id: 'sync-section', title: '⏱️ Sync Timing', icon: '⏱️', defaultOpen: false },
        VISUAL: { id: 'visual-section', title: '🎨 Visual Settings', icon: '🎨', defaultOpen: false }
      },
      
      // Responsive Typography Scale (rem-based)
      TYPOGRAPHY: {
        // Fluid font sizes using clamp()
        SIZES: {
          XSMALL: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
          SMALL: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
          BASE: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
          MEDIUM: 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',
          LARGE: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
          XLARGE: 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',
          CURRENT: 'clamp(1.75rem, 1.5rem + 1.25vw, 2.25rem)'
        },
        WEIGHTS: {
          LIGHT: '300',
          REGULAR: '400',
          MEDIUM: '500',
          SEMIBOLD: '600',
          BOLD: '700'
        },
        LINE_HEIGHTS: {
          TIGHT: '1.3',
          NORMAL: '1.5',
          RELAXED: '1.7',
          LOOSE: '2'
        },
        LETTER_SPACING: {
          TIGHT: '-0.02em',
          NORMAL: '0',
          WIDE: '0.01em',
          WIDER: '0.02em'
        }
      },
      
      // Dynamic Spacing System
      SPACING: {
        XXS: 'clamp(0.25rem, 0.2rem + 0.25vw, 0.375rem)',
        XS: 'clamp(0.5rem, 0.45rem + 0.25vw, 0.625rem)',
        SM: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        MD: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
        LG: 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        XL: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
        XXL: 'clamp(2rem, 1.75rem + 1.25vw, 2.5rem)'
      },
      
      // Apple Music Design System
      APPLE_MUSIC: {
        BACKGROUND: 'rgba(0, 0, 0, 0.85)',
        BACKDROP_BLUR: 'clamp(20px, 5vw, 40px)',
        CURRENT_SCALE: 1.15,
        PAST_OPACITY: 0.35,
        FUTURE_OPACITY: 0.55,
        TRANSITIONS: {
          FAST: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          NORMAL: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          SLOW: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          ELASTIC: '0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
        },
        STAGGER_DELAY: 0.03,
        MAX_HEIGHT: 'clamp(400px, 60vh, 700px)',
        MAX_WIDTH: 'clamp(600px, 80vw, 900px)',
        RADIUS: {
          SM: 'clamp(0.375rem, 0.35rem + 0.125vw, 0.5rem)',
          MD: 'clamp(0.5rem, 0.45rem + 0.25vw, 0.75rem)',
          LG: 'clamp(0.75rem, 0.7rem + 0.25vw, 1rem)'
        }
      }
    },
    
    FILTER_WORDS: {
      BASIC: ['official', 'video', 'lyric', 'lyrics', 'music', 'audio', 'mv', 'M/V', 
              '(Official Video)', '(Official Music Video)', '[Official Video]'],
      EXTENDED: ['MV', 'M/V', 'Official', 'Video', 'Lyric', 'Music', 'Audio', 
                 'Live', 'clip', 'HD', '4K']
    },
    
    KOREAN_RANGE: { START: 44032, END: 55203 },
    
    MESSAGES: {
      NO_LYRICS: "I'm sorry, I cannot find the lyrics for this song.",
      API_ERROR: "Failed to fetch lyrics. Please try again later.",
      LOADING: "Loading lyrics..."
    }
  };

  // ==================== STATE ====================
  
  const state = {
    isEnabled: false,
    hasRun: false,
    currentTitle: '',
    currentData: null,
    syncedLyrics: [],
    titleObserver: null,
    background: {
      mode: 'album', // 'none', 'gradient', 'album', 'video'
      imageUrl: null,
      dominantColor: null,
      element: null,
      gradientTheme: 'random', // 'random', 'Sunset', 'Ocean', etc., or 'custom'
      customColors: ['#667eea', '#764ba2', '#f093fb', '#4facfe']
    },
    sync: {
      currentIndex: -1,
      lastKnownIndex: 0,
      delay: 0,
      isPlaying: false,
      videoElement: null,
      animationFrameId: null,
      handlePlay: null,
      handlePause: null
    },
    ui: {
      panel: null,
      container: null,
      lyricsContainer: null,
      controlsContainer: null,
      collapsedSections: {},
      controlsVisible: false,
      fullscreenMode: false,
      fullscreenOverlay: null,
      keyboardHandler: null
    },
    cache: new Map()
  };

  // ==================== UTILITY FUNCTIONS ====================
  
  function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ==================== BACKGROUND UTILITIES ====================

  function extractVideoThumbnail() {
    // Extract video ID from URL to ensure we get the current video's thumbnail
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (videoId) {
      // Directly construct thumbnail URL from current video ID
      // This ensures we always get the current video's thumbnail, not a cached meta tag
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
    
    // Fallback: Try to get from YouTube metadata
    const metaOgImage = document.querySelector('meta[property="og:image"]');
    if (metaOgImage) {
      let thumbnailUrl = metaOgImage.content;
      // Convert to maxresdefault for highest quality
      thumbnailUrl = thumbnailUrl.replace(/\/vi\/([^\/]+)\/.*/, '/vi/$1/maxresdefault.jpg');
      return thumbnailUrl;
    }
    
    // Last fallback: extract from video element
    const video = document.querySelector('video');
    if (video) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      } catch (e) {
        console.error('Failed to capture video frame:', e);
      }
    }
    
    return null;
  }

  function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 100;
          canvas.height = 100;
          
          ctx.drawImage(img, 0, 0, 100, 100);
          const imageData = ctx.getImageData(0, 0, 100, 100).data;
          
          let r = 0, g = 0, b = 0, count = 0;
          
          // Sample every 4th pixel for performance
          for (let i = 0; i < imageData.length; i += 16) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
          }
          
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          resolve(`rgb(${r}, ${g}, ${b})`);
        } catch (e) {
          console.error('Failed to extract color:', e);
          resolve('rgb(30, 30, 35)');
        }
      };
      
      img.onerror = () => {
        resolve('rgb(30, 30, 35)');
      };
      
      img.src = imageUrl;
    });
  }

  async function loadBackgroundSettings() {
    try {
      const data = await chrome.storage.sync.get(['backgroundMode', 'gradientTheme', 'customColors']);
      state.background.mode = data.backgroundMode || 'album';
      state.background.gradientTheme = data.gradientTheme || 'random';
      state.background.customColors = data.customColors || ['#667eea', '#764ba2', '#f093fb', '#4facfe'];
    } catch (error) {
      console.warn('Failed to load background settings:', error);
      state.background.mode = 'album';
      state.background.gradientTheme = 'random';
    }
  }

  function saveBackgroundSettings() {
    try {
      chrome.storage.sync.set({ 
        backgroundMode: state.background.mode,
        gradientTheme: state.background.gradientTheme,
        customColors: state.background.customColors
      });
    } catch (error) {
      console.warn('Failed to save background settings:', error);
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : 'rgb(102, 126, 234)';
  }

  function generateRandomGradientColors() {
    const colors = [];
    for (let i = 0; i < 4; i++) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 60 + Math.floor(Math.random() * 30);
      const lightness = 50 + Math.floor(Math.random() * 20);
      
      // Convert HSL to RGB
      const h = hue / 360;
      const s = saturation / 100;
      const l = lightness / 100;
      
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      
      colors.push(`rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)})`);
    }
    return colors;
  }

  function getGradientColors() {
    const theme = state.background.gradientTheme;
    
    if (theme === 'random') {
      return generateRandomGradientColors();
    } else if (theme === 'custom') {
      return state.background.customColors.map(hexToRgb);
    } else {
      // Find preset
      const preset = CONSTANTS.PRESET_GRADIENTS.find(p => p.name === theme);
      if (preset) {
        return preset.colors.map(hexToRgb);
      }
      return generateRandomGradientColors();
    }
  }

  function generateComplementaryColors(baseColor) {
    // Parse RGB values from baseColor string
    const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return [baseColor, baseColor, baseColor];
    
    let [_, r, g, b] = match.map(Number);
    
    // Convert to HSL for easier manipulation
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    // Generate colors with different hue shifts
    const colors = [];
    const shifts = [0, 0.15, 0.3, -0.15]; // Different hue rotations
    
    shifts.forEach(shift => {
      let newH = (h + shift) % 1;
      if (newH < 0) newH += 1;
      
      // Slightly vary saturation and lightness
      const newS = Math.min(1, s * (0.8 + Math.random() * 0.4));
      const newL = Math.max(0.2, Math.min(0.8, l * (0.7 + Math.random() * 0.6)));
      
      // Convert back to RGB
      let r2, g2, b2;
      if (newS === 0) {
        r2 = g2 = b2 = newL;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
        const p = 2 * newL - q;
        r2 = hue2rgb(p, q, newH + 1/3);
        g2 = hue2rgb(p, q, newH);
        b2 = hue2rgb(p, q, newH - 1/3);
      }
      
      const rgb = `rgb(${Math.round(r2*255)}, ${Math.round(g2*255)}, ${Math.round(b2*255)})`;
      colors.push(rgb);
    });
    
    return colors;
  }

  function createVinylDiscBackgroundFullscreen(container, imageUrl) {
    // Create blurred background
    const bgBlur = document.createElement('div');
    bgBlur.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${imageUrl}');
      background-size: cover;
      background-position: center;
      filter: blur(60px) brightness(0.3);
      z-index: 0;
    `;
    
    // Create vinyl disc container - larger for fullscreen, positioned to the left
    const vinylContainer = document.createElement('div');
    vinylContainer.className = 'vinyl-disc-container-fullscreen';
    vinylContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: -30%;
      transform: translateY(-50%);
      width: 1000px;
      height: 1000px;
      z-index: 1;
      opacity: 0.4;
    `;
    
    // Create vinyl disc
    const vinyl = document.createElement('div');
    vinyl.className = 'vinyl-disc';
    vinyl.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: radial-gradient(circle at center, 
        transparent 0%, 
        transparent 25%, 
        rgba(0,0,0,0.3) 25%, 
        rgba(0,0,0,0.5) 30%,
        rgba(0,0,0,0.3) 30%,
        rgba(0,0,0,0.5) 100%);
      animation: vinyl-spin 8s linear infinite;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      filter: blur(1px);
    `;
    
    // Create album cover in center
    const albumCover = document.createElement('div');
    albumCover.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60%;
      height: 60%;
      border-radius: 50%;
      background-image: url('${imageUrl}');
      background-size: cover;
      background-position: center;
      box-shadow: 0 0 0 8px rgba(0, 0, 0, 0.8),
                  inset 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    
    // Create center hole
    const centerHole = document.createElement('div');
    centerHole.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20%;
      height: 20%;
      border-radius: 50%;
      background: radial-gradient(circle, #1a1a1a 0%, #000 100%);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8),
                  inset 0 1px 4px rgba(255, 255, 255, 0.1);
    `;
    
    // Add shine effect
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, 
        rgba(255,255,255,0.1) 0%, 
        transparent 50%, 
        rgba(255,255,255,0.05) 100%);
      pointer-events: none;
    `;
    
    vinyl.appendChild(albumCover);
    vinyl.appendChild(centerHole);
    vinyl.appendChild(shine);
    vinylContainer.appendChild(vinyl);
    
    container.appendChild(bgBlur);
    container.appendChild(vinylContainer);
  }

  function createStaticGradient(container, colors) {
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Create simple static gradient using CSS
    const gradient = `
      radial-gradient(ellipse at 20% 30%, ${colors[0]} 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, ${colors[1]} 0%, transparent 50%),
      radial-gradient(ellipse at 40% 80%, ${colors[2]} 0%, transparent 50%),
      radial-gradient(ellipse at 70% 20%, ${colors[3]} 0%, transparent 50%)
    `;
    
    container.style.background = gradient;
  }

  function createVinylDiscBackground(container, imageUrl) {
    // Create blurred background
    const bgBlur = document.createElement('div');
    bgBlur.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url('${imageUrl}');
      background-size: cover;
      background-position: center;
      filter: blur(40px) brightness(0.4);
      z-index: 0;
    `;
    
    // Create vinyl disc container - positioned to the left with only half visible
    const vinylContainer = document.createElement('div');
    vinylContainer.className = 'vinyl-disc-container';
    vinylContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: -25%;
      transform: translateY(-50%);
      width: 600px;
      height: 600px;
      z-index: 1;
    `;
    
    // Create vinyl disc
    const vinyl = document.createElement('div');
    vinyl.className = 'vinyl-disc';
    vinyl.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: radial-gradient(circle at center, 
        transparent 0%, 
        transparent 25%, 
        rgba(0,0,0,0.3) 25%, 
        rgba(0,0,0,0.5) 30%,
        rgba(0,0,0,0.3) 30%,
        rgba(0,0,0,0.5) 100%);
      animation: vinyl-spin 8s linear infinite;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      filter: blur(1px);
    `;
    
    // Create album cover in center
    const albumCover = document.createElement('div');
    albumCover.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60%;
      height: 60%;
      border-radius: 50%;
      background-image: url('${imageUrl}');
      background-size: cover;
      background-position: center;
      box-shadow: 0 0 0 8px rgba(0, 0, 0, 0.8),
                  inset 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    
    // Create center hole
    const centerHole = document.createElement('div');
    centerHole.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20%;
      height: 20%;
      border-radius: 50%;
      background: radial-gradient(circle, #1a1a1a 0%, #000 100%);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8),
                  inset 0 1px 4px rgba(255, 255, 255, 0.1);
    `;
    
    // Add shine effect
    const shine = document.createElement('div');
    shine.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, 
        rgba(255,255,255,0.1) 0%, 
        transparent 50%, 
        rgba(255,255,255,0.05) 100%);
      pointer-events: none;
    `;
    
    vinyl.appendChild(albumCover);
    vinyl.appendChild(centerHole);
    vinyl.appendChild(shine);
    vinylContainer.appendChild(vinyl);
    
    container.appendChild(bgBlur);
    container.appendChild(vinylContainer);
    
    // Add vinyl spin animation
    if (!document.getElementById('vinyl-animations')) {
      const style = document.createElement('style');
      style.id = 'vinyl-animations';
      style.textContent = `
        @keyframes vinyl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .vinyl-disc {
            animation: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function createBackgroundLayer() {
    if (state.background.element) {
      state.background.element.remove();
    }
     
    const bgLayer = document.createElement('div');
    bgLayer.id = 'lyrics-background';
    bgLayer.className = 'lyrics-background';
    
    // Set inline styles to ensure it works
    bgLayer.style.position = 'absolute';
    bgLayer.style.inset = '-150px';
    bgLayer.style.borderRadius = '16px';
    bgLayer.style.opacity = '0';
    bgLayer.style.overflow = 'hidden';
    bgLayer.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    bgLayer.style.pointerEvents = 'none';
    bgLayer.style.filter = 'blur(5px)';
    
    state.background.element = bgLayer;
    console.log('Background layer created:', bgLayer);
    return bgLayer;
  }

  async function updateBackground() {
    if (!state.ui.container || !state.background.element) return;
    
    const mode = state.background.mode;
    const bgLayer = state.background.element;
    
    console.log('Updating background, mode:', mode);
    
    // Clear all previous background styles and content first
    bgLayer.innerHTML = '';
    bgLayer.style.background = 'none';
    bgLayer.style.backgroundImage = 'none';
    bgLayer.style.filter = 'none';
    bgLayer.style.opacity = '0';
    
    if (mode === 'none') {
      return;
    }
    
    if (mode === 'gradient') {
      // Use theme-based gradient colors
      const colors = getGradientColors();
      console.log('Using gradient colors:', colors);
      
      // Create static gradient (no animation for better performance)
      createStaticGradient(bgLayer, colors);
      
      bgLayer.style.opacity = '1';
      console.log('Background updated successfully');
    } else if (mode === 'album' || mode === 'video') {
      // Always fetch fresh thumbnail for current video
      const thumbnailUrl = extractVideoThumbnail();
      console.log('Thumbnail URL:', thumbnailUrl);
      
      if (thumbnailUrl) {
        // Update cache with new thumbnail
        state.background.imageUrl = thumbnailUrl;
        
        if (mode === 'album') {
          // Create vinyl disc effect for album mode
          createVinylDiscBackground(bgLayer, thumbnailUrl);
        } else {
          // Video blur mode
          bgLayer.style.backgroundImage = `url('${thumbnailUrl}')`;
          bgLayer.style.backgroundSize = 'cover';
          bgLayer.style.backgroundPosition = 'center';
          bgLayer.style.filter = 'blur(20px) brightness(0.5)';
        }
        
        // Small delay to ensure smooth transition
        setTimeout(() => {
          bgLayer.style.opacity = '1';
        }, 50);
        
        console.log('Background updated successfully with new thumbnail');
      } else {
        console.warn('No thumbnail URL found');
      }
    }
  }

  // ==================== FULLSCREEN FUNCTIONS ====================

  function createFullscreenOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'lyrics-fullscreen-overlay';
    overlay.className = 'lyrics-fullscreen-overlay';
    
    // Create background layer for fullscreen
    const bgLayer = document.createElement('div');
    bgLayer.className = 'lyrics-fullscreen-background';
    
    // Get thumbnail for album/video/vinyl modes
    const thumbnailUrl = state.background.imageUrl || extractVideoThumbnail();
    
    // Apply current background mode
    const mode = state.background.mode;
    if (mode === 'gradient') {
      const colors = getGradientColors();
      createStaticGradientFullscreen(bgLayer, colors);
    } else if (mode === 'album') {
      // Create vinyl disc effect for fullscreen
      if (thumbnailUrl) {
        createVinylDiscBackgroundFullscreen(bgLayer, thumbnailUrl);
      } else {
        bgLayer.style.background = 'rgba(0, 0, 0, 0.92)';
      }
    } else if (mode === 'video') {
      if (thumbnailUrl) {
        bgLayer.style.backgroundImage = `url('${thumbnailUrl}')`;
        bgLayer.style.backgroundSize = 'cover';
        bgLayer.style.backgroundPosition = 'center';
        bgLayer.style.filter = 'blur(40px) brightness(0.3)';
      }
    } else {
      bgLayer.style.background = 'rgba(0, 0, 0, 0.92)';
    }
    
    // Create lyrics container for fullscreen
    const lyricsContainer = document.createElement('div');
    lyricsContainer.id = 'lyrics-fullscreen-display';
    lyricsContainer.className = 'lyrics-fullscreen-display';
    
    // Create exit hint
    const exitHint = document.createElement('div');
    exitHint.className = 'lyrics-fullscreen-hint';
    exitHint.innerHTML = 'Press <kbd>ESC</kbd> or <kbd>F</kbd> to exit fullscreen';
    
    overlay.appendChild(bgLayer);
    overlay.appendChild(lyricsContainer);
    overlay.appendChild(exitHint);
    
    return { overlay, lyricsContainer };
  }

  function createStaticGradientFullscreen(container, colors) {
    // Clear existing content
    container.innerHTML = '';
    
    // Create simple static gradient for fullscreen
    const gradient = `
      radial-gradient(ellipse at 20% 30%, ${colors[0]} 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, ${colors[1]} 0%, transparent 50%),
      radial-gradient(ellipse at 40% 80%, ${colors[2]} 0%, transparent 50%),
      radial-gradient(ellipse at 70% 20%, ${colors[3]} 0%, transparent 50%)
    `;
    
    container.style.background = gradient;
  }

  function toggleFullscreenMode() {
    if (state.ui.fullscreenMode) {
      exitFullscreenMode();
    } else {
      enterFullscreenMode();
    }
  }

  function enterFullscreenMode() {
    if (!state.syncedLyrics || state.syncedLyrics.length === 0) {
      console.warn('No synced lyrics available for fullscreen mode');
      return;
    }
    
    // Create fullscreen overlay
    const { overlay, lyricsContainer } = createFullscreenOverlay();
    state.ui.fullscreenOverlay = overlay;
    
    // Store reference to fullscreen lyrics container
    const originalContainer = state.ui.lyricsContainer;
    state.ui.lyricsContainer = lyricsContainer;
    
    // Render lyrics in fullscreen
    displaySyncedLyrics(state.syncedLyrics);
    
    // Update current lyric if sync is active
    if (state.sync.currentIndex >= 0) {
      updateCurrentLyric(state.sync.currentIndex);
    }
    
    // Add to DOM
    document.body.appendChild(overlay);
    
    // Fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });
    
    // Hide YouTube video player (dim it)
    const moviePlayer = document.querySelector('#movie_player');
    if (moviePlayer) {
      moviePlayer.style.opacity = '0.1';
      moviePlayer.style.pointerEvents = 'none';
    }
    
    // Setup keyboard handler
    state.ui.keyboardHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        exitFullscreenMode();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (state.sync.currentIndex > 0) {
          seekToLyric(state.sync.currentIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (state.sync.currentIndex < state.syncedLyrics.length - 1) {
          seekToLyric(state.sync.currentIndex + 1);
        }
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (state.sync.videoElement) {
          if (state.sync.videoElement.paused) {
            state.sync.videoElement.play();
          } else {
            state.sync.videoElement.pause();
          }
        }
      }
    };
    
    document.addEventListener('keydown', state.ui.keyboardHandler);
    
    state.ui.fullscreenMode = true;
    
    // Update fullscreen button if exists
    updateFullscreenButton();
  }

  function exitFullscreenMode() {
    if (!state.ui.fullscreenMode || !state.ui.fullscreenOverlay) return;
    
    const overlay = state.ui.fullscreenOverlay;
    
    // Fade out
    overlay.style.opacity = '0';
    
    setTimeout(() => {
      // Remove from DOM
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      
      // Restore YouTube video player
      const moviePlayer = document.querySelector('#movie_player');
      if (moviePlayer) {
        moviePlayer.style.opacity = '1';
        moviePlayer.style.pointerEvents = 'auto';
      }
      
      // Restore original lyrics container
      const panelLyricsContainer = document.getElementById('lyrics-display');
      if (panelLyricsContainer) {
        state.ui.lyricsContainer = panelLyricsContainer;
        
        // Re-render lyrics in panel
        displaySyncedLyrics(state.syncedLyrics);
        
        // Update current lyric
        if (state.sync.currentIndex >= 0) {
          updateCurrentLyric(state.sync.currentIndex);
        }
      }
      
      state.ui.fullscreenOverlay = null;
    }, 300);
    
    // Remove keyboard handler
    if (state.ui.keyboardHandler) {
      document.removeEventListener('keydown', state.ui.keyboardHandler);
      state.ui.keyboardHandler = null;
    }
    
    state.ui.fullscreenMode = false;
    
    // Update fullscreen button if exists
    updateFullscreenButton();
  }

  function updateFullscreenButton() {
    const btn = document.getElementById('lyrics-fullscreen-btn');
    if (btn) {
      if (state.ui.fullscreenMode) {
        btn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;"><path d="M14 4h6v6h-2V6h-4V4zM4 14H2V8h2v6zm16-4h2v6h-2v-6zM8 20v-2H4v-2H2v6h6v-2h2z" fill="#667eea"></path></svg>';
        btn.setAttribute('title', 'Exit Fullscreen (ESC)');
        btn.style.color = '#667eea';
      } else {
        btn.innerHTML = '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;"><polygon fill="#ffffff" points="0.001,437.167 74.823,512 354.337,254.387 257.614,157.664"></polygon><path fill="#ffffff" d="M269.9,143.663l98.428,98.417c34.239,6.143,70.52-2.472,98.869-25.709L295.63,44.804 C272.393,73.153,263.757,109.412,269.9,143.663z"></path><path fill="#ffffff" d="M476.317,35.674c-45.989-45.98-119.466-47.463-167.392-4.734l172.135,172.135 C523.789,155.15,522.306,81.663,476.317,35.674z"></path></svg>';
        btn.setAttribute('title', 'Fullscreen Karaoke (F)');
        btn.style.color = 'white';
      }
    }
  }

  // Pre-compute Korean characters for performance
  const KOREAN_CHARS = new Set(
    Array.from({ length: CONSTANTS.KOREAN_RANGE.END - CONSTANTS.KOREAN_RANGE.START + 1 }, 
      (_, i) => String.fromCharCode(CONSTANTS.KOREAN_RANGE.START + i))
  );
  const NOT_ALLOWED = new Set([...CONSTANTS.FILTER_WORDS.BASIC, ...KOREAN_CHARS]);

  function formatTitle(title) {
    if (!title) return '';
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => !NOT_ALLOWED.has(word))
      .join(' ');
    
    if (formatted.includes('|') && formatted.includes('-')) {
      formatted = formatted.split('|')[0];
    }
    
    return formatted.trim();
  }

  function formatSongOnly(title) {
    if (!title) return '';
    
    let formatted = title.toLowerCase().split(' ')
      .filter(word => 
        !CONSTANTS.FILTER_WORDS.EXTENDED.map(w => w.toLowerCase()).includes(word) && 
        !/[\uAC00-\uD7AF]/.test(word)
      )
      .join(' ');
    
    formatted = formatted.split('|')[0];
    formatted = formatted.replace(/\[.*?\]/g, '');
    formatted = formatted.replace(/\(.*?\)/g, '');
    formatted = formatted.replace(/''/g, '').replace(/"/g, '');
    
    return formatted.trim();
  }

  // ==================== API FUNCTIONS ====================
  
  async function searchLyrics(query) {
    // Check cache
    if (state.cache.has(query)) {
      console.log('Lyrics found in cache');
      return state.cache.get(query);
    }
    
    const url = `${CONSTANTS.API.BASE_URL}${CONSTANTS.API.SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      state.cache.set(query, data);
      return data;
      
    } catch (error) {
      console.error('API error:', error);
      throw new Error(CONSTANTS.MESSAGES.API_ERROR);
    }
  }

  function findBestMatch(results, artistName = '') {
    if (!results || results.length === 0) return null;
    if (!artistName) return results[0];
    
    const exactMatch = results.find(r => 
      r.artistName && r.artistName.toLowerCase() === artistName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    const partialMatch = results.find(r => 
      r.artistName && r.artistName.toLowerCase().includes(artistName.toLowerCase())
    );
    
    return partialMatch || results[0];
  }

  function parseSyncedLyrics(lrcString) {
    if (!lrcString) return [];
    
    try {
      const lines = lrcString.split('\n');
      const synced = [];
      
      for (const line of lines) {
        const match = line.match(/\[(\d+):(\d+)\.?(\d+)?\]\s*(.+)/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const centiseconds = match[3] ? parseInt(match[3]) : 0;
          const text = match[4].trim();
          
          if (text) {
            synced.push({
              time: minutes * 60 + seconds + centiseconds / 100,
              text: text
            });
          }
        }
      }
      
      return synced.sort((a, b) => a.time - b.time);
    } catch (error) {
      console.error('Parse error:', error);
      return [];
    }
  }

  // ==================== SYNC FUNCTIONS ====================
  
  function findCurrentLyric(currentTime) {
    if (!state.syncedLyrics || state.syncedLyrics.length === 0) return null;
    
    const adjustedTime = currentTime + (state.sync.delay / 1000);
    const lyrics = state.syncedLyrics;
    
    // Binary search
    let left = 0;
    let right = lyrics.length - 1;
    let result = null;
    let resultIndex = -1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const lyric = lyrics[mid];
      
      if (lyric.time <= adjustedTime) {
        result = lyric;
        resultIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (result) {
      state.sync.lastKnownIndex = resultIndex;
      return { lyric: result, index: resultIndex };
    }
    
    return null;
  }

  function syncLoop() {
    if (!state.sync.isPlaying || !state.sync.videoElement) {
      state.sync.animationFrameId = null;
      return;
    }
    
    const currentTime = state.sync.videoElement.currentTime;
    const result = findCurrentLyric(currentTime);
    
    if (result && result.index !== state.sync.currentIndex) {
      state.sync.currentIndex = result.index;
      updateCurrentLyric(result.index);
    }
    
    state.sync.animationFrameId = requestAnimationFrame(syncLoop);
  }

  function startSync() {
    if (!state.sync.videoElement || !state.syncedLyrics.length) {
      console.error('Cannot start sync');
      return;
    }
    
    state.sync.isPlaying = true;
    syncLoop();
  }

  function stopSync() {
    state.sync.isPlaying = false;
    if (state.sync.animationFrameId) {
      cancelAnimationFrame(state.sync.animationFrameId);
      state.sync.animationFrameId = null;
    }
  }

  function seekToLyric(index) {
    if (index >= 0 && index < state.syncedLyrics.length && state.sync.videoElement) {
      state.sync.videoElement.currentTime = state.syncedLyrics[index].time - (state.sync.delay / 1000);
      state.sync.currentIndex = index;
    }
  }

  // ==================== UI FUNCTIONS ====================
  
  function createCollapsibleSection(sectionConfig) {
    const section = document.createElement('div');
    section.className = 'control-section';
    section.dataset.sectionId = sectionConfig.id;
    
    const header = document.createElement('div');
    header.className = 'control-section-header';
    
    const title = document.createElement('span');
    title.className = 'control-section-title';
    title.textContent = sectionConfig.title;
    
    const toggle = document.createElement('span');
    toggle.className = 'control-section-toggle';
    toggle.textContent = '▼';
    
    header.appendChild(title);
    header.appendChild(toggle);
    
    const content = document.createElement('div');
    content.className = 'control-section-content';
    
    // Check if section should be collapsed
    const isCollapsed = state.ui.collapsedSections[sectionConfig.id] ?? !sectionConfig.defaultOpen;
    
    if (isCollapsed) {
      section.classList.add('collapsed');
      content.style.maxHeight = '0';
      toggle.textContent = '▶';
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
    }
    
    header.addEventListener('click', () => {
      const wasCollapsed = section.classList.contains('collapsed');
      
      if (wasCollapsed) {
        section.classList.remove('collapsed');
        toggle.textContent = '▼';
        content.style.maxHeight = content.scrollHeight + 'px';
        state.ui.collapsedSections[sectionConfig.id] = false;
      } else {
        section.classList.add('collapsed');
        toggle.textContent = '▶';
        content.style.maxHeight = '0';
        state.ui.collapsedSections[sectionConfig.id] = true;
      }
      
      saveControlSettings();
    });
    
    section.appendChild(header);
    section.appendChild(content);
    
    return { section, content };
  }
  
  function saveControlSettings() {
    try {
      chrome.storage.sync.set({ 
        collapsedSections: state.ui.collapsedSections,
        controlsVisible: state.ui.controlsVisible
      });
    } catch (error) {
      console.warn('Failed to save control settings:', error);
    }
  }
  
  async function loadControlSettings() {
    try {
      const data = await chrome.storage.sync.get(['collapsedSections', 'controlsVisible']);
      state.ui.collapsedSections = data.collapsedSections || {};
      state.ui.controlsVisible = data.controlsVisible !== undefined ? data.controlsVisible : false;
    } catch (error) {
      console.warn('Failed to load control settings:', error);
      state.ui.collapsedSections = {};
      state.ui.controlsVisible = false;
    }
  }
  
  function toggleControlsVisibility() {
    state.ui.controlsVisible = !state.ui.controlsVisible;
    const controlsContainer = state.ui.controlsContainer;
    const videoBtn = document.getElementById('lyrics-video-settings-btn');
    
    if (controlsContainer) {
      if (state.ui.controlsVisible) {
        controlsContainer.classList.remove('hidden');
        if (videoBtn) {
          videoBtn.classList.add('active');
          videoBtn.setAttribute('aria-pressed', 'true');
        }
      } else {
        controlsContainer.classList.add('hidden');
        if (videoBtn) {
          videoBtn.classList.remove('active');
          videoBtn.setAttribute('aria-pressed', 'false');
        }
      }
    }
    
    saveControlSettings();
  }

  function createVideoPlayerButton() {
    // Remove existing buttons if present
    const existingContainer = document.getElementById('lyrics-video-settings-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Find YouTube's video controls container
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) {
      console.warn('YouTube video controls not found');
      return;
    }

    // Create container for buttons
    const container = document.createElement('div');
    container.id = 'lyrics-video-settings-container';
    container.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-right: 8px;';

    // Create label with SVG icon
    const label = document.createElement('span');
    label.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;"><path d="M9.772 4.28c.56-.144 1.097.246 1.206.814.1.517-.263 1.004-.771 1.14A7 7 0 1 0 19 12.9c.009-.5.4-.945.895-1 .603-.067 1.112.371 1.106.977L21 13c0 .107-.002.213-.006.32a.898.898 0 0 1 0 .164l-.008.122a9 9 0 0 1-9.172 8.392A9 9 0 0 1 9.772 4.28z" fill="#ffffff"></path><path d="M15.93 13.753a4.001 4.001 0 1 1-6.758-3.581A4 4 0 0 1 12 9c.75 0 1.3.16 2 .53 0 0 .15.09.25.17-.1-.35-.228-1.296-.25-1.7a58.75 58.75 0 0 1-.025-2.035V2.96c0-.52.432-.94.965-.94.103 0 .206.016.305.048l4.572 1.689c.446.145.597.23.745.353.148.122.258.27.33.446.073.176.108.342.108.801v1.16c0 .518-.443.94-.975.94a.987.987 0 0 1-.305-.049l-1.379-.447-.151-.05c-.437-.14-.618-.2-.788-.26a5.697 5.697 0 0 1-.514-.207 3.53 3.53 0 0 1-.213-.107c-.098-.05-.237-.124-.521-.263L16 6l.011 7c0 .255-.028.507-.082.753h.001z" fill="#ffffff"></path></svg>';
    label.style.cssText = 'display: flex; align-items: center; opacity: 0.9; user-select: none; pointer-events: none;';
    
    // Create fullscreen karaoke button with SVG icon
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'lyrics-fullscreen-btn';
    fullscreenBtn.className = 'ytp-button';
    fullscreenBtn.setAttribute('aria-label', 'Fullscreen Karaoke');
    fullscreenBtn.setAttribute('title', 'Fullscreen Karaoke (F)');
    fullscreenBtn.setAttribute('data-control-id', 'fullscreen-btn');
    fullscreenBtn.style.cssText = 'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; border: none; color: white; opacity: 0.9;';
    fullscreenBtn.innerHTML = '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;"><polygon fill="#ffffff" points="0.001,437.167 74.823,512 354.337,254.387 257.614,157.664"></polygon><path fill="#ffffff" d="M269.9,143.663l98.428,98.417c34.239,6.143,70.52-2.472,98.869-25.709L295.63,44.804 C272.393,73.153,263.757,109.412,269.9,143.663z"></path><path fill="#ffffff" d="M476.317,35.674c-45.989-45.98-119.466-47.463-167.392-4.734l172.135,172.135 C523.789,155.15,522.306,81.663,476.317,35.674z"></path></svg>';
    
    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFullscreenMode();
    });
    
    fullscreenBtn.addEventListener('mouseenter', () => {
      fullscreenBtn.style.opacity = '1';
    });
    
    fullscreenBtn.addEventListener('mouseleave', () => {
      fullscreenBtn.style.opacity = '0.9';
    });
    
    // Create toggle switch button (styled in CSS)
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'lyrics-video-settings-btn';
    settingsBtn.setAttribute('aria-label', 'Lyrics Settings');
    settingsBtn.setAttribute('title', 'Lyrics Settings: ' + (state.ui.controlsVisible ? 'ON' : 'OFF'));
    settingsBtn.setAttribute('aria-pressed', state.ui.controlsVisible ? 'true' : 'false');
    settingsBtn.setAttribute('role', 'switch');
    
    if (state.ui.controlsVisible) {
      settingsBtn.classList.add('active');
    }
    
    // Add click handler
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleControlsVisibility();
      // Update tooltip
      settingsBtn.setAttribute('title', 'Lyrics Settings: ' + (state.ui.controlsVisible ? 'ON' : 'OFF'));
    });
    
    // Assemble container - settings toggle first, then fullscreen
    container.appendChild(label);
    container.appendChild(settingsBtn);
    container.appendChild(fullscreenBtn);
    
    // Insert at the beginning of right controls (before settings gear)
    rightControls.insertBefore(container, rightControls.firstChild);
    
    console.log('Lyrics controls added to video controls');
  }
  
  function createPanel(parentElement) {
    removePanel();
    
    const styles = CONSTANTS.UI.APPLE_MUSIC;
    const spacing = CONSTANTS.UI.SPACING;
    
    // Container - all styles in external CSS
    state.ui.container = document.createElement('div');
    state.ui.container.id = CONSTANTS.UI.PANEL_CONTAINER_ID;
    state.ui.container.style.position = 'relative';
    
    // Create background layer first
    const bgLayer = createBackgroundLayer();
    state.ui.container.appendChild(bgLayer);
    
    // Panel
    state.ui.panel = document.createElement('div');
    state.ui.panel.id = CONSTANTS.UI.PANEL_ID;
    state.ui.panel.style.position = 'relative';
    state.ui.panel.style.zIndex = '1';
    
    // Header
    const header = createHeader();
    state.ui.panel.appendChild(header);
    
    // Lyrics container
    state.ui.lyricsContainer = document.createElement('div');
    state.ui.lyricsContainer.id = 'lyrics-display';
    state.ui.panel.appendChild(state.ui.lyricsContainer);
    
    // Controls
    state.ui.controlsContainer = document.createElement('div');
    state.ui.controlsContainer.id = 'lyrics-controls';
    state.ui.controlsContainer.style.position = 'relative';
    state.ui.controlsContainer.style.zIndex = '2';
    
    // Apply initial visibility state
    if (!state.ui.controlsVisible) {
      state.ui.controlsContainer.classList.add('hidden');
    }
    
    state.ui.panel.appendChild(state.ui.controlsContainer);
    
    state.ui.container.appendChild(state.ui.panel);
    parentElement.insertBefore(state.ui.container, parentElement.firstChild);
    
    // Add settings button to video player controls
    createVideoPlayerButton();
  }

  function createHeader() {
    const header = document.createElement('div');
    header.className = 'lyrics-header';
    
    const titleContainer = document.createElement('div');
    titleContainer.id = 'lyrics-title';
    
    const title = document.createElement('h3');
    title.id = 'song-title';
    title.textContent = 'Lyrics';
    
    const artist = document.createElement('p');
    artist.id = 'song-artist';
    artist.textContent = '';
    artist.style.display = 'none';
    
    titleContainer.appendChild(title);
    titleContainer.appendChild(artist);
    
    header.appendChild(titleContainer);
    
    return header;
  }

  function updateTitle(title, artist = '') {
    const titleEl = document.getElementById('song-title');
    const artistEl = document.getElementById('song-artist');
    
    if (titleEl) titleEl.textContent = title || 'Lyrics';
    if (artistEl) {
      artistEl.textContent = artist;
      artistEl.style.display = artist ? 'block' : 'none';
    }
  }

  function showLoading() {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'lyrics-loading';
    loading.textContent = CONSTANTS.MESSAGES.LOADING;
    state.ui.lyricsContainer.appendChild(loading);
  }

  function showError(message) {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'lyrics-error';
    error.textContent = message;
    state.ui.lyricsContainer.appendChild(error);
  }

  function displayPlainLyrics(lyrics) {
    if (!state.ui.lyricsContainer) return;
    
    stopSync();
    state.ui.lyricsContainer.innerHTML = '';
    
    const text = document.createElement('div');
    text.className = 'lyrics-plain';
    text.textContent = lyrics;
    state.ui.lyricsContainer.appendChild(text);
  }

  function displaySyncedLyrics(syncedLyrics) {
    if (!state.ui.lyricsContainer) return;
    
    state.ui.lyricsContainer.innerHTML = '';
    
    syncedLyrics.forEach((lyric, index) => {
      const line = document.createElement('div');
      line.className = 'lyric-line';
      line.dataset.index = index;
      line.textContent = lyric.text;
      line.style.display = 'none'; // Initially hide all lines
      
      line.addEventListener('click', () => seekToLyric(index));
      
      state.ui.lyricsContainer.appendChild(line);
    });
  }

  function updateCurrentLyric(currentIndex) {
    if (!state.ui.lyricsContainer) return;
    
    const lines = state.ui.lyricsContainer.querySelectorAll('.lyric-line');
    const isFullscreen = state.ui.fullscreenMode;
    
    // Show more lines in fullscreen mode
    const contextLines = isFullscreen ? 3 : 1;
    
    lines.forEach((line, index) => {
      const isCurrent = index === currentIndex;
      const distance = Math.abs(index - currentIndex);
      const isPast = index < currentIndex && distance <= contextLines;
      const isFuture = index > currentIndex && distance <= contextLines;
      
      // Remove all state classes first
      line.classList.remove('current', 'past', 'future');
      
      // Show current and nearby lines based on context
      if (isCurrent || isPast || isFuture) {
        line.style.display = 'block';
        
        if (isCurrent) {
          line.classList.add('current');
        } else if (isPast) {
          line.classList.add('past');
        } else if (isFuture) {
          line.classList.add('future');
        }
      } else {
        // Hide all other lines
        line.style.display = 'none';
      }
    });
  }

  function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'lyrics-button';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createSelect(id, options, onChange) {
    const select = document.createElement('select');
    select.className = 'lyrics-select';
    select.id = id;
    select.addEventListener('change', onChange);
    
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });
    
    return select;
  }

  function addControl(element) {
    if (state.ui.controlsContainer) {
      state.ui.controlsContainer.appendChild(element);
    }
  }

  function removePanel() {
    if (state.ui.container) {
      state.ui.container.remove();
      state.ui.container = null;
      state.ui.panel = null;
      state.ui.lyricsContainer = null;
      state.ui.controlsContainer = null;
    }
  }

  // ==================== CONTROL CREATORS ====================
  
  function createSongSelector(results, currentSelection) {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-group';
    wrapper.dataset.controlId = 'song-selector-group';
    
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Song Selection';
    
    const options = results.map((r, i) => ({
      value: i,
      label: `${r.trackName} - ${r.artistName}`
    }));
    
    const currentIndex = results.indexOf(currentSelection);
    const select = createSelect('song-selector', options, (e) => {
      const data = results[e.target.value];
      state.currentData = data;
      updateTitle(data.trackName, data.artistName);
      displayLyrics(data);
    });
    
    select.value = currentIndex;
    
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    addControl(wrapper);
  }

  function createModeToggle(hasSynced) {
    const existing = document.querySelector('[data-control-id="mode-toggle-group"]');
    if (existing) existing.remove();
    if (!hasSynced) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'control-group';
    wrapper.dataset.controlId = 'mode-toggle-group';
    
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Playback Mode';
    
    const options = [
      { value: 'synced', label: '🎵 Synced Lyrics' },
      { value: 'plain', label: '📄 Plain Text' }
    ];
    
    const select = createSelect('lyrics-mode-toggle', options, (e) => {
      if (e.target.value === 'synced') {
        const synced = parseSyncedLyrics(state.currentData.syncedLyrics);
        initSyncedLyrics(synced);
      } else {
        stopSync();
        displayPlainLyrics(state.currentData.plainLyrics);
      }
    });
    
    select.value = 'synced';
    
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    addControl(wrapper);
  }

  function createDelayControl() {
    const existing = document.querySelector('[data-control-id="delay-control-group"]');
    if (existing) existing.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = 'control-group';
    wrapper.dataset.controlId = 'delay-control-group';
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'control-label-row';
    labelDiv.innerHTML = '<span class="control-label">Sync Offset</span>';
    
    const display = document.createElement('span');
    display.className = 'delay-display';
    display.textContent = `${state.sync.delay}ms`;
    labelDiv.appendChild(display);
    
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'slider-wrapper';
    
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'delay-slider';
    slider.className = 'delay-slider';
    slider.min = '-1000';
    slider.max = '1000';
    slider.step = '50';
    slider.value = state.sync.delay;
    
    const resetBtn = createButton('Reset', () => {
      state.sync.delay = 0;
      slider.value = 0;
      display.textContent = '0ms';
    });
    resetBtn.className = 'lyrics-button lyrics-button-small';
    
    slider.addEventListener('input', (e) => {
      state.sync.delay = parseInt(e.target.value);
      display.textContent = `${state.sync.delay}ms`;
    });
    
    sliderWrapper.appendChild(slider);
    
    wrapper.appendChild(labelDiv);
    wrapper.appendChild(sliderWrapper);
    wrapper.appendChild(resetBtn);
    
    addControl(wrapper);
  }

  function createBackgroundControl() {
    const existing = document.querySelector('[data-control-id="background-control-group"]');
    if (existing) existing.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = 'control-group';
    wrapper.dataset.controlId = 'background-control-group';
    
    const modeLabel = document.createElement('div');
    modeLabel.className = 'control-label';
    modeLabel.textContent = 'Background Style';
    
    const modeGrid = document.createElement('div');
    modeGrid.className = 'background-mode-grid';
    
    const modes = [
      { value: 'none', icon: '⬛', label: 'None' },
      { value: 'gradient', icon: '🎨', label: 'Gradient' },
      { value: 'album', icon: '🖼️', label: 'Album' },
      { value: 'video', icon: '🎬', label: 'Video' }
    ];
    
    modes.forEach(mode => {
      const btn = document.createElement('button');
      btn.className = 'background-mode-btn';
      btn.dataset.mode = mode.value;
      if (state.background.mode === mode.value) {
        btn.classList.add('active');
      }
      
      const icon = document.createElement('span');
      icon.className = 'mode-icon';
      icon.textContent = mode.icon;
      
      const label = document.createElement('span');
      label.className = 'mode-label';
      label.textContent = mode.label;
      
      btn.appendChild(icon);
      btn.appendChild(label);
      
      btn.addEventListener('click', async () => {
        modeGrid.querySelectorAll('.background-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        state.background.mode = mode.value;
        saveBackgroundSettings();
        
        const themeContainer = wrapper.querySelector('.gradient-theme-container');
        if (mode.value === 'gradient' && themeContainer) {
          themeContainer.style.display = 'block';
          setTimeout(() => themeContainer.classList.add('visible'), 10);
        } else if (themeContainer) {
          themeContainer.classList.remove('visible');
          setTimeout(() => themeContainer.style.display = 'none', 300);
        }
        
        await updateBackground();
      });
      
      modeGrid.appendChild(btn);
    });
    
    wrapper.appendChild(modeLabel);
    wrapper.appendChild(modeGrid);
    
    createGradientThemeControl(wrapper);
    
    addControl(wrapper);
  }

  function createGradientThemeControl(parentWrapper) {
    const container = document.createElement('div');
    container.className = 'gradient-theme-container';
    container.style.display = state.background.mode === 'gradient' ? 'block' : 'none';
    
    if (state.background.mode === 'gradient') {
      setTimeout(() => container.classList.add('visible'), 10);
    }
    
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = 'Gradient Theme';
    
    const controlRow = document.createElement('div');
    controlRow.className = 'gradient-theme-row';
    
    const options = [
      { value: 'random', label: '🎲 Random' },
      ...CONSTANTS.PRESET_GRADIENTS.map(preset => ({ 
        value: preset.name, 
        label: preset.name 
      }))
    ];
    
    const select = createSelect('gradient-theme-select', options, async (e) => {
      state.background.gradientTheme = e.target.value;
      saveBackgroundSettings();
      await updateBackground();
    });
    
    select.value = state.background.gradientTheme;
    
    const refreshBtn = createButton('🔄', async () => {
      if (state.background.gradientTheme === 'random') {
        await updateBackground();
      }
    });
    refreshBtn.className = 'lyrics-button lyrics-button-icon';
    refreshBtn.title = 'Generate new random gradient';
    
    controlRow.appendChild(select);
    controlRow.appendChild(refreshBtn);
    
    container.appendChild(label);
    container.appendChild(controlRow);
    
    parentWrapper.appendChild(container);
  }

  // ==================== MAIN LOGIC ====================
  
  function extractVideoInfo() {
    const titleEl = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
    const artistEl = document.querySelector(CONSTANTS.SELECTORS.ARTIST_NAME);
    
    if (!titleEl) return null;
    
    const title = titleEl.textContent.trim();
    const artist = artistEl ? artistEl.textContent.trim() : '';
    
    return {
      rawTitle: title,
      artist: artist,
      formattedTitle: formatTitle(title + (artist ? ' ' + artist : ''))
    };
  }

  async function fetchAndDisplayLyrics(videoInfo) {
    if (!videoInfo) return;
    
    try {
      showLoading();
      
      // Load background and control settings first
      await loadBackgroundSettings();
      await loadControlSettings();
      
      let results = await searchLyrics(videoInfo.formattedTitle);
      
      if (!results || results.length === 0) {
        const songOnly = formatSongOnly(videoInfo.rawTitle);
        results = await searchLyrics(songOnly);
      }
      
      if (!results || results.length === 0) {
        showError(CONSTANTS.MESSAGES.NO_LYRICS);
        return;
      }
      
      const bestMatch = findBestMatch(results, videoInfo.artist);
      state.currentData = bestMatch;
      
      updateTitle(bestMatch.trackName, bestMatch.artistName);
      
      if (results.length > 1) {
        createSongSelector(results, bestMatch);
      }
      
      displayLyrics(bestMatch);
      
    } catch (error) {
      console.error('Error:', error);
      showError(error.message || CONSTANTS.MESSAGES.API_ERROR);
    }
  }

  function displayLyrics(data) {
    const synced = parseSyncedLyrics(data.syncedLyrics);
    const plain = data.plainLyrics || CONSTANTS.MESSAGES.NO_LYRICS;
    
    createModeToggle(synced.length > 0);
    createBackgroundControl();
    
    // Update background after controls are created to ensure proper state
    setTimeout(() => {
      updateBackground();
    }, 100);
    
    if (synced.length > 0) {
      initSyncedLyrics(synced);
    } else {
      displayPlainLyrics(plain);
    }
  }

  function initSyncedLyrics(syncedLyrics) {
    state.syncedLyrics = syncedLyrics;
    displaySyncedLyrics(syncedLyrics);
    
    const video = document.querySelector(CONSTANTS.SELECTORS.VIDEO_PLAYER);
    if (!video) {
      console.error('Video element not found');
      return;
    }
    
    state.sync.videoElement = video;
    state.sync.currentIndex = -1;
    state.sync.lastKnownIndex = 0;
    
    // Store handlers for cleanup
    state.sync.handlePlay = () => {
      state.sync.isPlaying = true;
      syncLoop();
    };
    state.sync.handlePause = () => stopSync();
    
    video.addEventListener('play', state.sync.handlePlay);
    video.addEventListener('pause', state.sync.handlePause);
    
    startSync();
    createDelayControl();
  }

  function initializeLyricsPanel() {
    const secondaryInner = document.querySelector(CONSTANTS.SELECTORS.SECONDARY_INNER);
    const titleElement = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
    
    if (!secondaryInner || !titleElement || state.hasRun || !state.isEnabled) {
      return false;
    }
    
    const videoInfo = extractVideoInfo();
    if (!videoInfo) return false;
    
    state.currentTitle = videoInfo.rawTitle;
    createPanel(secondaryInner);
    fetchAndDisplayLyrics(videoInfo);
    
    state.hasRun = true;
    return true;
  }

  function watchForVideoChanges() {
    let lastTitle = '';
    
    const handleTitleChange = debounce(() => {
      const titleEl = document.querySelector(CONSTANTS.SELECTORS.VIDEO_TITLE);
      if (titleEl && titleEl.textContent !== lastTitle) {
        lastTitle = titleEl.textContent;
        resetState();
        setTimeout(() => initializeLyricsPanel(), 500);
      }
    }, 250);
    
    state.titleObserver = new MutationObserver(handleTitleChange);
    
    const titleContainer = document.querySelector('#title');
    if (titleContainer) {
      state.titleObserver.observe(titleContainer, { childList: true, subtree: true });
    }
  }

  function resetState() {
    // Exit fullscreen mode if active
    if (state.ui.fullscreenMode) {
      exitFullscreenMode();
    }
    
    // Clean up video event listeners
    if (state.sync.videoElement) {
      if (state.sync.handlePlay) {
        state.sync.videoElement.removeEventListener('play', state.sync.handlePlay);
      }
      if (state.sync.handlePause) {
        state.sync.videoElement.removeEventListener('pause', state.sync.handlePause);
      }
      state.sync.videoElement = null;
    }
    
    // Stop sync and cancel animation frame
    stopSync();
    
    // Clear background cache to force reload on new video
    state.background.imageUrl = null;
    state.background.dominantColor = null;
    state.background.element = null;
    
    // Clear state
    state.hasRun = false;
    state.currentTitle = '';
    state.currentData = null;
    state.syncedLyrics = [];
    state.sync.handlePlay = null;
    state.sync.handlePause = null;
    
    // Remove video player button container
    const videoContainer = document.getElementById('lyrics-video-settings-container');
    if (videoContainer) {
      videoContainer.remove();
    }
    
    // Remove UI
    removePanel();
  }

  // ==================== INITIALIZATION ====================
  
  async function initialize() {
    if (!/^https:\/\/www\.youtube\.com\/watch\?v=/.test(window.location.href)) {
      return;
    }
    
    // Load settings
    chrome.storage.sync.get(['isEnabled'], (data) => {
      state.isEnabled = data.isEnabled === true;
      
      if (!state.isEnabled) {
        console.log('Extension is disabled');
        return;
      }
      
      // Wait for page ready
      const observer = new MutationObserver((mutations, obs) => {
        if (initializeLyricsPanel()) {
          obs.disconnect();
          watchForVideoChanges();
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.isEnabled) {
      // Reload the page when extension is toggled
      location.reload();
    }
  });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
