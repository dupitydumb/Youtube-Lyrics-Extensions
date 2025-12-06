import { SELECTORS, UI_CONFIG, FILTER_WORDS, KOREAN_CHAR_RANGE } from './constants.js';

/**
 * UI Module - Handles all UI creation and manipulation with Apple Music styling
 */

export class LyricsUI {
  constructor() {
    this.panel = null;
    this.container = null;
    this.lyricsContainer = null;
    this.controlsContainer = null;
    this.currentStyle = 'apple-music';
    this.settingsRef = null; // Store settings reference for updates
    this.currentFontSize = 16; // Store current font size
    this.highlightMode = 'line'; // 'line' or 'word'
  }

  /**
   * Create the main lyrics panel with Apple Music styling
   */
  createPanel(parentElement) {
    if (this.panel) {
      this.removePanel();
    }

    // Create outer container
    this.container = document.createElement('div');
    this.container.id = UI_CONFIG.PANEL_CONTAINER_ID;
    this.applyContainerStyles(this.container);

    // Create panel
    this.panel = document.createElement('div');
    this.panel.id = UI_CONFIG.PANEL_ID;
    this.applyPanelStyles(this.panel);

    // Create header
    const header = this.createHeader();
    this.panel.appendChild(header);

    // Create lyrics container
    this.lyricsContainer = document.createElement('div');
    this.lyricsContainer.id = 'lyrics-display';
    this.applyLyricsContainerStyles(this.lyricsContainer);
    this.panel.appendChild(this.lyricsContainer);

    this.container.appendChild(this.panel);
    
    // Insert at the beginning of parent
    parentElement.insertBefore(this.container, parentElement.firstChild);

    return this.panel;
  }

  /**
   * Apply Apple Music-inspired container styles
   */
  applyContainerStyles(element) {
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;
    Object.assign(element.style, {
      position: 'sticky',
      top: '0',
      zIndex: '100',
      marginBottom: '16px',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    });
  }

  /**
   * Apply Apple Music-inspired panel styles
   */
  applyPanelStyles(element) {
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;
    Object.assign(element.style, {
      background: styles.BACKGROUND_COLOR,
      backdropFilter: `blur(${styles.BACKDROP_BLUR})`,
      WebkitBackdropFilter: `blur(${styles.BACKDROP_BLUR})`,
      padding: '24px',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    });
  }

  /**
   * Apply lyrics container styles
   */
  applyLyricsContainerStyles(element) {
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;
    Object.assign(element.style, {
      flex: '1',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '20px 0',
      textAlign: 'center',
      scrollBehavior: 'smooth',
      maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)'
    });

