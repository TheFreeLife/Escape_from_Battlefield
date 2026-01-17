export default class AssetManager {
    constructor() {
        this.cache = new Map();
        this.data = {};
        this.loading = 0;
    }

    // Load JSON data files
    async loadData(files) {
        const promises = files.map(async (file) => {
            const res = await fetch(file.path);
            const json = await res.json();
            this.data[file.name] = json;
        });
        await Promise.all(promises);
    }

    // Generate Bitmaps from SVG definitions found in loaded data
    async generateBitmaps() {
        // Example: Process tiles
        if (this.data.tiles) {
            for (const tile of this.data.tiles) {
                if (tile.svg) {
                    await this.renderSVG(tile.id, tile.svg, tile.color || '#fff');
                }
            }
        }
    }

    // Rasterize SVG string to ImageBitmap or Canvas
    async renderSVG(key, svgContent, color) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Wrap SVG path in full SVG tag
            // Adding specific styling/color if needed
            const finalSVG = `
                <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <style>path { fill: ${color}; stroke: black; stroke-width: 1; }</style>
                    ${svgContent}
                </svg>
            `;
            const blob = new Blob([finalSVG], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);

            img.onload = async () => {
                // Convert to ImageBitmap for performance
                try {
                    const bitmap = await createImageBitmap(img);
                    this.cache.set(key, bitmap);
                    URL.revokeObjectURL(url);
                    resolve(bitmap);
                } catch (e) {
                    console.error("Bitmap creation failed", e);
                    // Fallback to regular image if needed, or Canvas
                    this.cache.set(key, img);
                    resolve(img);
                }
            };
            img.onerror = (e) => {
                console.error(`Failed to load SVG for ${key}`, e);
                reject(e);
            }
            img.src = url;
        });
    }

    get(key) {
        return this.cache.get(key);
    }

    getData(name) {
        return this.data[name];
    }
}
