/**
 * StaticLyrics - Component for plain/unsynced lyrics display
 * 
 * Displays lyrics without timing, just styled text.
 * Used when no synced lyrics are available.
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class StaticLyrics {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {string} text - Lyrics text
     * @param {Object} options - Display options
     * @param {boolean} [options.isRomanized=false] - Whether to show romanization
     */
    constructor(container, text, options = {}) {
        this._maid = new Maid();
        this._container = container;
        this._text = text;
        this._options = options;

        // Signals
        this.RequestedTimeSkip = new Signal();

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the static lyrics display
     */
    _createDisplay() {
        const textElement = this._maid.Give(document.createElement('div'));
        textElement.className = 'static-lyrics-text';

        Object.assign(textElement.style, {
            whiteSpace: 'pre-wrap',
            lineHeight: '2',
            fontSize: '1rem',
            fontWeight: '400',
            letterSpacing: '0.02em',
            color: 'rgba(255, 255, 255, 0.9)',
            padding: '1.5rem',
            maxWidth: '600px',
            margin: '0 auto'
        });

        textElement.textContent = this._text;
        this._container.appendChild(textElement);
    }

    /**
     * Animate is called each frame but does nothing for static lyrics
     * @param {number} timestamp - Current playback timestamp
     * @param {number} deltaTime - Time since last frame
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    Animate(timestamp, deltaTime, skipped) {
        // Static lyrics don't animate
    }

    /**
     * Get whether this is currently active
     * @returns {boolean}
     */
    get IsActive() {
        return true; // Static lyrics are always "active"
    }

    /**
     * Clean up resources
     */
    Destroy() {
        this._maid.Destroy();
    }
}

export default StaticLyrics;
