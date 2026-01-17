import Chunk, { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';

export default class TileMap {
    constructor(game) {
        this.game = game;
        this.chunks = new Map(); // Key: "x,y", Value: Chunk
        this.width = 0; // In tiles
        this.height = 0; // In tiles
    }

    getChunkKey(cx, cy) {
        return `${cx},${cy}`;
    }

    getChunk(cx, cy) {
        return this.chunks.get(this.getChunkKey(cx, cy));
    }

    createChunk(cx, cy) {
        const chunk = new Chunk(cx, cy);
        this.chunks.set(this.getChunkKey(cx, cy), chunk);
        return chunk;
    }

    setTile(x, y, tileId) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE; // Local X
        const ly = y - cy * CHUNK_SIZE; // Local Y

        let chunk = this.getChunk(cx, cy);
        if (!chunk) {
            chunk = this.createChunk(cx, cy);
        }
        chunk.setTile(lx, ly, tileId);
    }

    getTile(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const ly = y - cy * CHUNK_SIZE;

        const chunk = this.getChunk(cx, cy);
        if (chunk) {
            return chunk.getTile(lx, ly);
        }
        return null;
    }

    getTileAtWorldPos(worldX, worldY) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);
        return this.getTile(tx, ty);
    }

    isCollidable(worldX, worldY) {
        const tileId = this.getTileAtWorldPos(worldX, worldY);
        if (!tileId) return false;

        const tileDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tileId);
        return tileDef ? !!tileDef.collidable : false;
    }

    isInteractable(worldX, worldY) {
        const tileId = this.getTileAtWorldPos(worldX, worldY);
        if (!tileId) return false;

        const tileDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tileId);
        return tileDef ? !!tileDef.interactable : false;
    }

    render(ctx, camera) {
        // Calculate visible chunks based on camera
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (camera.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (camera.height / TILE_SIZE) + 1;

        const offsetX = -camera.x + camera.width / 2; // Center camera? No, usually camera.x is top-left or center.
        // Let's assume camera.x/y is the top-left corner of the viewport for now
        // Adjusted: standard 2D camera usually top-left.

        // We need to iterate through visible chunks
        const startCx = Math.floor(startCol / CHUNK_SIZE);
        const endCx = Math.floor(endCol / CHUNK_SIZE);
        const startCy = Math.floor(startRow / CHUNK_SIZE);
        const endCy = Math.floor(endRow / CHUNK_SIZE);

        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                const chunk = this.getChunk(cx, cy);
                if (chunk) {
                    this.renderChunk(ctx, chunk, camera);
                }
            }
        }
    }

    renderChunk(ctx, chunk, camera) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const tileId = chunk.tiles[y][x];
                if (tileId) {
                    const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                    const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;

                    // Frustum culling (simple rect check)
                    if (worldX + TILE_SIZE > camera.x && worldX < camera.x + camera.width &&
                        worldY + TILE_SIZE > camera.y && worldY < camera.y + camera.height) {

                        const img = this.game.assetManager.get(tileId);
                        if (img) {
                            ctx.drawImage(img, Math.floor(worldX - camera.x), Math.floor(worldY - camera.y));
                        }
                    }
                }
            }
        }
    }
}
