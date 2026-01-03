/**
 * Maid - Resource cleanup utility inspired by Beautiful Lyrics
 * 
 * Tracks DOM elements, event listeners, and other disposables for automatic cleanup.
 * Prevents memory leaks by ensuring all tracked resources are properly disposed.
 * 
 * @example
 * const maid = new Maid();
 * const element = maid.Give(document.createElement('div'));
 * maid.GiveListener(element, 'click', handler);
 * // Later: maid.Destroy() cleans everything
 */
export class Maid {
    constructor() {
        /** @type {Array<{type: string, value: any, meta?: any}>} */
        this._tracked = [];
        this._destroyed = false;
    }

    /**
     * Track an item for cleanup
     * @template T
     * @param {T} item - Item to track (DOM element, object with destroy method, etc.)
     * @returns {T} The same item (for chaining)
     */
    Give(item) {
        if (this._destroyed) {
            console.warn('[Maid] Cannot Give() to a destroyed Maid');
            return item;
        }

        if (item instanceof HTMLElement) {
            this._tracked.push({ type: 'element', value: item });
        } else if (item instanceof Maid) {
            this._tracked.push({ type: 'maid', value: item });
        } else if (item && typeof item.Destroy === 'function') {
            this._tracked.push({ type: 'destroyable', value: item });
        } else if (item && typeof item.destroy === 'function') {
            this._tracked.push({ type: 'destroyable_lower', value: item });
        } else if (typeof item === 'function') {
            // Cleanup function
            this._tracked.push({ type: 'function', value: item });
        } else {
            // Generic object - just track it
            this._tracked.push({ type: 'generic', value: item });
        }

        return item;
    }

    /**
     * Track an event listener for automatic removal
     * @param {EventTarget} target - Element or object to attach listener to
     * @param {string} type - Event type
     * @param {EventListener} handler - Event handler function
     * @param {AddEventListenerOptions|boolean} [options] - Listener options
     * @returns {Function} Disconnect function to remove this specific listener
     */
    GiveListener(target, type, handler, options) {
        if (this._destroyed) {
            console.warn('[Maid] Cannot GiveListener() to a destroyed Maid');
            return () => { };
        }

        try {
            target.addEventListener(type, handler, options);
            const entry = {
                type: 'listener',
                value: handler,
                meta: { target, eventType: type, options }
            };
            this._tracked.push(entry);

            // Return disconnect function
            return () => {
                const index = this._tracked.indexOf(entry);
                if (index !== -1) {
                    this._tracked.splice(index, 1);
                    try {
                        target.removeEventListener(type, handler, options);
                    } catch (e) {
                        // Ignore removal errors
                    }
                }
            };
        } catch (e) {
            console.warn('[Maid] Failed to add listener:', e);
            return () => { };
        }
    }

    /**
     * Track a child Maid that will be destroyed when this Maid is destroyed
     * @param {Maid} childMaid - Child Maid instance
     * @returns {Maid} The child Maid (for chaining)
     */
    GiveChild(childMaid) {
        if (!(childMaid instanceof Maid)) {
            console.warn('[Maid] GiveChild expects a Maid instance');
            return childMaid;
        }
        return this.Give(childMaid);
    }

    /**
     * Track a timeout for automatic cleanup
     * @param {Function} callback - Timeout callback
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Timeout ID
     */
    GiveTimeout(callback, delay) {
        const timeoutId = setTimeout(callback, delay);
        this._tracked.push({ type: 'timeout', value: timeoutId });
        return timeoutId;
    }

    /**
     * Track an interval for automatic cleanup
     * @param {Function} callback - Interval callback
     * @param {number} delay - Delay in milliseconds
     * @returns {number} Interval ID
     */
    GiveInterval(callback, delay) {
        const intervalId = setInterval(callback, delay);
        this._tracked.push({ type: 'interval', value: intervalId });
        return intervalId;
    }

    /**
     * Track an animation frame for automatic cleanup
     * @param {FrameRequestCallback} callback - Animation frame callback
     * @returns {number} Animation frame ID
     */
    GiveAnimationFrame(callback) {
        const frameId = requestAnimationFrame(callback);
        this._tracked.push({ type: 'animationFrame', value: frameId });
        return frameId;
    }

    /**
     * Clean up all tracked resources
     * Cleanup happens in reverse order (LIFO - last in, first out)
     */
    Destroy() {
        if (this._destroyed) return;
        this._destroyed = true;

        // Clean up in reverse order
        for (let i = this._tracked.length - 1; i >= 0; i--) {
            const entry = this._tracked[i];
            try {
                switch (entry.type) {
                    case 'element':
                        if (entry.value.parentNode) {
                            entry.value.parentNode.removeChild(entry.value);
                        }
                        break;

                    case 'listener':
                        const { target, eventType, options } = entry.meta;
                        target.removeEventListener(eventType, entry.value, options);
                        break;

                    case 'maid':
                        entry.value.Destroy();
                        break;

                    case 'destroyable':
                        entry.value.Destroy();
                        break;

                    case 'destroyable_lower':
                        entry.value.destroy();
                        break;

                    case 'function':
                        entry.value();
                        break;

                    case 'timeout':
                        clearTimeout(entry.value);
                        break;

                    case 'interval':
                        clearInterval(entry.value);
                        break;

                    case 'animationFrame':
                        cancelAnimationFrame(entry.value);
                        break;

                    case 'generic':
                        // Nothing to clean up
                        break;

                    default:
                        console.warn('[Maid] Unknown tracked type:', entry.type);
                }
            } catch (e) {
                console.warn('[Maid] Error during cleanup:', e);
            }
        }

        this._tracked = [];
    }

    /**
     * Check if this Maid has been destroyed
     * @returns {boolean}
     */
    get IsDestroyed() {
        return this._destroyed;
    }

    /**
     * Get count of tracked items
     * @returns {number}
     */
    get TrackedCount() {
        return this._tracked.length;
    }
}

export default Maid;
