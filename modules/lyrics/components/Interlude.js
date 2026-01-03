/**
 * Interlude - Visual component for musical interludes (instrumental breaks)
 * 
 * Shows animated bouncing dots during instrumental sections.
 * Inspired by Beautiful Lyrics' InterludeVisual component.
 */
import { Maid } from '../../utils/Maid.js';
import { Signal } from '../../utils/Signal.js';

export class Interlude {
    /**
     * @param {HTMLElement} container - Parent container
     * @param {Object} interludeData - Interlude timing data
     * @param {number} interludeData.startTime - Start time in seconds
     * @param {number} interludeData.endTime - End time in seconds
     * @param {number} [interludeData.duration] - Duration in seconds
     */
    constructor(container, interludeData) {
        this._maid = new Maid();
        this._container = container;
        this._data = interludeData;

        // State
        this._state = 'waiting'; // 'waiting', 'active', 'complete'
        this._progress = 0;

        // Signals
        this.RequestedTimeSkip = new Signal();
        this.OnStateChange = new Signal();

        // DOM elements
        this._element = null;
        this._dotsContainer = null;
        this._progressBar = null;

        // Create the display
        this._createDisplay();
    }

    /**
     * Create the interlude visual display
     */
    _createDisplay() {
        // Create main container
        this._element = this._maid.Give(document.createElement('div'));
        this._element.className = 'interlude-visual';
        this._element.dataset.startTime = this._data.startTime;
        this._element.dataset.endTime = this._data.endTime;

        // Create dots container
        this._dotsContainer = document.createElement('div');
        this._dotsContainer.className = 'interlude-dots';

        // Create 3 bouncing dots
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.className = 'interlude-dot';
            this._dotsContainer.appendChild(dot);
        }

        this._element.appendChild(this._dotsContainer);

        // Optional: Add duration indicator for long interludes
        const duration = this._data.duration || (this._data.endTime - this._data.startTime);
        if (duration > 10) {
            const durationLabel = document.createElement('div');
            durationLabel.className = 'interlude-duration';
            durationLabel.textContent = this._formatDuration(duration);
            Object.assign(durationLabel.style, {
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.4)',
                marginTop: '8px'
            });
            this._element.appendChild(durationLabel);
        }

        // Optional: Add progress bar for very long interludes
        if (duration > 15) {
            this._progressBar = document.createElement('div');
            this._progressBar.className = 'interlude-progress';
            Object.assign(this._progressBar.style, {
                width: '60%',
                height: '2px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '1px',
                marginTop: '12px',
                overflow: 'hidden'
            });

            const progressFill = document.createElement('div');
            progressFill.className = 'interlude-progress-fill';
            Object.assign(progressFill.style, {
                width: '0%',
                height: '100%',
                background: 'rgba(255, 255, 255, 0.4)',
                borderRadius: '1px',
                transition: 'width 0.1s linear'
            });

            this._progressBar.appendChild(progressFill);
            this._element.appendChild(this._progressBar);
        }

        // Click to seek to end of interlude
        this._maid.GiveListener(this._element, 'click', () => {
            this.RequestedTimeSkip.Fire(this._data.endTime - 0.5);
        });

        this._container.appendChild(this._element);
    }

    /**
     * Format duration as mm:ss
     * @param {number} seconds
     * @returns {string}
     */
    _formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${secs}s`;
    }

    /**
     * Animate/update based on current timestamp
     * @param {number} timestamp - Current playback timestamp in seconds
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    Animate(timestamp, deltaTime, skipped) {
        const { startTime, endTime } = this._data;
        const duration = endTime - startTime;

        let newState;
        if (timestamp < startTime) {
            newState = 'waiting';
            this._progress = 0;
        } else if (timestamp >= endTime) {
            newState = 'complete';
            this._progress = 1;
        } else {
            newState = 'active';
            this._progress = (timestamp - startTime) / duration;
        }

        // Update progress bar if exists
        if (this._progressBar) {
            const fill = this._progressBar.querySelector('.interlude-progress-fill');
            if (fill) {
                fill.style.width = `${this._progress * 100}%`;
            }
        }

        if (newState !== this._state) {
            this._setState(newState);
        }
    }

    /**
     * Set the interlude state
     * @param {'waiting'|'active'|'complete'} state
     */
    _setState(state) {
        const previousState = this._state;
        this._state = state;

        // Update element classes
        this._element.classList.remove('interlude-waiting', 'interlude-active', 'interlude-complete');
        this._element.classList.add(`interlude-${state}`);

        // Adjust visibility/animation based on state
        if (state === 'waiting') {
            this._element.style.opacity = '0.3';
            this._dotsContainer.style.animationPlayState = 'paused';
        } else if (state === 'active') {
            this._element.style.opacity = '1';
            this._dotsContainer.style.animationPlayState = 'running';
        } else {
            this._element.style.opacity = '0.3';
            this._dotsContainer.style.animationPlayState = 'paused';
        }

        this.OnStateChange.Fire(state, previousState);
    }

    /**
     * Get whether this interlude is currently active
     * @returns {boolean}
     */
    get IsActive() {
        return this._state === 'active';
    }

    /**
     * Get the current state
     * @returns {'waiting'|'active'|'complete'}
     */
    get State() {
        return this._state;
    }

    /**
     * Get the start time
     * @returns {number}
     */
    get StartTime() {
        return this._data.startTime;
    }

    /**
     * Get the end time
     * @returns {number}
     */
    get EndTime() {
        return this._data.endTime;
    }

    /**
     * Get the element
     * @returns {HTMLElement}
     */
    get Element() {
        return this._element;
    }

    /**
     * Clean up resources
     */
    Destroy() {
        this._maid.Destroy();
    }
}

export default Interlude;
