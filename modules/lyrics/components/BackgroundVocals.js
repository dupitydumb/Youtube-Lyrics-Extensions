/**
 * BackgroundVocals - Component for background/backing vocals
 * 
 * Displays background vocals with proper styling (italicized, parenthesized)
 * and optional opposite alignment support.
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class BackgroundVocals {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {Object} vocalData - Background vocal data
     * @param {string} vocalData.text - Vocal text
     * @param {number} vocalData.startTime - Start time in seconds
     * @param {number} [vocalData.endTime] - End time in seconds
     * @param {boolean} [vocalData.oppositeAligned=false] - Whether to align opposite
     * @param {number} index - Vocal index
     * @param {Object} options - Display options
     */
    constructor(container, vocalData, index, options = {}) {
        this._maid = new Maid();
        this._container = container;
        this._vocalData = vocalData;
        this._index = index;
        this._options = options;

        // State
        this._state = 'future';
        this._isActive = false;

        // Signals
        this.RequestedTimeSkip = new Signal();
        this.OnStateChange = new Signal();

        // DOM elements
        this._element = null;

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the background vocal display
     */
    _createDisplay() {
        // Create the vocal element
        this._element = this._maid.Give(document.createElement('div'));
        this._element.className = 'background-vocal lyric-future';
        this._element.dataset.index = this._index;
        this._element.dataset.startTime = this._vocalData.startTime;

        // Add opposite alignment class if needed
        if (this._vocalData.oppositeAligned) {
            this._element.classList.add('opposite-aligned');
        }

        // Create text content (without parentheses - CSS adds them)
        const textSpan = document.createElement('span');
        textSpan.className = 'background-vocal-text';
        textSpan.textContent = this._vocalData.text;

        this._element.appendChild(textSpan);

        // Setup click handler for seek
        this._maid.GiveListener(this._element, 'click', () => {
            this.RequestedTimeSkip.Fire(this._vocalData.startTime);

            const event = new CustomEvent('lyric-seek', {
                detail: { index: this._index, time: this._vocalData.startTime }
            });
            document.dispatchEvent(event);
        });

        this._container.appendChild(this._element);
    }

    /**
     * Animate/update this vocal based on current timestamp
     * @param {number} timestamp - Current playback timestamp in seconds
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    Animate(timestamp, deltaTime, skipped) {
        const startTime = this._vocalData.startTime;
        const endTime = this._vocalData.endTime ?? (startTime + 3);

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
     * Set the vocal state
     * @param {'past'|'current'|'future'} state
     * @param {boolean} [instant=false]
     */
    _setState(state, instant = false) {
        const previousState = this._state;
        this._state = state;
        this._isActive = state === 'current';

        // Update classes
        this._element.classList.remove('lyric-past', 'lyric-current', 'lyric-future');
        this._element.classList.add(`lyric-${state}`);

        this.OnStateChange.Fire(state, previousState);
    }

    /**
     * Get the current state
     * @returns {'past'|'current'|'future'}
     */
    get State() {
        return this._state;
    }

    /**
     * Get whether this vocal is currently active
     * @returns {boolean}
     */
    get IsActive() {
        return this._isActive;
    }

    /**
     * Get the element
     * @returns {HTMLElement}
     */
    get Element() {
        return this._element;
    }

    /**
     * Get the start time
     * @returns {number}
     */
    get StartTime() {
        return this._vocalData.startTime;
    }

    /**
     * Get the end time
     * @returns {number}
     */
    get EndTime() {
        return this._vocalData.endTime ?? (this._vocalData.startTime + 3);
    }

    /**
     * Get the index
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

export default BackgroundVocals;