    // Custom scrollbar and word highlighting styles
    const style = document.createElement('style');
    style.textContent = `
      #lyrics-display::-webkit-scrollbar {
        width: 6px;
      }
      #lyrics-display::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
      }
      #lyrics-display::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
      }
      #lyrics-display::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
      
      /* Word-by-word highlighting */
      .lyric-word {
        display: inline-block;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        margin: 0 2px;
      }
      
      .lyric-word.highlighted {
        color: #ffffff !important;
        text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        transform: scale(1.05);
        font-weight: 700;
      }
      
      .lyric-word.past {
        color: rgba(255, 255, 255, 0.5) !important;
      }
      
      .lyric-word.future {
        color: rgba(255, 255, 255, 0.3) !important;
      }
      
      /* Gradient text effect for current line */
      .lyric-line.current-gradient {
        background: linear-gradient(90deg, 
          rgba(255, 255, 255, 0.5) 0%,
          rgba(255, 255, 255, 1) 50%,
          rgba(255, 255, 255, 0.5) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create header with title and close button
   */
  createHeader() {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '16px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    });

    const titleContainer = document.createElement('div');
    titleContainer.id = 'lyrics-title';
    Object.assign(titleContainer.style, {
      flex: '1'
    });

    const title = document.createElement('h3');
    title.id = 'song-title';
    title.textContent = 'Lyrics';
    Object.assign(title.style, {
      margin: '0',
      fontSize: '18px',
      fontWeight: '600',
      color: '#ffffff',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    const artist = document.createElement('p');
    artist.id = 'song-artist';
    artist.textContent = '';
    Object.assign(artist.style, {
      margin: '4px 0 0 0',
      fontSize: '14px',
      color: 'rgba(255, 255, 255, 0.6)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    });

    titleContainer.appendChild(title);
    titleContainer.appendChild(artist);
    header.appendChild(titleContainer);

    return header;
  }

  /**
   * Create controls (delay adjustment, mode toggle, song selection)
   */
  createControls() {
    const controls = document.createElement('div');
    controls.id = 'lyrics-controls';
    Object.assign(controls.style, {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
      paddingTop: '16px',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      fontSize: '14px'
    });

    return controls;
  }

  /**
   * Display plain lyrics with Apple Music styling
   */
  displayPlainLyrics(lyrics) {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    
    const lyricsText = document.createElement('div');
    Object.assign(lyricsText.style, {
      whiteSpace: 'pre-wrap',
      lineHeight: '2',
      fontSize: '16px',
      color: 'rgba(255, 255, 255, 0.9)',
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto'
    });
    
    lyricsText.textContent = lyrics;
    this.lyricsContainer.appendChild(lyricsText);
  }

  /**
   * Display synced lyrics with Apple Music styling
   */
  displaySyncedLyrics(syncedLyrics) {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;

    syncedLyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyric-line';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;
      
      // Check if lyric has word-level timing
      if (lyric.words && lyric.words.length > 0) {
        // Create word-by-word display
        lyric.words.forEach((wordData, wordIndex) => {
          const wordSpan = document.createElement('span');
          wordSpan.className = 'lyric-word future';
          wordSpan.textContent = wordData.word;
          wordSpan.dataset.wordIndex = wordIndex;
          wordSpan.dataset.wordTime = wordData.time;
          lyricLine.appendChild(wordSpan);
          
          // Add space after word (except last word)
          if (wordIndex < lyric.words.length - 1) {
            lyricLine.appendChild(document.createTextNode(' '));
          }
        });
      } else {
        // Regular line-by-line display
        lyricLine.textContent = lyric.text;
      }

      Object.assign(lyricLine.style, {
        padding: '12px 20px',
        fontSize: styles.FONT_SIZE_BASE,
        lineHeight: styles.LINE_HEIGHT,
        color: 'rgba(255, 255, 255, 0.4)',
        cursor: 'pointer',
        transition: `all ${styles.TRANSITION_DURATION} cubic-bezier(0.4, 0, 0.2, 1)`,
        transform: 'scale(1)',
        fontWeight: '400',
        maxWidth: '800px',
        margin: '0 auto'
      });

      // Click to seek
      lyricLine.addEventListener('click', () => {
        const event = new CustomEvent('lyric-seek', { 
          detail: { index, time: lyric.time } 
        });
        document.dispatchEvent(event);
      });

      // Hover effect
      lyricLine.addEventListener('mouseenter', () => {
        if (!lyricLine.classList.contains('current')) {
          lyricLine.style.color = 'rgba(255, 255, 255, 0.7)';
        }
      });

      lyricLine.addEventListener('mouseleave', () => {
        if (!lyricLine.classList.contains('current')) {
          lyricLine.style.color = 'rgba(255, 255, 255, 0.4)';
        }
      });

      this.lyricsContainer.appendChild(lyricLine);
    });
  }

  /**
   * Update current lyric highlight with smooth animations
   */
  updateCurrentLyric(currentIndex, currentTime = null) {
    if (!this.lyricsContainer) return;

    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;
    const lyricLines = this.lyricsContainer.querySelectorAll('.lyric-line');

    lyricLines.forEach((line, index) => {
      const isPast = index < currentIndex;
      const isCurrent = index === currentIndex;
      const isFuture = index > currentIndex;

      if (isCurrent) {
        line.classList.add('current');
        Object.assign(line.style, {
          color: '#ffffff',
          fontSize: `${this.currentFontSize * 1.5}px`,
          fontWeight: '600',
          transform: `scale(${styles.CURRENT_LINE_SCALE})`,
          textShadow: '0 2px 12px rgba(255, 255, 255, 0.3)'
        });

        // Update word-by-word highlighting if available
        if (currentTime !== null) {
          this.updateWordHighlight(line, currentTime);
        }

        // Smooth scroll to current lyric
        setTimeout(() => {
          const containerHeight = this.lyricsContainer.clientHeight;
          const lineTop = line.offsetTop;
          const lineHeight = line.offsetHeight;
          const scrollPosition = lineTop - (containerHeight / 2) + (lineHeight / 2);
          
          this.lyricsContainer.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
          });
        }, 50);

      } else {
        line.classList.remove('current');
        Object.assign(line.style, {
          fontSize: isPast ? `${this.currentFontSize * 0.95}px` : `${this.currentFontSize}px`,
          fontWeight: '400',
          transform: 'scale(1)',
          textShadow: 'none',
          color: isPast 
            ? `rgba(255, 255, 255, ${styles.PAST_LINE_OPACITY})` 
            : `rgba(255, 255, 255, ${styles.FUTURE_LINE_OPACITY})`
        });
        
        // Reset word highlighting for non-current lines
        const words = line.querySelectorAll('.lyric-word');
        words.forEach(word => {
          word.classList.remove('highlighted');
          if (isPast) {
            word.classList.remove('future');
            word.classList.add('past');
          } else {
            word.classList.remove('past');
            word.classList.add('future');
          }
        });
      }
    });
  }

  /**
   * Update word-by-word highlighting within a line
   */
  updateWordHighlight(lineElement, currentTime) {
    const words = lineElement.querySelectorAll('.lyric-word');
    if (words.length === 0) return;

    // Only highlight words if in word mode
    if (this.highlightMode !== 'word') {
      // In line mode, remove word-specific highlighting
      words.forEach(word => {
        word.classList.remove('highlighted', 'past', 'future');
      });
      return;
    }

    words.forEach(word => {
      const wordTime = parseFloat(word.dataset.wordTime);
      
      if (!isNaN(wordTime)) {
        const timeDiff = currentTime - wordTime;
        
        if (timeDiff >= 0 && timeDiff < 0.3) {
          // Current word being sung
          word.classList.add('highlighted');
          word.classList.remove('past', 'future');
        } else if (timeDiff >= 0.3) {
          // Past word
          word.classList.remove('highlighted', 'future');
          word.classList.add('past');
        } else {
          // Future word
          word.classList.remove('highlighted', 'past');
          word.classList.add('future');
        }
      }
    });
  }

  /**
   * Update song title and artist
   */
  updateTitle(title, artist = '') {
    const titleElement = document.getElementById('song-title');
    const artistElement = document.getElementById('song-artist');

    if (titleElement) {
      titleElement.textContent = title || 'Lyrics';
    }

    if (artistElement) {
      artistElement.textContent = artist;
      artistElement.style.display = artist ? 'block' : 'none';
    }
  }

  /**
   * Add a control element
   */
  addControl(element) {
    if (this.controlsContainer) {
      this.controlsContainer.appendChild(element);
    }
  }

  /**
   * Create styled select dropdown
   */
  createSelect(id, options, onChange) {
    const select = document.createElement('select');
    select.id = id;
    
    Object.assign(select.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s'
    });

    select.addEventListener('change', onChange);
    select.addEventListener('mouseenter', () => {
      select.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    select.addEventListener('mouseleave', () => {
      select.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      opt.style.background = '#1a1a1a';
      opt.style.color = '#ffffff';
      select.appendChild(opt);
    });

    return select;
  }

  /**
   * Create styled button
   */
  createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    
    Object.assign(button.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      fontSize: '14px',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s',
      fontWeight: '500'
    });

    button.addEventListener('click', onClick);
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'translateY(-1px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    const loading = document.createElement('div');
    loading.textContent = 'Loading lyrics...';
    Object.assign(loading.style, {
      textAlign: 'center',
      padding: '40px',
      fontSize: '16px',
      color: 'rgba(255, 255, 255, 0.6)'
    });

    this.lyricsContainer.appendChild(loading);
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.lyricsContainer) return;

    // Clear using replaceChildren for Trusted Types compatibility
    this.lyricsContainer.replaceChildren();
    const error = document.createElement('div');
    error.textContent = message;
    Object.assign(error.style, {
      textAlign: 'center',
      padding: '40px',
      fontSize: '16px',
      color: 'rgba(255, 100, 100, 0.9)'
    });

    this.lyricsContainer.appendChild(error);
  }

  /**
   * Remove the panel
   */
  removePanel() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.panel = null;
      this.lyricsContainer = null;
      this.controlsContainer = null;
    }
  }

  /**
   * Remove video player controls
   */
  removeVideoPlayerControls() {
    const container = document.querySelector('#lyrics-video-controls-container');
    if (container) {
      container.remove();
    }
  }

  /**
   * Check if panel exists
   */
  exists() {
    return this.panel !== null && document.contains(this.panel);
  }

  /**
   * Display lyrics (wrapper for synced/plain)
   */
  displayLyrics(lyrics) {
    if (Array.isArray(lyrics)) {
      this.displaySyncedLyrics(lyrics);
    } else if (typeof lyrics === 'string') {
      this.displayPlainLyrics(lyrics);
    }
  }

  /**
   * Set font size
   */
  setFontSize(size) {
    console.log('setFontSize called with:', size, 'lyricsContainer exists:', !!this.lyricsContainer);
    this.currentFontSize = size; // Store the current font size
    
    if (this.lyricsContainer) {
      // Set base font size
      this.lyricsContainer.style.setProperty('--lyrics-font-size', `${size}px`);
      this.lyricsContainer.style.setProperty('--lyrics-current-font-size', `${size * 1.5}px`);
      this.lyricsContainer.style.setProperty('--lyrics-past-font-size', `${size * 0.95}px`);
      
      // Also update all lyric lines directly
      const lyricLines = this.lyricsContainer.querySelectorAll('.lyric-line');
      lyricLines.forEach(line => {
        if (line.classList.contains('current')) {
          line.style.fontSize = `${size * 1.5}px`;
        } else if (line.classList.contains('past')) {
          line.style.fontSize = `${size * 0.95}px`;
        } else {
          line.style.fontSize = `${size}px`;
        }
      });
    }
  }

  /**
   * Set highlight mode (line or word)
   */
  setHighlightMode(mode) {
    this.highlightMode = mode;
    console.log('Highlight mode set to:', mode);
  }

  /**
   * Create song selector dropdown
   */
  createSongSelector(results, onSelect) {
    if (!this.controlsContainer || !results || results.length <= 1) return;
    
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
    
    const label = document.createElement('label');
    label.textContent = 'Song Version:';
    Object.assign(label.style, {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '500'
    });
    
    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      outline: 'none'
    });
    
    results.forEach((result, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${result.trackName} - ${result.artistName}${result.albumName ? ' (' + result.albumName + ')' : ''}`;
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      const selectedIndex = parseInt(e.target.value);
      if (onSelect) {
        onSelect(results[selectedIndex]);
      }
    });
    
    container.appendChild(label);
    container.appendChild(select);
    this.controlsContainer.appendChild(container);
  }

  /**
   * Create background mode selector
   */
  createBackgroundSelector(currentMode, currentTheme, onChange) {
    if (!this.controlsContainer) return;
    
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    });
    
    const label = document.createElement('label');
    label.textContent = 'Background:';
    Object.assign(label.style, {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: '500'
    });
    
    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      outline: 'none'
    });
    
    const modes = [
      { value: 'album', label: 'Album Art' },
      { value: 'gradient', label: 'Gradient' },
      { value: 'vinyl', label: 'Vinyl Disc' },
      { value: 'none', label: 'None' }
    ];
    
    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.label;
      option.selected = mode.value === currentMode;
      select.appendChild(option);
    });
    
    select.addEventListener('change', (e) => {
      if (onChange) {
        onChange(e.target.value, currentTheme);
      }
    });
    
    container.appendChild(label);
    container.appendChild(select);
    this.controlsContainer.appendChild(container);
  }

  /**
   * Create fullscreen button
   */
  createFullscreenButton(onToggle) {
    if (!this.controlsContainer) return;
    
    const button = document.createElement('button');
    button.textContent = '⛶ Fullscreen';
    Object.assign(button.style, {
      padding: '8px 16px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      fontSize: '13px',
      cursor: 'pointer',
      fontWeight: '500',
      transition: 'all 0.2s',
      flex: '1'
    });
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(255, 255, 255, 0.2)';
      button.style.transform = 'scale(1.02)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.transform = 'scale(1)';
    });
    
    button.addEventListener('click', () => {
      if (onToggle) {
        onToggle();
      }
    });
    
    this.controlsContainer.appendChild(button);
  }

  /**
   * Create video player controls
   */
  createVideoPlayerControls(onFullscreen, onTogglePanel, settings) {
    // Store settings reference for real-time updates
    this.settingsRef = settings;
    
    // Remove existing buttons if present
    const existingContainer = document.querySelector('#lyrics-video-controls-container');
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
    container.id = 'lyrics-video-controls-container';
    container.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-right: 8px; position: relative;';

    // Create settings button with lyrics icon
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'lyrics-settings-btn';
    settingsBtn.className = 'ytp-button';
    settingsBtn.setAttribute('aria-label', 'Lyrics Settings');
    settingsBtn.setAttribute('title', 'Lyrics Settings');
    settingsBtn.style.cssText = 'width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: transparent; border: none; color: white; opacity: 0.9;';
    
    // Create lyrics note icon SVG
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    iconSvg.style.width = '24px';
    iconSvg.style.height = '24px';
    
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    iconPath.setAttribute('d', 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z');
    iconPath.setAttribute('fill', 'currentColor');
    
    iconSvg.appendChild(iconPath);
    settingsBtn.appendChild(iconSvg);
    
    // Assemble container first so it exists before creating panel
    container.appendChild(settingsBtn);
    
    // Create settings popup panel (pass container to avoid null reference)
    const settingsPanel = this.createSettingsPanel(settings, onFullscreen, onTogglePanel, container);
    settingsPanel.style.display = 'none';
    container.appendChild(settingsPanel);
    
    // Toggle settings panel
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = isVisible ? 'none' : 'block';
      settingsBtn.style.opacity = isVisible ? '0.9' : '1';
    });
    
    settingsBtn.addEventListener('mouseenter', () => {
      if (settingsPanel.style.display === 'none') {
        settingsBtn.style.opacity = '1';
      }
    });
    
    settingsBtn.addEventListener('mouseleave', () => {
      if (settingsPanel.style.display === 'none') {
        settingsBtn.style.opacity = '0.9';
      }
    });
    
    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        settingsPanel.style.display = 'none';
        settingsBtn.style.opacity = '0.9';
      }
    });
    
    // Insert at the beginning of right controls
    rightControls.insertBefore(container, rightControls.firstChild);
    
    console.log('Lyrics controls added to video player');
    
    return { settingsBtn, settingsPanel, container };
  }

  /**
   * Create YouTube-style settings popup panel
   */
  createSettingsPanel(settings, onFullscreen, onTogglePanel, container) {
    const panel = document.createElement('div');
    panel.id = 'lyrics-settings-panel';
    panel.style.cssText = `
      position: absolute;
      bottom: 48px;
      right: 0;
      width: 272px;
      background: rgba(28, 28, 28, 0.97);
      border-radius: 2px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      z-index: 9999;
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      color: #eee;
    `;
    
    // Create menu items
    const menuItems = [
      {
        type: 'button',
        label: 'Show lyrics panel',
        checked: true,
        onClick: () => {
          menuItems[0].checked = !menuItems[0].checked;
          if (onTogglePanel) onTogglePanel();
          // Update checkmark
          const items = panel.querySelectorAll('div[data-menu-item]');
          items[0].querySelector('div:last-child').style.opacity = menuItems[0].checked ? '1' : '0';
        }
      },
      {
        type: 'button',
        label: 'Fullscreen karaoke',
        onClick: () => {
          panel.style.display = 'none';
          if (onFullscreen) onFullscreen();
        }
      },
      { type: 'separator' },
      {
        type: 'range',
        label: 'Font size',
        currentValue: (settings?.fontSize || 16) + 'px',
        min: 12,
        max: 24,
        value: settings?.fontSize || 16,
        onChange: (value) => {
          if (settings?.onFontSizeChange) {
            settings.onFontSizeChange(value);
            // Update stored settings
            if (this.settingsRef) this.settingsRef.fontSize = value;
          }
          return value + 'px';
        }
      },
      {
        type: 'range',
        label: 'Sync offset',
        currentValue: (settings?.syncDelay || 0) + 'ms',
        min: -2000,
        max: 2000,
        value: settings?.syncDelay || 0,
        step: 50,
        onChange: (value) => {
          if (settings?.onSyncDelayChange) {
            settings.onSyncDelayChange(value);
            // Update stored settings
            if (this.settingsRef) this.settingsRef.syncDelay = value;
          }
          return value + 'ms';
        }
      },
      { type: 'separator' },
      {
        type: 'submenu',
        label: 'Background',
        currentValue: this.getBackgroundLabel(settings?.backgroundMode || 'album'),
        options: [
          { value: 'album', label: 'Album art' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'video', label: 'Video thumbnail' },
          { value: 'none', label: 'None' }
        ],
        selected: settings?.backgroundMode || 'album',
        onChange: (value) => {
          if (settings?.onBackgroundModeChange) settings.onBackgroundModeChange(value);
        }
      },
      {
        type: 'submenu',
        label: 'Highlight mode',
        currentValue: this.getHighlightLabel(settings?.highlightMode || 'line'),
        options: [
          { value: 'line', label: 'Full line' },
          { value: 'word', label: 'Word by word' }
        ],
        selected: settings?.highlightMode || 'line',
        onChange: (value) => {
          if (settings?.onHighlightModeChange) settings.onHighlightModeChange(value);
        }
      }
    ];
    
    menuItems.forEach((item, idx) => {
      if (item.type === 'separator') {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: rgba(255, 255, 255, 0.1); margin: 4px 0;';
        panel.appendChild(separator);
        return;
      }
      
      const menuItem = document.createElement('div');
      menuItem.setAttribute('data-menu-item', 'true');
      menuItem.style.cssText = `
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.1s;
        min-height: 40px;
      `;
      
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.background = 'transparent';
      });
      
      const label = document.createElement('div');
      label.textContent = item.label;
      label.style.cssText = 'flex: 1; font-size: 13px;';
      menuItem.appendChild(label);
      
      if (item.type === 'button') {
        if (item.checked !== undefined) {
          const checkmark = document.createElement('div');
          checkmark.textContent = '✓';
          checkmark.style.cssText = `font-size: 16px; opacity: ${item.checked ? '1' : '0'};`;
          menuItem.appendChild(checkmark);
          
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.onClick) item.onClick();
          });
        } else {
          menuItem.addEventListener('click', (e) => {
            e.stopPropagation();
            if (item.onClick) item.onClick();
          });
        }
      } else if (item.type === 'range') {
        menuItem.style.flexDirection = 'column';
        menuItem.style.alignItems = 'stretch';
        menuItem.style.cursor = 'default';
        menuItem.style.padding = '12px 16px';
        
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';
        
        const labelDiv = document.createElement('div');
        labelDiv.textContent = item.label;
        labelDiv.style.fontSize = '13px';
        
        const valueDiv = document.createElement('div');
        valueDiv.textContent = item.currentValue;
        valueDiv.style.cssText = 'font-size: 13px; opacity: 0.6;';
        
        topRow.appendChild(labelDiv);
        topRow.appendChild(valueDiv);
        
        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'position: relative; height: 4px; background: rgba(255, 255, 255, 0.2); border-radius: 2px;';
        
        const sliderFill = document.createElement('div');
        const percentage = ((item.value - item.min) / (item.max - item.min)) * 100;
        sliderFill.style.cssText = `position: absolute; left: 0; top: 0; height: 100%; width: ${percentage}%; background: #f00; border-radius: 2px;`;
        
        const sliderThumb = document.createElement('div');
        sliderThumb.style.cssText = `position: absolute; top: 50%; left: ${percentage}%; transform: translate(-50%, -50%); width: 12px; height: 12px; background: #f00; border-radius: 50%; cursor: pointer;`;
        
        sliderContainer.appendChild(sliderFill);
        sliderContainer.appendChild(sliderThumb);
        
        let isDragging = false;
        let currentValue = item.value;
        
        sliderThumb.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          isDragging = true;
        });
        
        document.addEventListener('mousemove', (e) => {
          if (isDragging) {
            const rect = sliderContainer.getBoundingClientRect();
            let percentage = ((e.clientX - rect.left) / rect.width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));
            
            const value = Math.round(item.min + (percentage / 100) * (item.max - item.min));
            const step = item.step || 1;
            const steppedValue = Math.round(value / step) * step;
            
            const newPercentage = ((steppedValue - item.min) / (item.max - item.min)) * 100;
            sliderFill.style.width = newPercentage + '%';
            sliderThumb.style.left = newPercentage + '%';
            
            // Store current value and only update display text
            currentValue = steppedValue;
            const displayText = item.label.includes('Font') ? steppedValue + 'px' : steppedValue + 'ms';
            valueDiv.textContent = displayText;
          }
        });
        
        document.addEventListener('mouseup', (e) => {
          if (isDragging) {
            isDragging = false;
            // Apply the setting only on mouseup to prevent lag
            if (item.onChange) {
              const displayValue = item.onChange(currentValue);
              valueDiv.textContent = displayValue;
            }
          }
        });
        
        sliderContainer.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = sliderContainer.getBoundingClientRect();
          let percentage = ((e.clientX - rect.left) / rect.width) * 100;
          percentage = Math.max(0, Math.min(100, percentage));
          
          const value = Math.round(item.min + (percentage / 100) * (item.max - item.min));
          const step = item.step || 1;
          const steppedValue = Math.round(value / step) * step;
          
          const newPercentage = ((steppedValue - item.min) / (item.max - item.min)) * 100;
          sliderFill.style.width = newPercentage + '%';
          sliderThumb.style.left = newPercentage + '%';
          
          // Apply immediately on click
          if (item.onChange) {
            const displayValue = item.onChange(steppedValue);
            valueDiv.textContent = displayValue;
          }
        });
        
        menuItem.replaceChildren(topRow, sliderContainer);
      } else if (item.type === 'submenu') {
        const valueDiv = document.createElement('div');
        valueDiv.textContent = item.currentValue;
        valueDiv.style.cssText = 'font-size: 13px; opacity: 0.6; display: flex; align-items: center; gap: 4px;';
        
        const arrow = document.createElement('span');
        arrow.textContent = '›';
        arrow.style.fontSize = '16px';
        valueDiv.appendChild(arrow);
        
        menuItem.appendChild(valueDiv);
        
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          // Create submenu
          const submenu = this.createSubmenu(item.label, item.options, item.selected, (value) => {
            // Update display based on submenu type
            if (item.label === 'Background') {
              valueDiv.textContent = this.getBackgroundLabel(value);
            } else if (item.label === 'Highlight mode') {
              valueDiv.textContent = this.getHighlightLabel(value);
            } else {
              valueDiv.textContent = value;
            }
            valueDiv.appendChild(arrow);
            if (item.onChange) {
              item.onChange(value);
              // Update stored settings
              if (this.settingsRef) {
                if (item.label === 'Background') {
                  this.settingsRef.backgroundMode = value;
                } else if (item.label === 'Highlight mode') {
                  this.settingsRef.highlightMode = value;
                }
              }
            }
            submenu.remove();
          });
          panel.style.display = 'none';
          container.appendChild(submenu);
        });
      }
      
      panel.appendChild(menuItem);
    });
    
    return panel;
  }

  /**
   * Create submenu for options
   */
  createSubmenu(title, options, selected, onChange) {
    const submenu = document.createElement('div');
    submenu.style.cssText = `
      position: absolute;
      bottom: 48px;
      right: 0;
      width: 272px;
      background: rgba(28, 28, 28, 0.97);
      border-radius: 2px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      z-index: 10000;
      font-family: Roboto, Arial, sans-serif;
      font-size: 14px;
      color: #eee;
    `;
    
    // Back button
    const backBtn = document.createElement('div');
    backBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.1);';
    
    const backArrow = document.createElement('span');
    backArrow.textContent = '‹';
    backArrow.style.fontSize = '20px';
    
    const backLabel = document.createElement('span');
    backLabel.textContent = title;
    backLabel.style.fontSize = '13px';
    
    backBtn.appendChild(backArrow);
    backBtn.appendChild(backLabel);
    
    backBtn.addEventListener('mouseenter', () => {
      backBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    backBtn.addEventListener('mouseleave', () => {
      backBtn.style.background = 'transparent';
    });
    
    backBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      submenu.remove();
      document.querySelector('#lyrics-settings-panel').style.display = 'block';
    });
    
    submenu.appendChild(backBtn);
    
    // Options
    options.forEach(option => {
      const optionItem = document.createElement('div');
      optionItem.setAttribute('data-option', 'true');
      optionItem.style.cssText = `
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        transition: background 0.1s;
        min-height: 40px;
      `;
      
      const optionLabel = document.createElement('div');
      optionLabel.textContent = option.label;
      optionLabel.style.fontSize = '13px';
      
      const checkmark = document.createElement('div');
      checkmark.textContent = '✓';
      checkmark.style.cssText = `font-size: 16px; opacity: ${option.value === selected ? '1' : '0'};`;
      
      optionItem.appendChild(optionLabel);
      optionItem.appendChild(checkmark);
      
      optionItem.addEventListener('mouseenter', () => {
        optionItem.style.background = 'rgba(255, 255, 255, 0.1)';
      });
      
      optionItem.addEventListener('mouseleave', () => {
        optionItem.style.background = 'transparent';
      });
      
      optionItem.addEventListener('click', (e) => {
        e.stopPropagation();
        // Update all checkmarks
        const allCheckmarks = submenu.querySelectorAll('div[data-option]');
        allCheckmarks.forEach((item, idx) => {
          const check = item.querySelector('div:last-child');
          if (check) {
            check.style.opacity = options[idx].value === option.value ? '1' : '0';
          }
        });
        if (onChange) onChange(option.value);
      });
      
      submenu.appendChild(optionItem);
    });
    
    return submenu;
  }

  /**
   * Get background mode label
   */
  getBackgroundLabel(mode) {
    const labels = {
      'album': 'Album art',
      'gradient': 'Gradient',
      'video': 'Video thumbnail',
      'none': 'None'
    };
    return labels[mode] || 'Album art';
  }

  /**
   * Get highlight mode label
   */
  getHighlightLabel(mode) {
    const labels = {
      'line': 'Full line',
      'word': 'Word by word'
    };
    return labels[mode] || 'Full line';
  }

  /**
   * Update settings in the panel (for external changes)
   */
  updateSettingsDisplay(newSettings) {
    if (this.settingsRef) {
      Object.assign(this.settingsRef, newSettings);
    }
  }

  /**
   * Update lyric in specific container
   */
  updateLyricInContainer(container, index, lyric) {
    if (!container) return;
    
    const lines = container.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
      if (i === index) {
        line.classList.add('current');
        line.classList.remove('past', 'future');
        line.style.opacity = '1';
        line.style.transform = 'scale(1.15)';
      } else if (i < index) {
        line.classList.add('past');
        line.classList.remove('current', 'future');
        line.style.opacity = '0.4';
        line.style.transform = 'scale(1)';
      } else {
        line.classList.add('future');
        line.classList.remove('current', 'past');
        line.style.opacity = '0.6';
        line.style.transform = 'scale(1)';
      }
    });
  }

  /**
   * Display lyrics in specific container
   */
  displayLyricsInContainer(container, lyrics) {
    if (!container) return;
    
    container.replaceChildren();
    const styles = UI_CONFIG.APPLE_MUSIC_STYLE;

    lyrics.forEach((lyric, index) => {
      const lyricLine = document.createElement('div');
      lyricLine.className = 'lyric-line future';
      lyricLine.dataset.index = index;
      lyricLine.dataset.time = lyric.time;
      lyricLine.textContent = lyric.text;

      Object.assign(lyricLine.style, {
        padding: '20px 30px',
        fontSize: '20px',
        lineHeight: '1.8',
        color: 'rgba(255, 255, 255, 0.6)',
        transition: `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`,
        transform: 'scale(1)',
        fontWeight: '400',
        textAlign: 'center'
      });

      container.appendChild(lyricLine);
    });
  }
}

