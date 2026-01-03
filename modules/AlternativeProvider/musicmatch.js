/**
 * Musixmatch LRC provider
 * Converted from Python to JavaScript
 * Based on https://github.com/Marekkon5/onetagger
 */

class Musixmatch {
    constructor(lang = null, enhanced = false, customFetch = null) {
        this.ROOT_URL = "https://apic-desktop.musixmatch.com/ws/1.1/";
        this.lang = lang;
        this.enhanced = enhanced;
        this.token = null;
        this.tokenRetryCount = 0;
        this.maxTokenRetries = 3;
        // Custom fetch function to bypass CORS via background script
        this.customFetch = customFetch;
    }

    async _get(action, query = []) {
        if (action !== "token.get" && this.token === null) {
            await this._getToken();
        }

        const params = new URLSearchParams();
        // Add query params
        for (const [key, value] of query) {
            params.append(key, value);
        }
        params.append("app_id", "web-desktop-app-v1.0");

        if (this.token !== null) {
            params.append("usertoken", this.token);
        }

        const t = String(Date.now());
        params.append("t", t);

        const url = `${this.ROOT_URL}${action}?${params.toString()}`;

        // Use custom fetch if provided (for CORS bypass via background script)
        if (this.customFetch) {
            return await this.customFetch(url);
        }

        // Fallback to regular fetch (won't work in content script due to CORS)
        const response = await fetch(url);
        return response;
    }

