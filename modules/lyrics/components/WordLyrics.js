/**
 * WordLyrics - Component for word-by-word synced lyrics display
 * 
 * Handles:
 * - Word-level timing with binary search
 * - Per-word state transitions (past/current/future)
 * - Micro-animations on word changes
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class WordLyrics {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {Object} lineData - Line data with words
     * @param {number} lineData.time - Start time in seconds
     * @param {number} [lineData.endTime] - End time in seconds
     * @param {string} lineData.text - Full line text
     * @param {Array<{word: string, time: number}>} lineData.words - Word timing data
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
        this._currentWordIndex = -1;
        this._lastWordIndex = -1;

        // Signals
        this.RequestedTimeSkip = new Signal();
        this.OnStateChange = new Signal();
        this.OnWordChange = new Signal();

        // DOM elements
        this._lineElement = null;
        this._textContainer = null;
        this._wordElements = [];
        this._romanElement = null;

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the word-by-word lyrics display
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

        // Create text container for words
        this._textContainer = document.createElement('div');
        this._textContainer.className = 'lyric-text';

        if (shouldHideOriginal) {
            this._textContainer.style.display = 'none';
        }

        // Create word spans
        const words = this._lineData.words || [];
        words.forEach((wordData, wordIndex) => {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'lyric-word future';
            wordSpan.textContent = wordData.word;
            wordSpan.dataset.wordIndex = wordIndex;
            wordSpan.dataset.wordTime = wordData.time;

            this._wordElements.push(wordSpan);
            this._textContainer.appendChild(wordSpan);

            // Add space after word (except last)
            if (wordIndex < words.length - 1) {
                this._textContainer.appendChild(document.createTextNode(' '));
            }
        });

        this._lineElement.appendChild(this._textContainer);

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

        // Update word highlighting if current
        if (this._state === 'current') {
            this._updateWordHighlight(timestamp, skipped);
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

        // Use last word time + 1 second as fallback
        const words = this._lineData.words || [];
        if (words.length > 0) {
            return words[words.length - 1].time + 1;
        }

        return this._lineData.time + 5;
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

        // Update line classes
        this._lineElement.classList.remove('lyric-past', 'lyric-current', 'lyric-future');
        this._lineElement.classList.add(`lyric-${state}`);

        // Update all word states based on line state
        if (state === 'past') {
            this._setAllWordStates('past');
        } else if (state === 'future') {
            this._setAllWordStates('future');
            this._currentWordIndex = -1;
        }
        // 'current' state is handled by _updateWordHighlight

        this.OnStateChange.Fire(state, previousState);
    }

    /**
     * Set all words to a specific state
     * @param {'past'|'highlighted'|'future'} state
     */
    _setAllWordStates(state) {
        for (const wordEl of this._wordElements) {
            wordEl.classList.remove('highlighted', 'past', 'future');
            wordEl.classList.add(state);
        }
    }

    /**
     * Update word-by-word highlighting
     * @param {number} timestamp - Current timestamp
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    _updateWordHighlight(timestamp, skipped) {
        const words = this._lineData.words || [];
        if (words.length === 0) return;

        // Binary search for current word
        let low = 0;
        let high = words.length - 1;
        let currentWordIndex = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const wordTime = words[mid].time;

            if (wordTime <= timestamp) {
                currentWordIndex = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        // Skip if no change
        if (currentWordIndex === this._lastWordIndex && !skipped) {
            return;
        }

        const previousWordIndex = this._lastWordIndex;
        this._lastWordIndex = currentWordIndex;
        this._currentWordIndex = currentWordIndex;

        // Update word states
        for (let i = 0; i < this._wordElements.length; i++) {
            const wordEl = this._wordElements[i];
            wordEl.classList.remove('highlighted', 'past', 'future');

            if (i < currentWordIndex) {
                // Past words
                wordEl.classList.add('past');
            } else if (i === currentWordIndex) {
                // Current word
                wordEl.classList.add('highlighted');

                // Add pulse animation on word change (not on skip)
                if (previousWordIndex !== currentWordIndex && !skipped) {
                    wordEl.style.animation = 'word-pulse 0.4s ease-out';
                    this._maid.GiveTimeout(() => {
                        if (wordEl) wordEl.style.animation = '';
                    }, 400);
                }
            } else {
                // Future words
                wordEl.classList.add('future');
            }
        }

        this.OnWordChange.Fire(currentWordIndex, previousWordIndex);
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
     * Get the current word index
     * @returns {number}
     */
    get CurrentWordIndex() {
        return this._currentWordIndex;
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

export default WordLyrics;
