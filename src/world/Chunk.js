export const CHUNK_SIZE = 16;
export const TILE_SIZE = 64;

export default class Chunk {
    constructor(cx, cy) {
        this.cx = cx;
        this.cy = cy;
        // Three layers of tiles
        this.floors = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(null));
        this.blocks = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(null));
        this.metadata = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(null));
        this.isGenerated = false; // Flag to check if generator processed this chunk
    }

    setTile(x, y, tileId, layer = 'floor', metadata = null) {
        if (layer === 'block') {
            this.blocks[y][x] = tileId;
        } else if (layer === 'floor') {
            this.floors[y][x] = tileId;
        }
        
        // Always update metadata, even if it's null, to keep it in sync with the tile
        this.metadata[y][x] = metadata ? JSON.parse(JSON.stringify(metadata)) : null;
    }

    getTile(x, y, layer = 'floor') {
        if (layer === 'block') return this.blocks[y][x];
        if (layer === 'metadata') return this.metadata[y][x];
        return this.floors[y][x];
    }
}
