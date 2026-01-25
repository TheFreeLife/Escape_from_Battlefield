import Chunk, { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';
import Grenade from '../entities/Grenade.js';

export default class TileMap {
    constructor(game) {
        this.game = game;
        this.chunks = new Map(); // Key: "x,y", Value: Chunk
        this.generator = null; // Set by Game
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

                // Handle Rail Auto-tiling
                if (layer === 'block' && (tileId?.startsWith('rail') || tileId === null)) {
                    this._setSingleTile(x, y, tileId, 'block', metadata);
                    this.updateRail(x, y);
                    this.updateRail(x + 1, y);
                    this.updateRail(x - 1, y);
                    this.updateRail(x, y + 1);
                    this.updateRail(x, y - 1);
                    return;
                }

                if (layer === 'block') {

                    const oldBlock = this.getBlockAt(x, y);

                    

                    if (oldBlock && tileId !== 'occupied_space') {

                        // Use the effective width/height from getBlockAt to clear old area

                        for (let oy = 0; oy < oldBlock.height; oy++) {

                            for (let ox = 0; ox < oldBlock.width; ox++) {

                                this._setSingleTile(oldBlock.anchorX + ox, oldBlock.anchorY + oy, null, 'block');

                            }

                        }

                    }

        

                    const newDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tileId);

                    if (newDef && (newDef.width > 1 || newDef.height > 1)) {

                        // Determine effective size based on rotation in metadata

                        const rot = metadata?.blockRotation || 0;

                        const isRotated = (rot === 90 || rot === 270);

                        const ew = isRotated ? (newDef.height || 1) : (newDef.width || 1);

                        const eh = isRotated ? (newDef.width || 1) : (newDef.height || 1);

        

                        for (let oy = 0; oy < eh; oy++) {

                            for (let ox = 0; ox < ew; ox++) {

                                if (ox === 0 && oy === 0) {

                                    this._setSingleTile(x, y, tileId, 'block', metadata);

                                } else {

                                    this._setSingleTile(x + ox, y + oy, 'occupied_space', 'block', { blockMaster: `${x},${y}` });

                                }

                            }

                        }

                        return;

                    }

                }

         else if (layer === 'floor') {
            // Apply metadata (like rotation) to floor tile
            this._setSingleTile(x, y, tileId, 'floor', metadata);
            return;
        }

        this._setSingleTile(x, y, tileId, layer, metadata);
    }

    updateRail(x, y) {
        const current = this.getTile(x, y, 'block');
        if (!current || (!current.startsWith('rail') && current !== 'rail')) return;

        const isRail = (id) => id === 'rail' || (id && id.startsWith('rail'));

        const n = isRail(this.getTile(x, y - 1, 'block')) ? 1 : 0;
        const s = isRail(this.getTile(x, y + 1, 'block')) ? 2 : 0;
        const w = isRail(this.getTile(x - 1, y, 'block')) ? 4 : 0;
        const e = isRail(this.getTile(x + 1, y, 'block')) ? 8 : 0;

        let newId = 'rail_we'; // Default

        // Priority Logic: Only allow 2-way connections (No T-junctions or Crossings)
        if (n && s) {
            newId = 'rail_ns';
        } else if (w && e) {
            newId = 'rail_we';
        } else if (n && e) {
            newId = 'rail_ne';
        } else if (n && w) {
            newId = 'rail_nw';
        } else if (s && e) {
            newId = 'rail_se';
        } else if (s && w) {
            newId = 'rail_sw';
        } else if (n || s) {
            newId = 'rail_ns';
        } else if (w || e) {
            newId = 'rail_we';
        }

        // Direct update to avoid recursion
        this._setSingleTile(x, y, newId, 'block', this.getMetadata(x, y));
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

        let masterX = tx, masterY = ty;
        let blockId = directBlockId;

        if (directBlockId === 'occupied_space') {
            const metadata = this.getMetadata(tx, ty);
            if (metadata && metadata.blockMaster) {
                const parts = metadata.blockMaster.split(',');
                if (parts.length === 2) {
                    masterX = parseInt(parts[0]);
                    masterY = parseInt(parts[1]);
                    blockId = this.getTile(masterX, masterY, 'block');
                    // Ensure the master block actually exists and is not occupied_space itself
                    if (!blockId || blockId === 'occupied_space') return null;
                } else return null;
            } else {
                // Critical: If we hit occupied_space but don't know the master, 
                // we should at least try to find a nearby master if it's a known multi-tile object pattern.
                // For now, return null as it indicates corrupted map data.
                return null;
            }
        }

        const def = this.game.assetManager.getData('tiles')?.find(t => t.id === blockId);
        if (!def) return null;

        const metadata = this.getMetadata(masterX, masterY);
        const rot = (metadata?.blockRotation || 0);
        const isRotated = (rot === 90 || rot === 270);

        const width = isRotated ? (def.height || 1) : (def.width || 1);
        const height = isRotated ? (def.width || 1) : (def.height || 1);

        return {
            id: blockId,
            def,
            anchorX: masterX,
            anchorY: masterY,
            rotation: rot,
            width, // Effective width
            height, // Effective height
            // Helper to get world center
            getCenterWorld: () => ({
                x: (masterX + width / 2) * TILE_SIZE,
                y: (masterY + height / 2) * TILE_SIZE
            }),
            // Helper to get world bounds
            getBoundsWorld: () => ({
                x1: masterX * TILE_SIZE,
                y1: masterY * TILE_SIZE,
                x2: (masterX + width) * TILE_SIZE,
                y2: (masterY + height) * TILE_SIZE
            }),
            // Helper to get actual physical collision bounds
            getCollisionBoundsWorld: () => {
                let x1 = masterX, y1 = masterY, w = width, h = height;
                if (def.onlyBottomCollision) {
                    y1 = masterY + height - 1;
                    h = 1;
                }
                // Add a tiny buffer (0.1) to avoid floating point misses
                return {
                    x1: x1 * TILE_SIZE - 2,
                    y1: y1 * TILE_SIZE - 2,
                    x2: (x1 + w) * TILE_SIZE + 2,
                    y2: (y1 + h) * TILE_SIZE + 2
                };
            }
        };
    }

    isCollidable(worldX, worldY) {
        const tx = Math.floor(worldX / TILE_SIZE);
        const ty = Math.floor(worldY / TILE_SIZE);

        // 1. Floor Tile Check
        const floorId = this.getTile(tx, ty, 'floor');
        if (floorId) {
            const fDef = this.game.assetManager.getData('tiles')?.find(t => t.id === floorId);
            if (fDef?.collidable) return true;
        }

        // 2. Block Collision Check
        // We check a small area around the point to find any blocks that might overlap it
        // This is much more robust for multi-tile objects and narrow hitboxes
        for (let oy = -2; oy <= 2; oy++) {
            for (let ox = -2; ox <= 2; ox++) {
                const block = this.getBlockAt(tx + ox, ty + oy);
                if (block && block.def && block.def.collidable) {
                    const cb = block.getCollisionBoundsWorld();
                    // Precise coordinate check against the block's physical collision box
                    if (worldX >= cb.x1 && worldX < cb.x2 && worldY >= cb.y1 && worldY < cb.y2) {
                        return true;
                    }
                }
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

        // 1. Check Floor Layer (e.g., 'void' tile)
        const floorId = this.getTile(tx, ty, 'floor');
        const fDef = this.game.assetManager.getData('tiles')?.find(t => t.id === floorId);
        if (fDef && fDef.blocksVision) return true;

        // 2. Check Block Layer
        const block = this.getBlockAt(tx, ty);
        if (block && block.def) {
            // Special Case: onlyBottomCollision blocks (Restored: now checks the bottom-most tile)
            if (block.def.onlyBottomCollision) {
                const collisionY = block.anchorY + block.height - 1;
                if (ty !== collisionY) return false;
            }

            // Special Case: Closed Door always blocks vision
            if (block.id === 'door') return true;
            // Special Case: Open Door never blocks vision
            if (block.id === 'door_open') return false;

            // Check based on data definition
            if (block.def.blocksVision !== undefined) return block.def.blocksVision;
            // Fallback
            return block.def.collidable && block.id !== 'fence';
        }
        return false;
    }

    damageTile(worldX, worldY, amount) {
        let tx = Math.floor(worldX / TILE_SIZE);
        let ty = Math.floor(worldY / TILE_SIZE);
        
        let block = this.getBlockAt(tx, ty);

        // Robustness: If no block found at the exact point, check surrounding pixels (8-way)
        if (!block) {
            const range = 8; // Check within 8 pixels
            const offsets = [[range,0], [-range,0], [0,range], [0,-range], [range,range], [-range,-range], [range,-range], [-range,range]];
            for (const [ox, oy] of offsets) {
                const b = this.getBlockAt(Math.floor((worldX + ox) / TILE_SIZE), Math.floor((worldY + oy) / TILE_SIZE));
                if (b && b.def && b.def.destructible) {
                    block = b;
                    break;
                }
            }
        }

        if (!block || !block.def || !block.def.destructible) return;

        // CRITICAL: Always use the master (anchor) tile coordinates for health data
        const ax = block.anchorX;
        const ay = block.anchorY;

        let metadata = this.getMetadata(ax, ay);
        if (!metadata) {
            metadata = { health: block.def.health || 10 };
        } else if (metadata.health === undefined) {
            metadata.health = block.def.health || 10;
        }
        
        metadata.health -= amount;
        
        if (metadata.health <= 0) {
            const isFuelTank = block.id === 'fuel_tank';
            const center = isFuelTank ? block.getCenterWorld() : null;

            // 1. Remove master and all occupied spaces FIRST to prevent recursion
            const { width, height } = block;
            for (let oy = 0; oy < height; oy++) {
                for (let ox = 0; ox < width; ox++) {
                    this._setSingleTile(ax + ox, ay + oy, null, 'block');
                }
            }

            // 2. Trigger explosion AFTER the tile is removed from the map
            if (isFuelTank && center) {
                const explosion = new Grenade(this.game, center.x, center.y, center.x, center.y, 0);
                explosion.radius = 200;
                explosion.damage = 300;
                explosion.timer = 0; 
                if (typeof explosion.explode === 'function') explosion.explode();
                this.game.grenades.push(explosion);
                console.log("Fuel tank destroyed and exploded safely!");
            }
        } else {
            // Ensure we update the metadata at the master tile
            this._setSingleTile(ax, ay, block.id, 'block', metadata);
        }
    }

    render(ctx, camera, layers = ['floor', 'block']) {
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (camera.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (camera.height / TILE_SIZE) + 1;

        const startCx = Math.floor(startCol / CHUNK_SIZE);
        const endCx = Math.floor(endCol / CHUNK_SIZE);
        const startCy = Math.floor(startRow / CHUNK_SIZE);
        const endCy = Math.floor(endRow / CHUNK_SIZE);

        const visibleChunks = [];
        
        // Map boundary in chunks
        const mapMaxCx = this.game.activeMap ? Math.ceil(this.game.mapW / CHUNK_SIZE) : -1;
        const mapMaxCy = this.game.activeMap ? Math.ceil(this.game.mapH / CHUNK_SIZE) : -1;

        for (let cy = startCy; cy <= endCy; cy++) {
            if (cy < 0 || cy >= mapMaxCy) continue; // Out of vertical map bounds
            for (let cx = startCx; cx <= endCx; cx++) {
                if (cx < 0 || cx >= mapMaxCx) continue; // Out of horizontal map bounds

                let chunk = this.getChunk(cx, cy);
                if ((!chunk || !chunk.isGenerated) && this.generator) {
                    this.generator.generateChunk(this, cx, cy);
                    chunk = this.getChunk(cx, cy);
                }
                if (chunk) visibleChunks.push(chunk);
            }
        }

        // Pass 1: Floor tiles for all visible chunks
        if (layers.includes('floor')) {
            for (const chunk of visibleChunks) {
                this.renderChunkFloors(ctx, chunk, camera);
            }
        }

        // Pass 2: Block tiles for all visible chunks
        if (layers.includes('block')) {
            for (const chunk of visibleChunks) {
                this.renderChunkBlocks(ctx, chunk, camera);
            }
        }
    }

    getVisibleBlocks(camera) {
        const startCol = Math.floor(camera.x / TILE_SIZE);
        const endCol = startCol + (camera.width / TILE_SIZE) + 1;
        const startRow = Math.floor(camera.y / TILE_SIZE);
        const endRow = startRow + (camera.height / TILE_SIZE) + 1;

        const startCx = Math.floor(startCol / CHUNK_SIZE);
        const endCx = Math.floor(endCol / CHUNK_SIZE);
        const startCy = Math.floor(startRow / CHUNK_SIZE);
        const endCy = Math.floor(endRow / CHUNK_SIZE);

        const blocks = [];
        const mapMaxCx = this.game.activeMap ? Math.ceil(this.game.mapW / CHUNK_SIZE) : -1;
        const mapMaxCy = this.game.activeMap ? Math.ceil(this.game.mapH / CHUNK_SIZE) : -1;

        for (let cy = startCy; cy <= endCy; cy++) {
            if (cy < 0 || cy >= mapMaxCy) continue;
            for (let cx = startCx; cx <= endCx; cx++) {
                if (cx < 0 || cx >= mapMaxCx) continue;
                const chunk = this.getChunk(cx, cy);
                if (!chunk) continue;

                for (let y = 0; y < CHUNK_SIZE; y++) {
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        const blockId = chunk.blocks[y][x];
                        if (!blockId || blockId === 'occupied_space') continue;

                        const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                        const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;

                        const block = this.getBlockAt(chunk.cx * CHUNK_SIZE + x, chunk.cy * CHUNK_SIZE + y);
                        if (block) {
                            // Non-collidable blocks (rails, bushes, carpets, etc.) are handled separately to stay under units
                            if (block.def.collidable === false) continue;

                            let sortY = (block.anchorY + block.height) * TILE_SIZE;
                            if (block.def.onlyBottomCollision) {
                                sortY = (block.anchorY + block.height) * TILE_SIZE;
                            }

                            blocks.push({
                                ...block,
                                worldX,
                                worldY,
                                sortY
                            });
                        }
                    }
                }
            }
        }
        return blocks;
    }

    renderChunkFloors(ctx, chunk, camera) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;
                if (worldX + TILE_SIZE > camera.x && worldX < camera.x + camera.width &&
                    worldY + TILE_SIZE > camera.y && worldY < camera.y + camera.height) {
                    const floorId = chunk.floors[y][x];
                    if (floorId && floorId !== 'occupied_space') {
                        const img = this.game.assetManager.get(floorId);
                        const metadata = chunk.metadata[y][x];
                        const rot = (metadata?.floorRotation || 0) * (Math.PI / 180);

                        if (img) {
                            if (rot !== 0) {
                                ctx.save();
                                ctx.translate(Math.floor(worldX - camera.x + TILE_SIZE/2), Math.floor(worldY - camera.y + TILE_SIZE/2));
                                ctx.rotate(rot);
                                ctx.drawImage(img, -TILE_SIZE/2, -TILE_SIZE/2);
                                ctx.restore();
                            } else {
                                ctx.drawImage(img, Math.floor(worldX - camera.x), Math.floor(worldY - camera.y));
                            }
                        }
                    }
                }
            }
        }
    }

    renderBlock(ctx, block, camera) {
        const img = this.game.assetManager.get(block.id);
        const def = block.def;
        
        const baseW = def?.width || 1;
        const baseH = def?.height || 1;
        const rotDeg = block.rotation || 0;
        const rotRad = rotDeg * (Math.PI / 180);
        
        const isRotated = (rotDeg === 90 || rotDeg === 270);
        const ew = isRotated ? baseH : baseW;
        const eh = isRotated ? baseW : baseH;

        const screenX = Math.floor(block.worldX - camera.x);
        const screenY = Math.floor(block.worldY - camera.y);
        
        ctx.save();
        ctx.translate(screenX + (ew * TILE_SIZE)/2, screenY + (eh * TILE_SIZE)/2);
        ctx.rotate(rotRad);
        
        const drawW = baseW * TILE_SIZE;
        const drawH = baseH * TILE_SIZE;
        
        if (img) {
            ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
        } else {
            ctx.fillStyle = def.color || '#555';
            ctx.fillRect(-drawW/2, -drawH/2, drawW, drawH);
        }
        ctx.restore();

        // Render health bar for destructible tiles (Vehicle style)
        if (def && def.destructible) {
            const metadata = this.getMetadata(block.anchorX, block.anchorY);
            const maxHealth = def.health || 10;
            
            // Show bar only if damaged
            if (metadata && metadata.health !== undefined && metadata.health < maxHealth) {
                this.renderTileHealthBar(ctx, screenX + (ew * TILE_SIZE) / 2, screenY - 15, ew * TILE_SIZE, metadata.health, maxHealth);
            }
        }
    }

    renderTileHealthBar(ctx, x, y, width, health, maxHealth) {
        const barW = Math.min(width * 0.9, 100);
        const barH = 10;
        const barX = Math.floor(x - barW / 2);
        const barY = Math.floor(y);

        ctx.save();
        // White border for high visibility
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
        
        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        // Fill
        const healthRatio = Math.max(0, health / maxHealth);
        if (healthRatio > 0.5) ctx.fillStyle = '#2ecc71';
        else if (healthRatio > 0.2) ctx.fillStyle = '#f1c40f';
        else ctx.fillStyle = '#e74c3c';
        
        ctx.fillRect(barX, barY, barW * healthRatio, barH);
        ctx.restore();
    }

    renderPassableBlocks(ctx, camera) {
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
                if (!chunk) continue;
                for (let y = 0; y < CHUNK_SIZE; y++) {
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        const blockId = chunk.blocks[y][x];
                        if (!blockId || blockId === 'occupied_space') continue;

                        const block = this.getBlockAt(chunk.cx * CHUNK_SIZE + x, chunk.cy * CHUNK_SIZE + y);
                        // Render if it's non-collidable (Rails, Decorations, etc.)
                        if (block && block.def.collidable === false) {
                            this.renderBlock(ctx, {
                                ...block,
                                worldX: (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE,
                                worldY: (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE
                            }, camera);
                        }
                    }
                }
            }
        }
    }

    renderChunkBlocks(ctx, chunk, camera) {
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const blockId = chunk.blocks[y][x];
                if (!blockId || blockId === 'occupied_space') continue;

                const worldX = (chunk.cx * CHUNK_SIZE + x) * TILE_SIZE;
                const worldY = (chunk.cy * CHUNK_SIZE + y) * TILE_SIZE;
                
                const block = this.getBlockAt(chunk.cx * CHUNK_SIZE + x, chunk.cy * CHUNK_SIZE + y);
                if (block) {
                    this.renderBlock(ctx, { ...block, worldX, worldY }, camera);
                }
            }
        }
    }

    renderChunk(ctx, chunk, camera) {
        // This method is now split into renderChunkFloors and renderChunkBlocks
        this.renderChunkFloors(ctx, chunk, camera);
        this.renderChunkBlocks(ctx, chunk, camera);
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
