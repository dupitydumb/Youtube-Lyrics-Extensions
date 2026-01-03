import { CONSTANTS } from './constants.js';

/**
 * Background Manager Module - Handles all background effects (vinyl, gradients, album art)
 */

export class BackgroundManager {
  constructor() {
    this.element = null;
    this.mode = 'album'; // 'none', 'gradient', 'album', 'video'
    this.gradientTheme = 'random';
    this.customColors = [];
  }

  /**
   * Create the background layer element
   */
  createBackgroundLayer() {
    if (this.element) {
      this.element.remove();
    }
     
    const bgLayer = document.createElement('div');
    bgLayer.id = 'lyrics-background';
    bgLayer.className = 'lyrics-background';
    
    // Set inline styles
    bgLayer.style.position = 'absolute';
    bgLayer.style.inset = '-150px';
    bgLayer.style.borderRadius = '16px';
    bgLayer.style.opacity = '0';
    bgLayer.style.overflow = 'hidden';
    bgLayer.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    bgLayer.style.pointerEvents = 'none';
    bgLayer.style.filter = 'blur(85px)';
    
    this.element = bgLayer;
    return bgLayer;
  }

  /**
   * Update background based on current mode
   */
  async updateBackground(imageUrl = null) {
    if (!this.element) return;
    
    const bgLayer = this.element;
    
    // Clear previous styles using replaceChildren for Trusted Types compatibility
    bgLayer.replaceChildren();
    bgLayer.style.background = 'none';
    bgLayer.style.backgroundImage = 'none';
    bgLayer.style.filter = 'none';
    bgLayer.style.opacity = '0';
    
    if (this.mode === 'none') {
      return;
    }
    
    if (this.mode === 'gradient') {
      const colors = this.getGradientColors();
      this.createStaticGradient(bgLayer, colors);
      setTimeout(() => { bgLayer.style.opacity = '0.6'; }, 50);
    } else if (this.mode === 'album' && imageUrl) {
      this.createVinylDiscBackground(bgLayer, imageUrl, false);
      setTimeout(() => { bgLayer.style.opacity = '1'; }, 50);
    } else if (this.mode === 'video' && imageUrl) {
      bgLayer.style.backgroundImage = `url('${imageUrl}')`;
      bgLayer.style.backgroundSize = 'cover';
      bgLayer.style.backgroundPosition = 'center';
      bgLayer.style.filter = 'blur(60px) brightness(0.3)';
      setTimeout(() => { bgLayer.style.opacity = '1'; }, 50);
    }
  }

  /**
   * Update background for fullscreen mode
   */
  updateFullscreenBackground(container, imageUrl = null) {
    if (!container) return;
    
    // Clear using replaceChildren for Trusted Types compatibility
    container.replaceChildren();
    
    if (this.mode === 'none') {
      container.style.background = 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)';
      return;
    }
    
    if (this.mode === 'gradient') {
      const colors = this.getGradientColors();
      this.createStaticGradient(container, colors);
    } else if ((this.mode === 'album' || this.mode === 'video') && imageUrl) {
      this.createVinylDiscBackground(container, imageUrl, true);
    }
  }

  /**
   * Generate random gradient colors
   */
  generateRandomGradientColors() {
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

  /**
   * Get gradient colors based on theme
   */
  getGradientColors() {
    if (this.gradientTheme === 'random') {
      return this.generateRandomGradientColors();
    } else if (this.gradientTheme === 'custom') {
      return this.customColors.map(this.hexToRgb);
    } else {
      const preset = CONSTANTS.PRESET_GRADIENTS.find(p => p.name === this.gradientTheme);
      if (preset) {
        return preset.colors.map(this.hexToRgb);
      }
      return this.generateRandomGradientColors();
    }
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`
      : hex;
  }

  /**
   * Create static gradient background
   */
  createStaticGradient(container, colors) {
    if (!container) return;
    
    // Clear using replaceChildren for Trusted Types compatibility
    container.replaceChildren();
    
    const gradient = `
      radial-gradient(ellipse at 20% 30%, ${colors[0]} 0%, transparent 50%),
      radial-gradient(ellipse at 80% 70%, ${colors[1]} 0%, transparent 50%),
      radial-gradient(ellipse at 40% 80%, ${colors[2]} 0%, transparent 50%),
      radial-gradient(ellipse at 70% 20%, ${colors[3]} 0%, transparent 50%)
    `;
    
    container.style.background = gradient;
  }

  /**
   * Create vinyl disc background (unified for both panel and fullscreen)
   */
  createVinylDiscBackground(container, imageUrl, fullscreen = false) {
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
      filter: blur(${fullscreen ? '60px' : '40px'}) brightness(${fullscreen ? '0.3' : '0.4'});
      z-index: 0;
    `;
    
    // Create vinyl disc container
    const vinylContainer = document.createElement('div');
    vinylContainer.className = fullscreen ? 'vinyl-disc-container-fullscreen' : 'vinyl-disc-container';
    vinylContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: ${fullscreen ? '-30%' : '-25%'};
      transform: translateY(-50%);
      width: ${fullscreen ? '1000px' : '600px'};
      height: ${fullscreen ? '1000px' : '600px'};
      z-index: 0;
      ${fullscreen ? 'opacity: 0.4;' : ''}
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
    this.addVinylAnimationStyles();
  }

  /**
   * Add vinyl animation styles to document
   */
  addVinylAnimationStyles() {
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

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }
      const data = await chrome.storage.sync.get(['backgroundMode', 'gradientTheme', 'customColors']);
      this.mode = data.backgroundMode || 'album';
      this.gradientTheme = data.gradientTheme || 'random';
      this.customColors = data.customColors || [];
    } catch (error) {
      // Failed to load background settings
    }
  }

  /**
   * Destroy background elements and styles to avoid memory leaks
   */
  destroy() {
    try {
      // Remove DOM element if present
      if (this.element) {
        try { this.element.remove(); } catch (e) { /* ignore */ }
        this.element = null;
      }

      // Remove injected animation styles if present
      const style = document.getElementById('vinyl-animations');
      if (style && style.parentNode) {
        try { style.parentNode.removeChild(style); } catch (e) { /* ignore */ }
      }

      // Clear any internal state
      this.mode = 'album';
      this.gradientTheme = 'random';
      this.customColors = [];
    } catch (e) {
      // swallow errors during cleanup
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
      }
      await chrome.storage.sync.set({
        backgroundMode: this.mode,
        gradientTheme: this.gradientTheme,
        customColors: this.customColors
      });
    } catch (error) {
      // Failed to save background settings
    }
  }
}
