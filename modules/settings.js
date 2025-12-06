/**
 * Settings Manager Module - Centralized storage access
 */

export class SettingsManager {
  constructor() {
    this.defaults = {
      enabled: true,
      fontSize: 16,
      syncDelay: 0,
      backgroundMode: 'album',
      gradientTheme: 'random',
      customColors: []
    };
    
    this.settings = { ...this.defaults };
    this.listeners = new Map();
  }

  /**
   * Load settings from Chrome storage
   */
  async load(keys = null) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('Chrome storage API not available, using defaults');
        this.settings = { ...this.defaults };
        return this.settings;
      }
      const keysToLoad = keys || Object.keys(this.defaults);
      const result = await chrome.storage.sync.get(keysToLoad);
      
      // Merge with defaults
      this.settings = { ...this.defaults, ...result };
      
      return this.settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.defaults;
    }
  }

  /**
   * Save settings to Chrome storage
   */
  async save(settingsToSave) {
    try {
      // Update local settings
      this.settings = { ...this.settings, ...settingsToSave };
      
      // Save to storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set(settingsToSave);
      }
      
      // Notify listeners
      this.notifyListeners(settingsToSave);
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Get a specific setting value
   */
  get(key) {
    return this.settings[key] !== undefined ? this.settings[key] : this.defaults[key];
  }

  /**
   * Set a specific setting value
   */
  async set(key, value) {
    return this.save({ [key]: value });
  }

  /**
   * Subscribe to settings changes
   */
  onChange(callback) {
    const id = Date.now() + Math.random();
    this.listeners.set(id, callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(id);
    };
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners(changes) {
    for (const callback of this.listeners.values()) {
      try {
        callback(changes, this.settings);
      } catch (error) {
        console.error('Error in settings listener:', error);
      }
    }
  }

  /**
   * Listen to Chrome storage changes (external changes from popup)
   */
  listenToStorageChanges() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('Chrome storage API not available, storage change listener not set');
      return;
    }
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        const updatedSettings = {};
        
        for (const [key, { newValue }] of Object.entries(changes)) {
          if (this.settings.hasOwnProperty(key) || this.defaults.hasOwnProperty(key)) {
            this.settings[key] = newValue;
            updatedSettings[key] = newValue;
          }
        }
        
        if (Object.keys(updatedSettings).length > 0) {
          this.notifyListeners(updatedSettings);
        }
      }
    });
  }

  /**
   * Reset settings to defaults
   */
  async reset() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set(this.defaults);
      }
      this.settings = { ...this.defaults };
      this.notifyListeners(this.defaults);
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return false;
    }
  }

  /**
   * Migrate old settings to new format (if needed)
   */
  async migrate() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return true;
      }
      const all = await chrome.storage.sync.get(null);
      
      // Example migration: rename old keys if they exist
      const migrations = {
        // 'oldKey': 'newKey'
      };
      
      let needsSave = false;
      const newSettings = {};
      
      for (const [oldKey, newKey] of Object.entries(migrations)) {
        if (all[oldKey] !== undefined && all[newKey] === undefined) {
          newSettings[newKey] = all[oldKey];
          needsSave = true;
          
          // Remove old key
          await chrome.storage.sync.remove(oldKey);
        }
      }
      
      if (needsSave) {
        await this.save(newSettings);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to migrate settings:', error);
      return false;
    }
  }
}
