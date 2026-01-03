/**
 * LyricsScroller - Dedicated scroll management for lyrics display
 * 
 * Handles smooth scrolling with easing, force-to-active on seek,
 * lyrics-ended detection, and jitter prevention.
 * 
 * Inspired by Beautiful Lyrics' LyricsScroller pattern.
 */
import { Maid } from '../utils/Maid.js';
import { Signal } from '../utils/Signal.js';

export class LyricsScroller {
    /**
     * @param {HTMLElement} scrollContainer - The scrollable container
     * @param {HTMLElement} lyricsContainer - The container holding lyric lines
     * @param {Array<{GroupContainer: HTMLElement}>} vocalGroups - Array of vocal group objects
     * @param {boolean} isSynced - Whether lyrics are synced
     */
    constructor(scrollContainer, lyricsContainer, vocalGroups, isSynced) {
        this._maid = new Maid();
        this._scrollContainer = scrollContainer;
        this._lyricsContainer = lyricsContainer;
        this._vocalGroups = vocalGroups;
        this._isSynced = isSynced;

        // State
        this._activeIndex = -1;
        this._isScrolling = false;
        this._scrollAnimationId = null;
        this._lyricsEnded = false;
        this._lastScrollTime = 0;
        this._userScrolled = false;
        this._userScrollTimeout = null;

        // Signals
        this.OnActiveChanged = this._maid.Give(new Signal());
        this.OnScrollComplete = this._maid.Give(new Signal());

        // Setup scroll detection to know when user manually scrolls
        this._setupScrollDetection();
    }

    /**
     * Setup detection for user-initiated scrolls
     */
    _setupScrollDetection() {
        let scrollTimeout;

        this._maid.GiveListener(this._scrollContainer, 'wheel', () => {
            this._userScrolled = true;
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this._userScrolled = false;
            }, 3000); // Resume auto-scroll after 3 seconds of no user interaction
        }, { passive: true });

        this._maid.GiveListener(this._scrollContainer, 'touchstart', () => {
            this._userScrolled = true;
        }, { passive: true });

        this._maid.GiveListener(this._scrollContainer, 'touchend', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this._userScrolled = false;
            }, 3000);
        }, { passive: true });
    }

    /**
     * Set the active vocal group and scroll to it
     * @param {number} index - Index of the active vocal group
     * @param {boolean} [instant=false] - Whether to scroll instantly
     */
    SetActive(index, instant = false) {
        if (index === this._activeIndex) return;
        if (index < 0 || index >= this._vocalGroups.length) return;
        if (this._userScrolled) return; // Don't auto-scroll if user is scrolling

        const previousIndex = this._activeIndex;
        this._activeIndex = index;

        // Scroll the active line into view
        const group = this._vocalGroups[index];
        if (group && group.GroupContainer) {
            this._scrollToElement(group.GroupContainer, instant);
        }

        this.OnActiveChanged.Fire(index, previousIndex);
    }

    /**
     * Force scroll to active line (used after seek)
     * @param {boolean} [skippedByVocal=false] - Whether the skip was initiated by clicking a lyric
     */
    ForceToActive(skippedByVocal = false) {
        this._userScrolled = false;

        if (this._activeIndex >= 0 && this._activeIndex < this._vocalGroups.length) {
            const group = this._vocalGroups[this._activeIndex];
            if (group && group.GroupContainer) {
                // Use instant scroll when user clicked a lyric
                this._scrollToElement(group.GroupContainer, skippedByVocal);
            }
        }
    }

    /**
     * Set whether lyrics have ended
     * @param {boolean} ended 
     */
    SetLyricsEnded(ended) {
        this._lyricsEnded = ended;
    }

    /**
     * Scroll to an element with smooth animation
     * @param {HTMLElement} element - Element to scroll to
     * @param {boolean} [instant=false] - Whether to scroll instantly
     */
    _scrollToElement(element, instant = false) {
        if (!this._scrollContainer || !element) return;

        // Prevent jitter - don't start new scroll if already scrolling
        if (this._isScrolling && !instant) return;

        const containerRect = this._scrollContainer.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Calculate target position to center the element
        const containerHeight = containerRect.height;
        const elementTop = element.offsetTop;
        const elementHeight = element.offsetHeight;

        const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

        if (instant) {
            this._scrollContainer.scrollTop = targetScrollTop;
            return;
        }

        this._smoothScrollTo(targetScrollTop);
    }

    /**
     * Smooth scroll with easing
     * @param {number} targetPosition - Target scroll position
     * @param {number} [duration=350] - Animation duration in ms
     */
    _smoothScrollTo(targetPosition, duration = 350) {
        if (!this._scrollContainer) return;

        const startPosition = this._scrollContainer.scrollTop;
        const distance = targetPosition - startPosition;

        // Skip if already close enough
        if (Math.abs(distance) < 5) return;

        // Cancel any existing animation
        if (this._scrollAnimationId) {
            cancelAnimationFrame(this._scrollAnimationId);
        }

        this._isScrolling = true;
        const startTime = performance.now();

        // Easing function - easeOutCubic for smooth deceleration
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = easeOutCubic(progress);

            this._scrollContainer.scrollTop = startPosition + (distance * easeProgress);

            if (progress < 1) {
                this._scrollAnimationId = requestAnimationFrame(animateScroll);
            } else {
                this._isScrolling = false;
                this._scrollAnimationId = null;
                this.OnScrollComplete.Fire();
            }
        };

        this._scrollAnimationId = requestAnimationFrame(animateScroll);
    }

    /**
     * Get the current active index
     * @returns {number}
     */
    get ActiveIndex() {
        return this._activeIndex;
    }

    /**
     * Get whether lyrics have ended
     * @returns {boolean}
     */
    get LyricsEnded() {
        return this._lyricsEnded;
    }

    /**
     * Get whether currently scrolling
     * @returns {boolean}
     */
    get IsScrolling() {
        return this._isScrolling;
    }

    /**
     * Clean up resources
     */
    Destroy() {
        if (this._scrollAnimationId) {
            cancelAnimationFrame(this._scrollAnimationId);
        }
        if (this._userScrollTimeout) {
            clearTimeout(this._userScrollTimeout);
        }
        this._maid.Destroy();
    }
}

export default LyricsScroller;
