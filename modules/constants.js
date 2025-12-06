// API Configuration
export const API = {
  BASE_URL: 'https://lrclib.net/api',
  SEARCH_ENDPOINT: '/search',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000
};

// YouTube Selectors
export const SELECTORS = {
  SECONDARY_INNER: '#secondary-inner',
  VIDEO_TITLE: '#title > h1 > yt-formatted-string',
  ARTIST_NAME: '#text > a',
  VIDEO_PLAYER: 'video'
};

// URL Patterns
export const URL_PATTERNS = {
  YOUTUBE_VIDEO: /^https:\/\/www\.youtube\.com\/watch\?v=/
};

// Filter Words for Title Formatting
export const FILTER_WORDS = {
  BASIC: [
    'official',
    'video',
    'lyric',
    'lyrics',
    'music',
    'audio',
    'mv',
    'M/V',
    '(Official Video)',
    '(Official Music Video)',
    '(Lyric Video)',
    '(Audio)',
    '[Official Video]',
    '[Official Music Video]',
    '[Lyric Video]',
    '[Audio]'
  ],
  EXTENDED: [
    'MV',
    'M/V',
    'Official',
    'Video',
    'Lyric',
    'Lyrics',
    'Music',
    'Audio',
    'Live',
    'clip',
    'performance',
    'HD',
    '4K',
    'visualizer'
  ]
};

// Korean Hangul Character Range
export const KOREAN_CHAR_RANGE = {
  START: 44032,  // 가
  END: 55203     // 힣
};

// UI Configuration
export const UI_CONFIG = {
  PANEL_ID: 'Lyric-Panel',
  PANEL_CONTAINER_ID: 'Lyric-Panel-Container',
  SYNC_DELAY_DEFAULT: 0,
  SYNC_DELAY_STEP: 100,
  SCROLL_OFFSET: 200,
  LYRIC_TIME_THRESHOLD: 2, // seconds
  
  // Apple Music Style
  APPLE_MUSIC_STYLE: {
    BACKGROUND_COLOR: 'rgba(0, 0, 0, 0.85)',
    BACKDROP_BLUR: '40px',
    CURRENT_LINE_SCALE: 1.4,
    PAST_LINE_OPACITY: 0.4,
    FUTURE_LINE_OPACITY: 0.6,
    TRANSITION_DURATION: '0.3s',
    FONT_SIZE_BASE: '16px',
    FONT_SIZE_CURRENT: '24px',
    PADDING: '40px',
    MAX_WIDTH: '800px',
    LINE_HEIGHT: '1.8'
  }
};

// Storage Keys
export const STORAGE_KEYS = {
  IS_ENABLED: 'isEnabled',
  BACKGROUND_COLOR: 'backgroundColor',
  TEXT_COLOR: 'textColor',
  SYNC_DELAY: 'syncDelay',
  LYRICS_CACHE: 'lyricsCache'
};

// Error Messages
export const ERROR_MESSAGES = {
  NO_LYRICS_FOUND: "I'm sorry, I cannot find the lyrics for this song.",
  API_ERROR: "Failed to fetch lyrics. Please try again later.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  INVALID_VIDEO: "Invalid YouTube video.",
  PARSING_ERROR: "Failed to parse lyrics data."
};

// Cache Configuration
export const CACHE_CONFIG = {
  MAX_SIZE: 50, // Maximum number of cached lyrics
  EXPIRY_TIME: 86400000 // 24 hours in milliseconds
};

// Preset Gradients for Background
export const PRESET_GRADIENTS = [
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
];

// Export CONSTANTS object for compatibility
export const CONSTANTS = {
  API,
  SELECTORS,
  URL_PATTERNS,
  FILTER_WORDS,
  KOREAN_CHAR_RANGE,
  UI_CONFIG,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  CACHE_CONFIG,
  PRESET_GRADIENTS,
  KOREAN_RANGE: KOREAN_CHAR_RANGE,
  MESSAGES: ERROR_MESSAGES
};
