import Chunk, { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';

export default class TileMap {
    constructor(game) {
        this.game = game;
        this.chunks = new Map(); // Key: "x,y", Value: Chunk
        this.generator = null; // Set by Game
        this.width = 0; // In tiles
        this.height = 0; // In tiles
    }

    setGenerator(generator) {
        this.generator = generator;
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

    setTile(x, y, tileId, layer = 'floor', metadata = null) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const ly = y - cy * CHUNK_SIZE;

        let chunk = this.getChunk(cx, cy);
        if (!chunk) {
            chunk = this.createChunk(cx, cy);
        }

        // Handle multi-tile block placement/removal
        if (layer === 'block') {
            const oldBlock = this.getBlockAt(x, y);
            
            // 1. If we are removing or replacing, clear the old multi-tile area first
            // CRITICAL: Don't clear if we are just setting an 'occupied_space' 
            // because that's usually part of the master block we just placed.
            if (oldBlock && tileId !== 'occupied_space') {
                const { w, h } = { w: oldBlock.def?.width || 1, h: oldBlock.def?.height || 1 };
                for (let oy = 0; oy < h; oy++) {
                    for (let ox = 0; ox < w; ox++) {
                        this._setSingleTile(oldBlock.anchorX + ox, oldBlock.anchorY + oy, null, 'block');
                    }
                }
            }

            // 2. If placing a new multi-tile block
            const newDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tileId);
            if (newDef && (newDef.width > 1 || newDef.height > 1)) {
                const w = newDef.width || 1;
                const h = newDef.height || 1;
                for (let oy = 0; oy < h; oy++) {
                    for (let ox = 0; ox < w; ox++) {
                        if (ox === 0 && oy === 0) {
                            this._setSingleTile(x, y, tileId, 'block', metadata);
                        } else {
                            // Correctly store master coordinates in metadata for occupied space
                            this._setSingleTile(x + ox, y + oy, 'occupied_space', 'block', { blockMaster: `${x},${y}` });
                        }
                    }
                }
                return;
            }
        }

        this._setSingleTile(x, y, tileId, layer, metadata);
    }

    _setSingleTile(x, y, tileId, layer, metadata) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const ly = y - cy * CHUNK_SIZE;

        let chunk = this.getChunk(cx, cy);
        if (!chunk) chunk = this.createChunk(cx, cy);
        chunk.setTile(lx, ly, tileId, layer, metadata);
    }

    getMetadata(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const ly = y - cy * CHUNK_SIZE;

        const chunk = this.getChunk(cx, cy);
        if (chunk) {
            return chunk.getTile(lx, ly, 'metadata');
        }
        return null;
    }

    getTile(x, y, layer = 'floor') {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = x - cx * CHUNK_SIZE;
        const ly = y - cy * CHUNK_SIZE;

        const chunk = this.getChunk(cx, cy);
        if (chunk) {
            return chunk.getTile(lx, ly, layer);
        }
        return null;
    }

    getTileAtWorldPos(worldX, worldY, layer = 'floor') {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);
        return this.getTile(tx, ty, layer);
    }

    /**
     * 특정 좌표에 실질적으로 존재하는 블록 정보를 가져옵니다. (완전 일반화)
     */
    getBlockAt(tx, ty) {
        const directBlockId = this.getTile(tx, ty, 'block');
        if (!directBlockId) return null;

        if (directBlockId === 'occupied_space') {
            const metadata = this.getMetadata(tx, ty);
            if (metadata && metadata.blockMaster) {
                const coords = metadata.blockMaster.split(',');
                if (coords.length === 2) {
                    const mx = parseInt(coords[0]);
                    const my = parseInt(coords[1]);
                    const masterId = this.getTile(mx, my, 'block');
                    if (masterId && masterId !== 'occupied_space') {
                        const def = this.game.assetManager.getData('tiles')?.find(t => t.id === masterId);
                        return { id: masterId, def, anchorX: mx, anchorY: my };
                    }
                }
            }
            return null;
        }

        const def = this.game.assetManager.getData('tiles')?.find(t => t.id === directBlockId);
        return { id: directBlockId, def, anchorX: tx, anchorY: ty };
    }

    isCollidable(worldX, worldY) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        // 1. Floor Tile Check
        const floorId = this.getTile(tx, ty, 'floor');
        const fDef = this.game.assetManager.getData('tiles')?.find(t => t.id === floorId);
        if (fDef?.collidable) return true;

        // 2. Block Tile Check (Generalized for any size)
        // We check current tile and its surroundings based on potential max block size
        // For efficiency, we just use getBlockAt which now handles the occupied_space mapping
        const block = this.getBlockAt(tx, ty);
        if (block && block.def && block.def.collidable) {
            // Precise Box Check (Optional, but good for large blocks)
            const bx1 = block.anchorX * TILE_SIZE;
            const by1 = block.anchorY * TILE_SIZE;
            const bx2 = bx1 + (block.def.width || 1) * TILE_SIZE;
            const by2 = by1 + (block.def.height || 1) * TILE_SIZE;

            if (worldX >= bx1 && worldX < bx2 && worldY >= by1 && worldY < by2) {
                return true;
            }
        }

        return false;
    }

    isInteractable(worldX, worldY) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        const block = this.getBlockAt(tx, ty);
        return block?.def?.interactable || false;
    }

    blocksVision(worldX, worldY) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        const block = this.getBlockAt(tx, ty);
        if (block && block.def) {
            // Check based on data definition
            if (block.def.blocksVision !== undefined) return block.def.blocksVision;
            // Fallback: If not defined, blocks with collision usually block vision except fences
            return block.def.collidable && block.id !== 'fence';
        }
        return false;
    }

    damageTile(worldX, worldY, amount) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);
        
        const block = this.getBlockAt(tx, ty);
        if (!block || !block.def.destructible) return;

        let metadata = this.getMetadata(block.anchorX, block.anchorY);
        if (!metadata) {
            metadata = { health: block.def.health || 10 };
        }
        
        metadata.health -= amount;
        
        if (metadata.health <= 0) {
            // Remove master and all occupied spaces
            const { w, h } = { w: block.def.width || 1, h: block.def.height || 1 };
            for (let oy = 0; oy < h; oy++) {
                for (let ox = 0; ox < w; ox++) {
                    this.setTile(block.anchorX + ox, block.anchorY + oy, null, 'block');
                }
            }
        } else {
            this.setTile(block.anchorX, block.anchorY, block.id, 'block', metadata);
        }
    }

    render(ctx, camera) {
        // ... (이전 render 메서드 유지하되 renderChunk 호출)
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (camera.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (camera.height / TILE_SIZE) + 1;

        const startCx = Math.floor(startCol / CHUNK_SIZE);
        const endCx = Math.floor(endCol / CHUNK_SIZE);
        const startCy = Math.floor(startRow / CHUNK_SIZE);
        const endCy = Math.floor(endRow / CHUNK_SIZE);

        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                let chunk = this.getChunk(cx, cy);
                if ((!chunk || !chunk.isGenerated) && this.generator) {
                    this.generator.generateChunk(this, cx, cy);
                    chunk = this.getChunk(cx, cy);
                }
                if (chunk) {
                    this.renderChunk(ctx, chunk, camera);
                }
            }
        }
    }

    renderChunk(ctx, chunk, camera) {
        // 1. Floor Pass
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;
                if (worldX + TILE_SIZE > camera.x && worldX < camera.x + camera.width &&
                    worldY + TILE_SIZE > camera.y && worldY < camera.y + camera.height) {
                    const floorId = chunk.floors[y][x];
                    if (floorId && floorId !== 'occupied_space') {
                        const img = this.game.assetManager.get(floorId);
                        if (img) ctx.drawImage(img, Math.floor(worldX - camera.x), Math.floor(worldY - camera.y));
                    }
                }
            }
        }

        // 2. Block Pass
        const allTiles = this.game.assetManager.getData('tiles');
        
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const blockId = chunk.blocks[y][x];
                if (!blockId || blockId === 'occupied_space') continue;

                const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;
                
                const def = allTiles?.find(t => t.id === blockId);
                const w = (def?.width || 1) * TILE_SIZE;
                const h = (def?.height || 1) * TILE_SIZE;

                if (worldX + w > camera.x && worldX < camera.x + camera.width &&
                    worldY + h > camera.y && worldY < camera.y + camera.height) {
                    
                    const screenX = Math.floor(worldX - camera.x);
                    const screenY = Math.floor(worldY - camera.y);
                    const img = this.game.assetManager.get(blockId);
                    
                    if (img) {
                        ctx.drawImage(img, screenX, screenY, w, h);
                    } else if (def) {
                        ctx.fillStyle = def.color || '#555';
                        ctx.fillRect(screenX, screenY, w, h);
                    }
                }
            }
        }
    }

    renderOverlays(ctx, camera) {
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (camera.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (camera.height / TILE_SIZE) + 1;

        const startCx = Math.floor(startCol / CHUNK_SIZE);
        const endCx = Math.floor(endCol / CHUNK_SIZE);
        const startCy = Math.floor(startRow / CHUNK_SIZE);
        const endCy = Math.floor(endRow / CHUNK_SIZE);

        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                const chunk = this.getChunk(cx, cy);
                if (chunk) {
                    for (let y = 0; y < CHUNK_SIZE; y++) {
                        for (let x = 0; x < CHUNK_SIZE; x++) {
                            const blockId = chunk.blocks[y][x];
                            if (!blockId || blockId === 'occupied_space') continue;

                            const def = this.game.assetManager.getData('tiles')?.find(t => t.id === blockId);
                            if (def && def.isOverlay) {
                                const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                                const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;
                                const screenX = Math.floor(worldX - camera.x);
                                const screenY = Math.floor(worldY - camera.y);
                                const img = this.game.assetManager.get(blockId);
                                if (img) ctx.drawImage(img, screenX, screenY, (def.width || 1) * TILE_SIZE, (def.height || 1) * TILE_SIZE);
                            }
                        }
                    }
                }
            }
        }
    }
}
