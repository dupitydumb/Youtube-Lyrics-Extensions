/**
 * LyricsScroller - Dedicated scroll management for lyrics display
 * 
 * Uses CSS transform (translateY) instead of scrollTop for smoother,
 * jitter-free animations. GPU-accelerated movement.
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
        this._isAnimating = false;
        this._animationId = null;
        this._lyricsEnded = false;
        this._currentTranslateY = 0;
        this._targetTranslateY = 0;
        this._userScrolled = false;
        this._userScrollTimeout = null;

        // Signals
        this.OnActiveChanged = this._maid.Give(new Signal());
        this.OnScrollComplete = this._maid.Give(new Signal());

        // Setup transform-based movement
        this._setupTransformMovement();
        
        // Setup user interaction detection
        this._setupScrollDetection();
    }

    /**
     * Setup the lyrics container for transform-based movement
     */
    _setupTransformMovement() {
        if (!this._lyricsContainer) return;
        
        // Enable GPU acceleration
        Object.assign(this._lyricsContainer.style, {
            willChange: 'transform',
            transform: 'translateY(0px)',
            transition: 'none' // We'll animate manually for more control
        });
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
     * Set the active vocal group and move lyrics to center it
     * @param {number} index - Index of the active vocal group
     * @param {boolean} [instant=false] - Whether to move instantly
     */
    SetActive(index, instant = false) {
        if (index === this._activeIndex) return;
        if (index < 0 || index >= this._vocalGroups.length) return;
        if (this._userScrolled) return; // Don't auto-move if user is scrolling

        const previousIndex = this._activeIndex;
        this._activeIndex = index;

        // Move lyrics to center the active line
        const group = this._vocalGroups[index];
        if (group && group.GroupContainer) {
            this._moveToElement(group.GroupContainer, instant);
        }

        this.OnActiveChanged.Fire(index, previousIndex);
    }

    /**
     * Force move to active line (used after seek)
     * @param {boolean} [skippedByVocal=false] - Whether the skip was initiated by clicking a lyric
     */
    ForceToActive(skippedByVocal = false) {
        this._userScrolled = false;

        if (this._activeIndex >= 0 && this._activeIndex < this._vocalGroups.length) {
            const group = this._vocalGroups[this._activeIndex];
            if (group && group.GroupContainer) {
                // Use instant move when user clicked a lyric
                this._moveToElement(group.GroupContainer, skippedByVocal);
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
     * Move lyrics container using CSS transform to center element
     * @param {HTMLElement} element - Element to center
     * @param {boolean} [instant=false] - Whether to move instantly
     */
    _moveToElement(element, instant = false) {
        if (!this._scrollContainer || !this._lyricsContainer || !element) return;

        // Don't interrupt animation unless instant
        if (this._isAnimating && !instant) return;

        const containerRect = this._scrollContainer.getBoundingClientRect();
        const containerHeight = containerRect.height;
        
        // Get element position relative to lyrics container
        const elementTop = element.offsetTop;
        const elementHeight = element.offsetHeight;

        // Calculate target translateY to center the element
        // We want the element to be at the vertical center of the container
        const targetTranslateY = -(elementTop - (containerHeight / 2) + (elementHeight / 2));

        if (instant) {
            this._currentTranslateY = targetTranslateY;
            this._targetTranslateY = targetTranslateY;
            this._lyricsContainer.style.transform = `translateY(${targetTranslateY}px)`;
            return;
        }

        this._targetTranslateY = targetTranslateY;
        this._animateTransform();
    }

    /**
     * Animate transform with easing - GPU accelerated, no jitter
     * @param {number} [duration=400] - Animation duration in ms
     */
    _animateTransform(duration = 400) {
        if (!this._lyricsContainer) return;

        const startPosition = this._currentTranslateY;
        const targetPosition = this._targetTranslateY;
        const distance = targetPosition - startPosition;

        // Skip if already close enough
        if (Math.abs(distance) < 2) return;

        // Cancel any existing animation
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }

        this._isAnimating = true;
        const startTime = performance.now();

        // Easing function - easeOutCubic for smooth deceleration
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = easeOutCubic(progress);

            this._currentTranslateY = startPosition + (distance * easeProgress);
            this._lyricsContainer.style.transform = `translateY(${this._currentTranslateY}px)`;

            if (progress < 1) {
                this._animationId = requestAnimationFrame(animate);
            } else {
                this._isAnimating = false;
                this._animationId = null;
                this.OnScrollComplete.Fire();
            }
        };

        this._animationId = requestAnimationFrame(animate);
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
     * Get whether currently animating
     * @returns {boolean}
     */
    get IsScrolling() {
        return this._isAnimating;
    }

    /**
     * Clean up resources
     */
    Destroy() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
        if (this._userScrollTimeout) {
            clearTimeout(this._userScrollTimeout);
        }
        this._maid.Destroy();
    }
}

export default LyricsScroller;
