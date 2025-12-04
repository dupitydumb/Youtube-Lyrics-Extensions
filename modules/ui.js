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

    // Create controls
    this.controlsContainer = this.createControls();
    this.panel.appendChild(this.controlsContainer);

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

    this.lyricsContainer.innerHTML = '';
    
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

    this.lyricsContainer.innerHTML = '';
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
          fontSize: styles.FONT_SIZE_CURRENT,
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
          fontSize: styles.FONT_SIZE_BASE,
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

    this.lyricsContainer.innerHTML = '';
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

    this.lyricsContainer.innerHTML = '';
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
   * Check if panel exists
   */
  exists() {
    return this.panel !== null && document.contains(this.panel);
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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
