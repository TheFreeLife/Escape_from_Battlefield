export const CHUNK_SIZE = 16;
export const TILE_SIZE = 64;

export default class Chunk {
    constructor(cx, cy) {
        this.cx = cx;
        this.cy = cy;
        // Two layers of tiles
        this.floors = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(null));
        this.blocks = Array(CHUNK_SIZE).fill().map(() => Array(CHUNK_SIZE).fill(null));
        this.isGenerated = false; // Flag to check if generator processed this chunk
    }

    setTile(x, y, tileId, layer = 'floor') {
        if (layer === 'block') {
            this.blocks[y][x] = tileId;
        } else {
            this.floors[y][x] = tileId;
        }
    }

    getTile(x, y, layer = 'floor') {
        return layer === 'block' ? this.blocks[y][x] : this.floors[y][x];
    }
}
