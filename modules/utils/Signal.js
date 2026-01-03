/**
 * Signal - Event system for decoupled component communication
 * 
 * Similar to the Beautiful Lyrics pattern for reactive updates.
 * Allows components to subscribe to events without tight coupling.
 * 
 * @example
 * const onUpdate = new Signal();
 * const disconnect = onUpdate.Connect((time, delta) => { ... });
 * onUpdate.Fire(currentTime, deltaTime);
 * disconnect(); // Cleanup
 */
export class Signal {
    constructor() {
        /** @type {Set<Function>} */
        this._listeners = new Set();
        this._firing = false;
        /** @type {Array<{action: 'add'|'remove', callback: Function}>} */
        this._pendingChanges = [];
    }

    /**
     * Subscribe to this signal
     * @param {Function} callback - Function to call when signal fires
     * @returns {Function} Disconnect function to unsubscribe
     */
    Connect(callback) {
        if (typeof callback !== 'function') {
            console.warn('[Signal] Connect expects a function');
            return () => { };
        }

        // If we're currently firing, queue the addition
        if (this._firing) {
            this._pendingChanges.push({ action: 'add', callback });
        } else {
            this._listeners.add(callback);
        }

        // Return disconnect function
        return () => this.Disconnect(callback);
    }

    /**
     * Unsubscribe from this signal
     * @param {Function} callback - Function to remove
     */
    Disconnect(callback) {
        // If we're currently firing, queue the removal
        if (this._firing) {
            this._pendingChanges.push({ action: 'remove', callback });
        } else {
            this._listeners.delete(callback);
        }
    }

    /**
     * Emit the signal to all subscribers
     * @param {...any} args - Arguments to pass to listeners
     */
    Fire(...args) {
        this._firing = true;

        for (const listener of this._listeners) {
            try {
                listener(...args);
            } catch (e) {
                console.error('[Signal] Error in listener:', e);
            }
        }

        this._firing = false;

        // Process any pending changes that occurred during firing
        for (const change of this._pendingChanges) {
            if (change.action === 'add') {
                this._listeners.add(change.callback);
            } else {
                this._listeners.delete(change.callback);
            }
        }
        this._pendingChanges = [];
    }

    /**
     * Fire the signal asynchronously (next tick)
     * @param {...any} args - Arguments to pass to listeners
     */
    FireAsync(...args) {
        queueMicrotask(() => this.Fire(...args));
    }

    /**
     * Fire the signal on next animation frame
     * @param {...any} args - Arguments to pass to listeners
     * @returns {number} Animation frame ID
     */
    FireOnFrame(...args) {
        return requestAnimationFrame(() => this.Fire(...args));
    }

    /**
     * Remove all listeners
     */
    Clear() {
        if (this._firing) {
            // If firing, queue removal of all
            for (const listener of this._listeners) {
                this._pendingChanges.push({ action: 'remove', callback: listener });
            }
        } else {
            this._listeners.clear();
        }
    }

    /**
     * Check if any listeners are connected
     * @returns {boolean}
     */
    get HasListeners() {
        return this._listeners.size > 0;
    }

    /**
     * Get the number of connected listeners
     * @returns {number}
     */
    get ListenerCount() {
        return this._listeners.size;
    }

    /**
     * Create a new Signal that only fires when a condition is met
     * @param {Function} predicate - Function that returns true if the signal should fire
     * @returns {Signal} Filtered signal
     */
    Filter(predicate) {
        const filtered = new Signal();
        this.Connect((...args) => {
            if (predicate(...args)) {
                filtered.Fire(...args);
            }
        });
        return filtered;
    }

    /**
     * Create a new Signal that transforms the arguments before firing
     * @param {Function} transformer - Function that transforms the arguments
     * @returns {Signal} Mapped signal
     */
    Map(transformer) {
        const mapped = new Signal();
        this.Connect((...args) => {
            const result = transformer(...args);
            if (Array.isArray(result)) {
                mapped.Fire(...result);
            } else {
                mapped.Fire(result);
            }
        });
        return mapped;
    }

    /**
     * Wait for the next signal fire
     * @param {number} [timeout] - Optional timeout in milliseconds
     * @returns {Promise<any[]>} Promise that resolves with the signal arguments
     */
    Wait(timeout) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            const disconnect = this.Connect((...args) => {
                if (timeoutId) clearTimeout(timeoutId);
                disconnect();
                resolve(args);
            });

            if (timeout !== undefined) {
                timeoutId = setTimeout(() => {
                    disconnect();
                    reject(new Error('Signal.Wait() timed out'));
                }, timeout);
            }
        });
    }
}

/**
 * Create a debounced signal that only fires after a delay
 * @param {Signal} signal - Source signal
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Signal} Debounced signal
 */
export function debounceSignal(signal, delay) {
    const debounced = new Signal();
    let timeoutId = null;

    signal.Connect((...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            debounced.Fire(...args);
        }, delay);
    });

    return debounced;
}

/**
 * Create a throttled signal that fires at most once per interval
 * @param {Signal} signal - Source signal
 * @param {number} interval - Throttle interval in milliseconds
 * @returns {Signal} Throttled signal
 */
export function throttleSignal(signal, interval) {
    const throttled = new Signal();
    let lastFire = 0;

    signal.Connect((...args) => {
        const now = Date.now();
        if (now - lastFire >= interval) {
            lastFire = now;
            throttled.Fire(...args);
        }
    });

    return throttled;
}

export default Signal;
