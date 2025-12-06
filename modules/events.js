/**
 * Event Bus Module - Decouples modules via event-driven communication
 */

export class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Emit an event with data
   */
  emit(eventName, data = null) {
    const handlers = this.events.get(eventName);
    
    if (!handlers || handlers.size === 0) {
      return;
    }
    
    for (const handler of handlers) {
      try {
        // Use queueMicrotask for async event handling
        queueMicrotask(() => handler(data));
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    }
  }

  /**
   * Subscribe to an event
   */
  on(eventName, handler) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, new Set());
    }
    
    this.events.get(eventName).add(handler);
    
    // Return unsubscribe function
    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off(eventName, handler) {
    const handlers = this.events.get(eventName);
    
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.events.delete(eventName);
      }
    }
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   */
  once(eventName, handler) {
    const wrappedHandler = (data) => {
      handler(data);
      this.off(eventName, wrappedHandler);
    };
    
    return this.on(eventName, wrappedHandler);
  }

  /**
   * Clear all handlers for a specific event
   */
  clear(eventName) {
    if (eventName) {
      this.events.delete(eventName);
    } else {
      this.events.clear();
    }
  }

  /**
   * Get list of all registered events
   */
  listEvents() {
    return Array.from(this.events.keys());
  }

  /**
   * Get handler count for an event
   */
  handlerCount(eventName) {
    const handlers = this.events.get(eventName);
    return handlers ? handlers.size : 0;
  }
}

// Event names constants
export const EVENTS = {
  // Navigation
  VIDEO_CHANGED: 'video:changed',
  VIDEO_NAVIGATE_AWAY: 'video:navigate-away',
  
  // Lyrics
  LYRICS_LOADED: 'lyrics:loaded',
  LYRICS_ERROR: 'lyrics:error',
  LYRICS_CHANGED: 'lyrics:changed',
  LYRIC_LINE_CHANGED: 'lyric:line-changed',
  
  // Sync
  SYNC_STARTED: 'sync:started',
  SYNC_STOPPED: 'sync:stopped',
  SYNC_UPDATE: 'sync:update',
  
  // Settings
  SETTINGS_UPDATED: 'settings:updated',
  FONT_SIZE_CHANGED: 'settings:font-size',
  SYNC_DELAY_CHANGED: 'settings:sync-delay',
  BACKGROUND_MODE_CHANGED: 'settings:background-mode',
  
  // UI
  PANEL_CREATED: 'ui:panel-created',
  PANEL_REMOVED: 'ui:panel-removed',
  FULLSCREEN_ENTERED: 'ui:fullscreen-entered',
  FULLSCREEN_EXITED: 'ui:fullscreen-exited',
  
  // Background
  BACKGROUND_UPDATED: 'background:updated',
  ALBUM_ART_LOADED: 'background:album-art-loaded'
};
