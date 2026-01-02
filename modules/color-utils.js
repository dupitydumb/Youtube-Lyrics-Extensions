/**
 * Color Utilities - Extract dominant colors from images for adaptive theming
 */

export class ColorExtractor {
    /**
     * Extract dominant colors from an image URL
     * @param {string} imageUrl - URL of the image to analyze
     * @param {number} colorCount - Number of colors to extract (default: 3)
     * @returns {Promise<string[]>} Array of RGB color strings
     */
    static async extractDominantColors(imageUrl, colorCount = 3) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';

            img.onload = () => {
                try {
                    const colors = this._analyzeImage(img, colorCount);
                    resolve(colors);
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = imageUrl;
        });
    }

    /**
     * Analyze image and extract dominant colors using Canvas API
     * @private
     */
    static _analyzeImage(img, colorCount) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Use smaller canvas for faster processing
        const scaledSize = 100;
        canvas.width = scaledSize;
        canvas.height = scaledSize;

        // Draw scaled image
        ctx.drawImage(img, 0, 0, scaledSize, scaledSize);

        // Get image data
        const imageData = ctx.getImageData(0, 0, scaledSize, scaledSize);
        const pixels = imageData.data;

        // Extract colors using simple color quantization
        const colorMap = new Map();

        // Sample every 4th pixel for performance
        for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            // Skip transparent or very dark/light pixels
            if (a < 128 || (r + g + b) < 30 || (r + g + b) > 720) {
                continue;
            }

            // Quantize to reduce color space (group similar colors)
            const quantized = this._quantizeColor(r, g, b, 32);
            const key = quantized.join(',');

            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        // Sort by frequency and get top colors
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, colorCount)
            .map(([color]) => {
                const [r, g, b] = color.split(',').map(Number);
                return `rgb(${r}, ${g}, ${b})`;
            });

        return sortedColors.length > 0 ? sortedColors : ['rgb(102, 126, 234)', 'rgb(118, 75, 162)'];
    }

    /**
     * Quantize color to reduce color space
     * @private
     */
    static _quantizeColor(r, g, b, factor = 32) {
        return [
            Math.round(r / factor) * factor,
            Math.round(g / factor) * factor,
            Math.round(b / factor) * factor
        ];
    }

    /**
     * Generate CSS gradient from color array
     * @param {string[]} colors - Array of RGB color strings
     * @param {string} direction - Gradient direction (default: '135deg')
     * @returns {string} CSS gradient string
     */
    static generateGradient(colors, direction = '135deg') {
        if (!colors || colors.length === 0) {
            return 'linear-gradient(135deg, rgba(30, 30, 35, 0.75) 0%, rgba(20, 20, 25, 0.85) 100%)';
        }

        if (colors.length === 1) {
            // Single color - create gradient with darker variant
            const darkerColor = this._darkenColor(colors[0], 0.3);
            return `linear-gradient(${direction}, ${this._addAlpha(colors[0], 0.75)} 0%, ${this._addAlpha(darkerColor, 0.85)} 100%)`;
        }

        // Multiple colors - create smooth gradient
        const step = 100 / (colors.length - 1);
        const gradientStops = colors.map((color, index) => {
            const alpha = index === 0 ? 0.75 : 0.85;
            return `${this._addAlpha(color, alpha)} ${Math.round(index * step)}%`;
        }).join(', ');

        return `linear-gradient(${direction}, ${gradientStops})`;
    }

    /**
     * Generate radial gradient for background overlay
     * @param {string[]} colors - Array of RGB color strings
     * @returns {string} CSS radial gradient string
     */
    static generateRadialGradient(colors) {
        if (!colors || colors.length === 0) {
            return 'radial-gradient(circle at center, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.6) 100%)';
        }

        const baseColor = colors[0];
        return `radial-gradient(circle at center, ${this._addAlpha(baseColor, 0.1)} 0%, rgba(0, 0, 0, 0.6) 100%)`;
    }

    /**
     * Add alpha channel to RGB color
     * @private
     */
    static _addAlpha(rgbString, alpha) {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return rgbString;

        const [, r, g, b] = match;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Darken a color by a factor
     * @private
     */
    static _darkenColor(rgbString, factor = 0.3) {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return rgbString;

        const [, r, g, b] = match.map(Number);
        return `rgb(${Math.round(r * (1 - factor))}, ${Math.round(g * (1 - factor))}, ${Math.round(b * (1 - factor))})`;
    }

    /**
     * Check if a color is light or dark
     * @param {string} rgbString - RGB color string
     * @returns {boolean} True if light, false if dark
     */
    static isLightColor(rgbString) {
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return false;

        const [, r, g, b] = match.map(Number);
        // Calculate relative luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5;
    }
}
