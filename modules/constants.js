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
