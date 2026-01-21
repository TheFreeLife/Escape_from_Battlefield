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
        // Process all categories that might have SVG visuals
        const categories = ['tiles', 'items', 'enemies'];
        
        for (const category of categories) {
            const list = this.data[category];
            if (list) {
                // Handle both array and object formats if necessary
                const items = Array.isArray(list) ? list : Object.values(list);
                for (const item of items) {
                    if (item && item.id && item.svg) {
                        const w = (item.width || 1) * 64;
                        const h = (item.height || 1) * 64;
                        await this.renderSVG(item.id, item.svg, item.color || '#fff', w, h);
                    }
                }
            }
        }
    }

    // Rasterize SVG string to ImageBitmap or Canvas
    async renderSVG(key, svgContent, color, width = 64, height = 64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // Wrap SVG path in full SVG tag
            const finalSVG = `
                <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                    <g fill="${color}" stroke="black" stroke-width="1">
                        ${svgContent}
                    </g>
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
