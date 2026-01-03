/**
 * LyricsRenderer - Main orchestrator for lyrics display
 * 
 * Creates appropriate vocal components based on lyrics type and manages
 * the overall rendering lifecycle. Inspired by Beautiful Lyrics architecture.
 * 
 * @example
 * const renderer = new LyricsRenderer(container, lyricsData, {
 *   highlightMode: 'word',
 *   showRomanization: true
 * });
 * renderer.Animate(timestamp, deltaTime);
 * renderer.Destroy();
 */
import { Maid } from '../utils/Maid.js';
import { Signal } from '../utils/Signal.js';
import { LyricsScroller } from './LyricsScroller.js';
import { StaticLyrics } from './components/StaticLyrics.js';
import { LineLyrics } from './components/LineLyrics.js';
import { WordLyrics } from './components/WordLyrics.js';
import { Interlude } from './components/Interlude.js';
import { SyllableLyrics } from './components/SyllableLyrics.js';
import { BackgroundVocals } from './components/BackgroundVocals.js';

/**
 * @typedef {Object} LyricsData
 * @property {'static'|'line'|'word'|'syllable'} type - Type of lyrics
 * @property {Array<Object>} lines - Array of lyric lines
 * @property {number} [endTime] - End time of lyrics
 */

/**
 * @typedef {Object} LyricsOptions
 * @property {'line'|'word'|'syllable'} [highlightMode='line'] - Highlight mode
 * @property {boolean} [showRomanization=false] - Whether to show romanization
 * @property {boolean} [hideOriginalLyrics=false] - Whether to hide original when romanized
 * @property {boolean} [detectInterludes=true] - Whether to detect and show interludes
 * @property {number} [interludeThreshold=5] - Minimum gap in seconds to show interlude
 */

/**
 * @typedef {Object} VocalGroup
 * @property {HTMLElement} GroupContainer - Container element
 * @property {Array<LineLyrics|WordLyrics|StaticLyrics|Interlude|SyllableLyrics|BackgroundVocals>} Vocals - Vocal components
 * @property {'vocal'|'interlude'} [type] - Group type
 */


export class LyricsRenderer {
    /**
     * @param {HTMLElement} parentContainer - Parent container to render into
     * @param {LyricsData|Array} lyricsData - Lyrics data (or legacy array format)
     * @param {LyricsOptions} options - Rendering options
     */
    constructor(parentContainer, lyricsData, options = {}) {
        this._maid = new Maid();
        this._parentContainer = parentContainer;
        this._options = {
            highlightMode: options.highlightMode || 'line',
            showRomanization: options.showRomanization || false,
            hideOriginalLyrics: options.hideOriginalLyrics || false,
            detectInterludes: options.detectInterludes !== false, // Default true
            interludeThreshold: options.interludeThreshold || 5, // 5 seconds default
            ...options
        };


        // Normalize lyrics data
        this._lyricsData = this._normalizeLyricsData(lyricsData);

        // State
        this._currentIndex = -1;
        this._isDestroyed = false;

        /** @type {VocalGroup[]} */
        this._vocalGroups = [];

        /** @type {number[]} */
        this._vocalGroupStartTimes = [];

        /** @type {LyricsScroller|null} */
        this._scroller = null;

        // Signals
        this.OnLyricChange = this._maid.Give(new Signal());
        this.OnSeekRequest = this._maid.Give(new Signal());

        // Create containers and render
        this._createContainers();
        this._renderLyrics();
    }

    /**
     * Normalize lyrics data to internal format
     * @param {LyricsData|Array} data
     * @returns {LyricsData}
     */
    _normalizeLyricsData(data) {
        // If it's already in new format
        if (data && data.type && data.lines) {
            return data;
        }

        // Convert legacy array format
        if (Array.isArray(data)) {
            const hasWordTiming = data.some(line => line.words && line.words.length > 0);
            const hasTiming = data.some(line => line.time !== undefined);

            let type = 'static';
            if (hasTiming) {
                type = hasWordTiming ? 'word' : 'line';
            }

            // Calculate end time
            let endTime = 0;
            if (data.length > 0 && data[data.length - 1].time !== undefined) {
                endTime = data[data.length - 1].time + 10; // Add 10 seconds buffer
            }

            return {
                type,
                lines: data,
                endTime
            };
        }

        // Fallback
        return {
            type: 'static',
            lines: [],
            endTime: 0
        };
    }

