/**
 * SyllableLyrics - Component for syllable-level karaoke-style highlighting
 * 
 * Provides progressive fill animation as each syllable is sung,
 * similar to karaoke displays.
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class SyllableLyrics {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {Object} lineData - Line data with syllables
     * @param {number} lineData.time - Start time in seconds
     * @param {number} [lineData.endTime] - End time in seconds
     * @param {string} lineData.text - Full line text
     * @param {Array<{syllable: string, time: number, endTime?: number}>} lineData.syllables - Syllable timing data
     * @param {string} [lineData.romanized] - Romanized text
     * @param {number} index - Line index
     * @param {Object} options - Display options
     */
    constructor(container, lineData, index, options = {}) {
        this._maid = new Maid();
        this._container = container;
        this._lineData = lineData;
        this._index = index;
        this._options = options;

        // State
        this._state = 'future';
        this._isActive = false;
        this._currentSyllableIndex = -1;
        this._currentSyllableProgress = 0;

        // Signals
        this.RequestedTimeSkip = new Signal();
        this.OnStateChange = new Signal();
        this.OnSyllableChange = new Signal();

        // DOM elements
        this._lineElement = null;
        this._textContainer = null;
        this._syllableElements = [];

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the syllable-level display
     */
    _createDisplay() {
        // Create the line element
        this._lineElement = this._maid.Give(document.createElement('div'));
        this._lineElement.className = 'lyric-line lyric-future syllable-mode';
        this._lineElement.dataset.index = this._index;
        this._lineElement.dataset.time = this._lineData.time;

        // Create text container for syllables
        this._textContainer = document.createElement('div');
        this._textContainer.className = 'lyric-text syllable-container';

        // Create syllable spans
        const syllables = this._lineData.syllables || [];
        syllables.forEach((syllableData, syllableIndex) => {
            const syllableSpan = document.createElement('span');
            syllableSpan.className = 'syllable future';
            syllableSpan.dataset.syllableIndex = syllableIndex;
            syllableSpan.dataset.syllableTime = syllableData.time;
            if (syllableData.endTime) {
                syllableSpan.dataset.syllableEndTime = syllableData.endTime;
            }

            // Create inner span for karaoke effect
            const innerSpan = document.createElement('span');
            innerSpan.className = 'syllable-inner';
            innerSpan.textContent = syllableData.syllable || syllableData.text || '';
            syllableSpan.appendChild(innerSpan);

            this._syllableElements.push(syllableSpan);
            this._textContainer.appendChild(syllableSpan);
        });

        this._lineElement.appendChild(this._textContainer);

        // Add romanization if needed
        if (this._options.isRomanized && this._lineData.romanized) {
            const romanElement = document.createElement('div');
            romanElement.className = 'romanization-text';
            romanElement.textContent = this._lineData.romanized;
            Object.assign(romanElement.style, {
                marginTop: '4px',
                fontSize: '0.85em',
                color: 'inherit',
                fontStyle: 'italic'
            });
            this._lineElement.appendChild(romanElement);
        }

        // Setup click handler for seek
        this._maid.GiveListener(this._lineElement, 'click', () => {
            this.RequestedTimeSkip.Fire(this._lineData.time);

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
        const endTime = this._getEndTime();

        // Determine line state
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

        // Update syllable highlighting if current
        if (this._state === 'current') {
            this._updateSyllableHighlight(timestamp);
        }
    }

    /**
     * Get the end time of this line
     * @returns {number}
     */
    _getEndTime() {
        if (this._lineData.endTime !== undefined) {
            return this._lineData.endTime;
        }

        const syllables = this._lineData.syllables || [];
        if (syllables.length > 0) {
            const lastSyllable = syllables[syllables.length - 1];
            return lastSyllable.endTime || lastSyllable.time + 0.5;
        }

        return this._lineData.time + 5;
    }

    /**
     * Set the line state
     * @param {'past'|'current'|'future'} state
     * @param {boolean} [instant=false]
     */
    _setState(state, instant = false) {
        const previousState = this._state;
        this._state = state;
        this._isActive = state === 'current';

        // Update line classes
        this._lineElement.classList.remove('lyric-past', 'lyric-current', 'lyric-future');
        this._lineElement.classList.add(`lyric-${state}`);

        // Update syllable states based on line state
        if (state === 'past') {
            this._setAllSyllableStates('past', 1);
        } else if (state === 'future') {
            this._setAllSyllableStates('future', 0);
            this._currentSyllableIndex = -1;
        }

        this.OnStateChange.Fire(state, previousState);
    }

    /**
     * Set all syllables to a specific state
     * @param {'past'|'active'|'future'} state
     * @param {number} progress - Fill progress (0-1)
     */
    _setAllSyllableStates(state, progress) {
        for (const syllableEl of this._syllableElements) {
            syllableEl.classList.remove('past', 'active', 'future');
            syllableEl.classList.add(state);
            syllableEl.style.setProperty('--sung-percent', `${progress * 100}%`);
        }
    }

    /**
     * Update syllable-by-syllable karaoke highlighting
     * @param {number} timestamp - Current timestamp
     */
    _updateSyllableHighlight(timestamp) {
        const syllables = this._lineData.syllables || [];
        if (syllables.length === 0) return;

        for (let i = 0; i < syllables.length; i++) {
            const syllable = syllables[i];
            const syllableEl = this._syllableElements[i];
            const startTime = syllable.time;
            const endTime = syllable.endTime || (syllables[i + 1]?.time || startTime + 0.3);

            syllableEl.classList.remove('past', 'active', 'future');

            if (timestamp >= endTime) {
                // Past syllable - fully sung
                syllableEl.classList.add('past');
                syllableEl.style.setProperty('--sung-percent', '100%');
            } else if (timestamp >= startTime) {
                // Active syllable - progressive fill
                syllableEl.classList.add('active', 'syllable-karaoke');
                const progress = (timestamp - startTime) / (endTime - startTime);
                syllableEl.style.setProperty('--sung-percent', `${Math.min(progress * 100, 100)}%`);

                if (i !== this._currentSyllableIndex) {
                    this._currentSyllableIndex = i;
                    this.OnSyllableChange.Fire(i);
                }
            } else {
                // Future syllable
                syllableEl.classList.add('future');
                syllableEl.style.setProperty('--sung-percent', '0%');
            }
        }
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
     * Get the current syllable index
     * @returns {number}
     */
    get CurrentSyllableIndex() {
        return this._currentSyllableIndex;
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
        return this._getEndTime();
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

export default SyllableLyrics;
