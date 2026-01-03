/**
 * LineLyrics - Component for line-synced lyrics display
 * 
 * Handles:
 * - Line state transitions (past/current/future)
 * - Click-to-seek functionality
 * - Smooth state animations
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class LineLyrics {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {Object} lineData - Line data
     * @param {number} lineData.time - Start time in seconds
     * @param {number} [lineData.endTime] - End time in seconds
     * @param {string} lineData.text - Line text
     * @param {string} [lineData.romanized] - Romanized text
     * @param {number} index - Line index
     * @param {Object} options - Display options
     * @param {boolean} [options.isRomanized=false] - Whether to show romanization
     * @param {boolean} [options.hideOriginal=false] - Whether to hide original when romanized
     */
    constructor(container, lineData, index, options = {}) {
        this._maid = new Maid();
        this._container = container;
        this._lineData = lineData;
        this._index = index;
        this._options = options;

        // State
        this._state = 'future'; // 'past', 'current', 'future'
        this._isActive = false;

        // Signals
        this.RequestedTimeSkip = new Signal();
        this.OnStateChange = new Signal();

        // DOM elements
        this._lineElement = null;
        this._textElement = null;
        this._romanElement = null;

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the line lyrics display
     */
    _createDisplay() {
        // Create the line element
        this._lineElement = this._maid.Give(document.createElement('div'));
        this._lineElement.className = 'lyric-line lyric-future';
        this._lineElement.dataset.index = this._index;
        this._lineElement.dataset.time = this._lineData.time;

        // Check if we should hide original when showing romanization
        const shouldHideOriginal = this._lineData.romanized &&
            this._options.isRomanized &&
            this._options.hideOriginal;

        // Create text container
        this._textElement = document.createElement('div');
        this._textElement.className = 'lyric-text';
        this._textElement.textContent = this._lineData.text;

        if (shouldHideOriginal) {
            this._textElement.style.display = 'none';
        }

        this._lineElement.appendChild(this._textElement);

        // Add romanization if needed
        if (this._options.isRomanized && this._lineData.romanized) {
            this._romanElement = document.createElement('div');
            this._romanElement.className = 'romanization-text';
            this._romanElement.textContent = this._lineData.romanized;
            Object.assign(this._romanElement.style, {
                marginTop: '4px',
                fontSize: shouldHideOriginal ? '1em' : '0.85em',
                color: 'inherit',
                fontStyle: 'italic'
            });
            this._lineElement.appendChild(this._romanElement);
        }

        // Setup click handler for seek
        this._maid.GiveListener(this._lineElement, 'click', () => {
            this.RequestedTimeSkip.Fire(this._lineData.time);

            // Also dispatch DOM event for compatibility
            const event = new CustomEvent('lyric-seek', {
                detail: { index: this._index, time: this._lineData.time }
            });
            document.dispatchEvent(event);
        });

        this._container.appendChild(this._lineElement);
    }

    /**
     * Animate/update this line based on current timestamp
     * @param {number} timestamp - Current playback timestamp in seconds
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    Animate(timestamp, deltaTime, skipped) {
        const startTime = this._lineData.time;
        const endTime = this._lineData.endTime ?? (startTime + 5); // Default 5 second duration

        let newState;
        if (timestamp >= endTime) {
            newState = 'past';
        } else if (timestamp >= startTime) {
            newState = 'current';
        } else {
            newState = 'future';
        }

        if (newState !== this._state) {
            this._setState(newState, skipped);
        }
    }

    /**
     * Set the line state
     * @param {'past'|'current'|'future'} state - New state
     * @param {boolean} [instant=false] - Whether to transition instantly
     */
    _setState(state, instant = false) {
        const previousState = this._state;
        this._state = state;
        this._isActive = state === 'current';

        // Update classes
        this._lineElement.classList.remove('lyric-past', 'lyric-current', 'lyric-future');
        this._lineElement.classList.add(`lyric-${state}`);

        this.OnStateChange.Fire(state, previousState);
    }

    /**
     * Force set state (used for external control)
     * @param {'past'|'current'|'future'} state
     */
    SetState(state) {
        this._setState(state, false);
    }

    /**
     * Get the current state
     * @returns {'past'|'current'|'future'}
     */
    get State() {
        return this._state;
    }

    /**
     * Get whether this line is currently active
     * @returns {boolean}
     */
    get IsActive() {
        return this._isActive;
    }

    /**
     * Get the line element
     * @returns {HTMLElement}
     */
    get Element() {
        return this._lineElement;
    }

    /**
     * Get the start time
     * @returns {number}
     */
    get StartTime() {
        return this._lineData.time;
    }

    /**
     * Get the end time
     * @returns {number}
     */
    get EndTime() {
        return this._lineData.endTime ?? (this._lineData.time + 5);
    }

    /**
     * Get the line index
     * @returns {number}
     */
    get Index() {
        return this._index;
    }

    /**
     * Clean up resources
     */
    Destroy() {
        this._maid.Destroy();
    }
}

export default LineLyrics;