    async _getToken() {
        const tokenKey = "musixmatch_token";
        const expirationKey = "musixmatch_expiration";
        const currentTime = Math.floor(Date.now() / 1000);

        // Check for cached token first
        const cachedToken = localStorage.getItem(tokenKey);
        const expirationTime = parseInt(localStorage.getItem(expirationKey) || "0");

        if (cachedToken && expirationTime && currentTime < expirationTime) {
            this.token = cachedToken;
            console.log('[Musixmatch] Using cached token (expires in ' + Math.round((expirationTime - currentTime) / 60) + ' min)');
            return;
        }

        // Fetch new token
        console.log('[Musixmatch] Fetching new token...');
        const response = await this._get("token.get", [["user_language", "en"]]);
        const data = await response.json();

        if (data.message.header.status_code === 401) {
            console.log('[Musixmatch] Token request got 401 (captcha/rate limit)');
            // Clear cached token on 401
            localStorage.removeItem(tokenKey);
            localStorage.removeItem(expirationKey);
            this.token = null;
            this.tokenRetryCount++;

            if (this.tokenRetryCount >= this.maxTokenRetries) {
                this.tokenRetryCount = 0;
                throw new Error('Musixmatch token fetch failed after max retries');
            }

            // Wait 10 seconds like Python version and retry
            console.log(`[Musixmatch] Waiting 10s before retry (attempt ${this.tokenRetryCount}/${this.maxTokenRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            return this._getToken();
        }

        // Reset retry count on success
        this.tokenRetryCount = 0;

        if (!data.message.body || !data.message.body.user_token) {
            throw new Error('Failed to get Musixmatch token - invalid response');
        }

        const newToken = data.message.body.user_token;
        const newExpirationTime = currentTime + 600; // 10 minutes

        // Cache the token - only save AFTER we confirmed it's valid (status 200)
        this.token = newToken;
        localStorage.setItem(tokenKey, newToken);
        localStorage.setItem(expirationKey, String(newExpirationTime));
        console.log('[Musixmatch] Got new valid token, cached for 10 minutes');
    }

    // Clear token to force refresh
    clearToken() {
        localStorage.removeItem("musixmatch_token");
        localStorage.removeItem("musixmatch_expiration");
        this.token = null;
        console.log('[Musixmatch] Token cleared');
    }

    async getLrcById(trackId, retryOnAuth = true) {
        const response = await this._get("track.subtitle.get", [
            ["track_id", trackId],
            ["subtitle_format", "lrc"]
        ]);

        let translationsList = [];

        if (this.lang !== null) {
            const responseTr = await this._get("crowd.track.translations.get", [
                ["track_id", trackId],
                ["subtitle_format", "lrc"],
                ["translation_fields_set", "minimal"],
                ["selected_language", this.lang]
            ]);

            const dataTr = await responseTr.json();
            const bodyTr = dataTr.message.body;

            if (bodyTr && bodyTr.translations_list && bodyTr.translations_list.length > 0) {
                translationsList = bodyTr.translations_list;
            }
        }

        if (!response.ok) {
            console.log('[Musixmatch] getLrcById response not ok');
            return null;
        }

        const data = await response.json();

        // Handle 401 by clearing token and retrying once
        if (data.message.header.status_code === 401) {
            console.log('[Musixmatch] Got 401 on getLrcById, clearing cached token');
            this.clearToken();

            if (retryOnAuth) {
                console.log('[Musixmatch] Retrying getLrcById with fresh token...');
                return this.getLrcById(trackId, false);
            }
            return null;
        }

        const body = data.message.body;

        if (!body || !body.subtitle || !body.subtitle.subtitle_body) {
            console.log('[Musixmatch] No subtitle found for track');
            return null;
        }

        let lrcStr = body.subtitle.subtitle_body;

        if (this.lang !== null && translationsList.length > 0) {
            for (const item of translationsList) {
                const org = item.translation.subtitle_matched_line;
                const tr = item.translation.description;
                lrcStr = lrcStr.replace(org, `${org}\n(${tr})`);
            }
        }

        return {
            synced: lrcStr
        };
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }

    async getLrcWordByWord(trackId, retryOnAuth = true) {
        try {
            const response = await this._get("track.richsync.get", [["track_id", trackId]]);

            if (response.ok) {
                const data = await response.json();
                console.log('[Musixmatch] getLrcWordByWord response status:', data.message.header.status_code);

                // Handle 401 with retry
                if (data.message.header.status_code === 401) {
                    console.log('[Musixmatch] Got 401 on richsync, clearing cached token');
                    this.clearToken();

                    if (retryOnAuth) {
                        console.log('[Musixmatch] Retrying richsync with fresh token...');
                        return this.getLrcWordByWord(trackId, false);
                    }
                    return { synced: null };
                }

                if (data.message.header.status_code === 200 &&
                    data.message.body &&
                    data.message.body.richsync &&
                    data.message.body.richsync.richsync_body) {
                    const lrcRaw = JSON.parse(data.message.body.richsync.richsync_body);
                    let lrcStr = "";

                    for (const item of lrcRaw) {
                        lrcStr += `[${this.formatTime(item.ts)}] `;

                        for (const l of item.l) {
                            const t = this.formatTime(parseFloat(item.ts) + parseFloat(l.o));
                            lrcStr += `<${t}> ${l.c} `;
                        }

                        lrcStr += "\n";
                    }

                    return {
                        synced: lrcStr
                    };
                }
            }
        } catch (error) {
            console.log('[Musixmatch] Error getting word-by-word lyrics:', error.message);
        }

        return { synced: null };
    }

    getBestMatch(tracks, searchTerm) {
        if (!tracks || tracks.length === 0) return null;

        // Log all results for debugging
        console.log('[Musixmatch] All search results:');
        tracks.forEach((item, idx) => {
            const track = item.track;
            console.log(`  [${idx}] "${track.track_name}" by "${track.artist_name}" (ID: ${track.track_id})`);
        });

        // Simply return the first result (most relevant from API)
        console.log('[Musixmatch] Picking first result as best match');
        return tracks[0];
    }

    async getLrc(searchTerm, retryOnAuth = true) {
        console.log(`[Musixmatch] Searching for: "${searchTerm}"`);

        const response = await this._get("track.search", [
            ["q", searchTerm],
            ["page_size", "5"],
            ["page", "1"]
        ]);

        const data = await response.json();
        console.log('[Musixmatch] Search response status:', data.message.header.status_code);

        const statusCode = data.message.header.status_code;

        // Handle 401 by clearing token and retrying once with fresh token
        if (statusCode === 401) {
            console.log('[Musixmatch] Got 401 on search, clearing cached token');
            this.clearToken();

            if (retryOnAuth) {
                console.log('[Musixmatch] Retrying search with fresh token...');
                return this.getLrc(searchTerm, false); // Retry once with fresh token
            }
            return null;
        }

        if (statusCode !== 200) {
            console.warn(`[Musixmatch] Got status code ${statusCode} for ${searchTerm}`);
            return null;
        }

        const body = data.message.body;

        if (typeof body !== "object" || body === null) {
            return null;
        }

        const tracks = body.track_list;
        console.log(`[Musixmatch] Found ${tracks ? tracks.length : 0} tracks`);

        const track = this.getBestMatch(tracks, searchTerm);

        if (!track) {
            console.log('[Musixmatch] No matching track found');
            return null;
        }

        const trackId = track.track.track_id;
        console.log(`[Musixmatch] Best match: "${track.track.track_name}" by "${track.track.artist_name}" (ID: ${trackId})`);

        if (this.enhanced) {
            const lrc = await this.getLrcWordByWord(trackId);
            if (lrc && lrc.synced) {
                console.log('[Musixmatch] Got enhanced word-by-word lyrics');
                return lrc;
            }
        }

        return this.getLrcById(trackId);
    }
}

export { Musixmatch };