    /**
     * Create container elements
     */
    _createContainers() {
        // Create scroll container
        this._scrollContainer = this._maid.Give(document.createElement('div'));
        this._scrollContainer.className = 'LyricsScrollContainer';
        Object.assign(this._scrollContainer.style, {
            flex: '1',
            overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
        });

        // Create lyrics container
        this._lyricsContainer = this._maid.Give(document.createElement('div'));
        this._lyricsContainer.className = 'Lyrics';
        this._lyricsContainer.id = 'lyrics-display';
        Object.assign(this._lyricsContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            padding: '1rem 1.5rem'
        });

        this._scrollContainer.appendChild(this._lyricsContainer);
        this._parentContainer.appendChild(this._scrollContainer);
    }

    /**
     * Render lyrics based on type
     */
    _renderLyrics() {
        const { type, lines } = this._lyricsData;

        // Add top spacer for scroll centering
        const topSpacer = document.createElement('div');
        topSpacer.style.height = '120px';
        topSpacer.style.flexShrink = '0';
        this._lyricsContainer.appendChild(topSpacer);

        if (type === 'static') {
            this._renderStaticLyrics(lines);
        } else {
            this._renderSyncedLyrics(lines, type);
        }

        // Add bottom spacer
        const bottomSpacer = document.createElement('div');
        bottomSpacer.style.height = '120px';
        bottomSpacer.style.flexShrink = '0';
        this._lyricsContainer.appendChild(bottomSpacer);
    }

    /**
     * Render static (unsynced) lyrics
     * @param {Array} lines
     */
    _renderStaticLyrics(lines) {
        const text = lines.map(l => l.text || l).join('\n');

        const groupContainer = this._maid.Give(document.createElement('div'));
        groupContainer.className = 'VocalsGroup';

        const staticVocal = this._maid.Give(new StaticLyrics(groupContainer, text, {
            isRomanized: this._options.showRomanization
        }));

        this._vocalGroups.push({
            GroupContainer: groupContainer,
            Vocals: [staticVocal]
        });

        this._lyricsContainer.appendChild(groupContainer);
    }

    /**
     * Render synced lyrics (line, word, or syllable level)
     * Now includes interlude detection and background vocal support
     * @param {Array} lines
     * @param {'line'|'word'|'syllable'} type
     */
    _renderSyncedLyrics(lines, type) {
        const useWordMode = type === 'word' || this._options.highlightMode === 'word';
        const useSyllableMode = type === 'syllable' || this._options.highlightMode === 'syllable';

        // Insert interludes if detection is enabled
        const processedItems = this._options.detectInterludes
            ? this._insertInterludes(lines)
            : lines.map(line => ({ type: 'vocal', data: line }));

        let vocalIndex = 0;

        processedItems.forEach((item) => {
            const groupContainer = this._maid.Give(document.createElement('div'));
            groupContainer.className = 'VocalsGroup';

            if (item.type === 'interlude') {
                // Render interlude visual
                const interlude = this._maid.Give(new Interlude(groupContainer, item.data));

                // Connect seek signal
                interlude.RequestedTimeSkip.Connect((time) => {
                    this.OnSeekRequest.Fire(time, vocalIndex);
                });

                this._vocalGroups.push({
                    GroupContainer: groupContainer,
                    Vocals: [interlude],
                    type: 'interlude'
                });
                this._vocalGroupStartTimes.push(item.data.startTime);
            } else {
                // Vocal line
                const lineData = item.data;
                const vocals = [];

                // Determine which component to use for lead vocal
                const hasWords = lineData.words && lineData.words.length > 0;
                const hasSyllables = lineData.syllables && lineData.syllables.length > 0;

                let ComponentClass;
                if (useSyllableMode && hasSyllables) {
                    ComponentClass = SyllableLyrics;
                } else if (useWordMode && hasWords) {
                    ComponentClass = WordLyrics;
                } else {
                    ComponentClass = LineLyrics;
                }

                const leadVocal = this._maid.Give(new ComponentClass(
                    groupContainer,
                    lineData,
                    vocalIndex,
                    {
                        isRomanized: this._options.showRomanization,
                        hideOriginal: this._options.hideOriginalLyrics
                    }
                ));

                // Connect seek signal
                leadVocal.RequestedTimeSkip.Connect((time) => {
                    this.OnSeekRequest.Fire(time, vocalIndex);
                });

                vocals.push(leadVocal);

                // Add background vocals if present
                if (lineData.background && Array.isArray(lineData.background)) {
                    lineData.background.forEach((bgData, bgIndex) => {
                        const bgVocal = this._maid.Give(new BackgroundVocals(
                            groupContainer,
                            bgData,
                            bgIndex,
                            {
                                isRomanized: this._options.showRomanization
                            }
                        ));

                        bgVocal.RequestedTimeSkip.Connect((time) => {
                            this.OnSeekRequest.Fire(time, vocalIndex);
                        });

                        vocals.push(bgVocal);
                    });
                }

                this._vocalGroups.push({
                    GroupContainer: groupContainer,
                    Vocals: vocals,
                    type: 'vocal'
                });
                this._vocalGroupStartTimes.push(lineData.time || 0);
                vocalIndex++;
            }

            this._lyricsContainer.appendChild(groupContainer);
        });

        // Create scroller for synced lyrics
        this._scroller = this._maid.Give(new LyricsScroller(
            this._scrollContainer,
            this._lyricsContainer,
            this._vocalGroups,
            true
        ));
    }

    /**
     * Insert interlude markers between lyrics with large gaps
     * @param {Array} lines - Original lyrics lines
     * @returns {Array} Lines with interludes inserted
     */
    _insertInterludes(lines) {
        if (!lines || lines.length === 0) return [];

        const result = [];
        const threshold = this._options.interludeThreshold;

        for (let i = 0; i < lines.length; i++) {
            const currentLine = lines[i];
            const nextLine = lines[i + 1];

            // Add the current line
            result.push({ type: 'vocal', data: currentLine });

            // Check for interlude between this line and next
            if (nextLine) {
                const currentEndTime = currentLine.endTime || (currentLine.time + 3);
                const nextStartTime = nextLine.time;
                const gap = nextStartTime - currentEndTime;

                // Only add interlude if gap is significant and not at very start
                if (gap >= threshold && currentEndTime > 3) {
                    result.push({
                        type: 'interlude',
                        data: {
                            startTime: currentEndTime,
                            endTime: nextStartTime,
                            duration: gap
                        }
                    });
                }
            }
        }

        return result;
    }


    /**
     * Animate all lyrics based on current timestamp
     * Should be called every frame during playback
     * @param {number} timestamp - Current playback timestamp in seconds
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {boolean} [skipped] - Whether playback was skipped
     */
    Animate(timestamp, deltaTime, skipped = false) {
        if (this._isDestroyed) return;

        // Animate all vocal groups
        for (const group of this._vocalGroups) {
            for (const vocal of group.Vocals) {
                vocal.Animate(timestamp, deltaTime, skipped);
            }
        }

        // Find and update current index
        const newIndex = this._findCurrentIndex(timestamp);
        if (newIndex !== this._currentIndex) {
            const previousIndex = this._currentIndex;
            this._currentIndex = newIndex;

            // Update scroller
            if (this._scroller && newIndex >= 0) {
                this._scroller.SetActive(newIndex, skipped);
            }

            this.OnLyricChange.Fire(newIndex, previousIndex);
        }

        // Handle lyrics ended
        if (this._scroller) {
            this._scroller.SetLyricsEnded(timestamp >= this._lyricsData.endTime);
        }

        // Force scroll on skip
        if (skipped && this._scroller) {
            this._scroller.ForceToActive(true);
        }
    }

    /**
     * Find current lyric index using binary search
     * @param {number} timestamp
     * @returns {number}
     */
    _findCurrentIndex(timestamp) {
        if (this._vocalGroupStartTimes.length === 0) return -1;

        let low = 0;
        let high = this._vocalGroupStartTimes.length - 1;
        let result = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this._vocalGroupStartTimes[mid] <= timestamp) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }

    /**
     * Force scroll to current active lyric
     * @param {boolean} [skippedByVocal=false]
     */
    ForceToActive(skippedByVocal = false) {
        if (this._scroller) {
            this._scroller.ForceToActive(skippedByVocal);
        }
    }

    /**
     * Set highlight mode
     * @param {'line'|'word'} mode
     */
    SetHighlightMode(mode) {
        this._options.highlightMode = mode;
        // Note: To fully change modes, lyrics need to be re-rendered
    }

    /**
     * Get the current lyric index
     * @returns {number}
     */
    get CurrentIndex() {
        return this._currentIndex;
    }

    /**
     * Get the lyrics container element
     * @returns {HTMLElement}
     */
    get Container() {
        return this._lyricsContainer;
    }

    /**
     * Get the scroll container element
     * @returns {HTMLElement}
     */
    get ScrollContainer() {
        return this._scrollContainer;
    }

    /**
     * Get all vocal groups
     * @returns {VocalGroup[]}
     */
    get VocalGroups() {
        return this._vocalGroups;
    }

    /**
     * Clean up resources
     */
    Destroy() {
        if (this._isDestroyed) return;
        this._isDestroyed = true;
        this._maid.Destroy();
    }
}

export default LyricsRenderer;
