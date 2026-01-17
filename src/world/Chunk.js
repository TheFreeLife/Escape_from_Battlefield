export const CHUNK_SIZE = 16;
export const TILE_SIZE = 64;

export default class Chunk {
    constructor(cx, cy) {
        this.cx = cx; // Chunk X coordinate
        this.cy = cy; // Chunk Y coordinate
        this.tiles = []; // 2D array: [y][x]

        // Initialize with empty/default data
        for (let y = 0; y < CHUNK_SIZE; y++) {
            const row = [];
            for (let x = 0; x < CHUNK_SIZE; x++) {
                row.push(null); // null or default tile ID
            }
            this.tiles.push(row);
        }
    }

    setTile(lx, ly, tileId) {
        if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
            this.tiles[ly][lx] = tileId;
        }
    }

    getTile(lx, ly) {
        if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_SIZE) {
            return this.tiles[ly][lx];
        }
        return null;
    }
}