/**
 * Utility functions for title formatting
 */
export class TitleFormatter {
  /**
   * Format video title for lyrics search
   */
  static formatTitle(title) {
    if (!title) return '';

    const notAllowed = [...FILTER_WORDS.BASIC];
    
    // Add Korean characters to filter list
    for (let i = KOREAN_CHAR_RANGE.START; i <= KOREAN_CHAR_RANGE.END; i++) {
      notAllowed.push(String.fromCharCode(i));
    }

    let formatted = title.toLowerCase().split(' ');
    formatted = formatted
      .filter(word => !notAllowed.includes(word))
      .join(' ');

    // If title has a pipe and dash, remove text after pipe
    if (formatted.includes('|') && formatted.includes('-')) {
      formatted = formatted.split('|')[0];
    }

    return formatted.trim();
  }

  /**
   * Format title to song name only (more aggressive filtering)
   */
  static formatSongOnly(title) {
    if (!title) return '';

    const notAllowed = FILTER_WORDS.EXTENDED;

    let formatted = title.toLowerCase().split(' ');
    formatted = formatted
      .filter(word => 
        !notAllowed.map(w => w.toLowerCase()).includes(word) && 
        !/[\uAC00-\uD7AF]/.test(word)
      )
      .join(' ');

    // Remove text after pipe
    if (formatted.includes('|')) {
      formatted = formatted.split('|')[0];
    }

    // Remove text in brackets
    formatted = formatted.replace(/\[.*?\]/g, '');
    formatted = formatted.replace(/\(.*?\)/g, '');
    
    // Remove quotes
    formatted = formatted.replace(/''/g, '');
    formatted = formatted.replace(/"/g, '');

    return formatted.trim();
  }

  /**
   * Sanitize text for safe DOM insertion
   */
  static sanitize(text) {
    // For Trusted Types compatibility, just return the text
    // DOM elements should use textContent instead of innerHTML
    return String(text);
  }
}
