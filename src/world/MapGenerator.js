import { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';
import Loot from '../entities/Loot.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';
import APC from '../entities/APC.js';
import TransportShip from '../entities/TransportShip.js';
import TransportPlane from '../entities/TransportPlane.js';

/**
 * Procedural generation has been removed in favor of static, editor-created maps.
 */
export default class MapGenerator {
    constructor(game) {
        this.game = game;
    }

    getBiomeAt(tx, ty) {
        // Always return a default biome (plains) as specific biomes are now tile-based
        const biomes = this.game.assetManager.getData('biomes');
        return biomes ? biomes.find(b => b.id === 'plains') : null;
    }

    /**
     * In the new system, chunks are only generated if map data exists for that location.
     */
    generateChunk(tileMap, cx, cy) {
        // If no active map is loaded, we don't generate anything (or just empty sea)
        if (!this.game.activeMap) {
            this.generateEmptyChunk(tileMap, cx, cy);
            return;
        }

        let chunk = tileMap.getChunk(cx, cy);
        if (!chunk) chunk = tileMap.createChunk(cx, cy);

        // Map layout is a 2D array: [y][x] = [floor, block, unit, item, metadata]
        const map = this.game.activeMap;
        const mapHeight = map.length;
        const mapWidth = map[0].length;

        const startX = cx * CHUNK_SIZE;
        const startY = cy * CHUNK_SIZE;

        let hasData = false;

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const tx = startX + lx;
                const ty = startY + ly;

                // Check if this world coordinate is within the active map bounds
                if (tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
                    const cell = map[ty][tx];
                    if (cell) {
                        this.processCell(tileMap, tx, ty, cell);
                        hasData = true;
                    }
                } else {
                    // Outside of map bounds: Default to impassable void
                    chunk.setTile(lx, ly, 'void', 'floor');
                }
            }
        }
        
        chunk.isGenerated = true;
    }

    generateEmptyChunk(tileMap, cx, cy) {
        let chunk = tileMap.getChunk(cx, cy);
        if (!chunk) chunk = tileMap.createChunk(cx, cy);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                chunk.setTile(lx, ly, 'void', 'floor');
            }
        }
        chunk.isGenerated = true;
    }

    processCell(tileMap, tx, ty, cell) {
        const [floorId, blockId, unitData, itemId, metadata] = cell;
        
        // 1. Floor
        if (floorId) {
            tileMap.setTile(tx, ty, floorId, 'floor', metadata);
        }

        // 2. Block
        if (blockId && blockId !== 'occupied_space') {
            let finalMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;
            
            // Handle loot box item generation from loot table
            if (blockId === 'loot_box' && finalMetadata?.lootTable) {
                const items = new Array(16).fill(null);
                let slotIdx = 0;
                finalMetadata.lootTable.forEach(entry => {
                    if (slotIdx < 16 && Math.random() * 100 < entry.chance) {
                        items[slotIdx] = { id: entry.id, count: 1 };
                        slotIdx++;
                    }
                });
                finalMetadata.items = items;
                delete finalMetadata.lootTable; 
            }
            
            tileMap.setTile(tx, ty, blockId, 'block', finalMetadata);
        }

        // 3. Units (Enemies and Vehicles)
        // Only process units during the first initialization or once
        // Since chunks can be re-generated, we need to ensure units aren't duplicated.
        // We handle this by checking a global flag or specific game state.
        if (this.game.isFirstLoad && unitData && unitData.id) {
            const uid = unitData.id;
            if (uid.startsWith('v_')) {
                const uw = unitData.w || 2;
                const uh = unitData.h || 2;
                const centerX = (tx + uw / 2) * TILE_SIZE;
                const centerY = (ty + uh / 2) * TILE_SIZE;
                
                let v;
                if (uid === 'v_tank') v = new Tank(this.game, centerX, centerY);
                else if (uid === 'v_apc') v = new APC(this.game, centerX, centerY);
                else if (uid === 'v_transport_ship') v = new TransportShip(this.game, centerX, centerY);
                else if (uid === 'v_transport_plane') v = new TransportPlane(this.game, centerX, centerY);
                else v = new Vehicle(this.game, centerX, centerY); 
                
                if (unitData.angle !== undefined) v.angle = unitData.angle;
                this.game.vehicles.push(v);
            } else {
                const ex = (tx + 0.5) * TILE_SIZE;
                const ey = (ty + 0.5) * TILE_SIZE;
                this.game.enemies.push(new Enemy(this.game, ex, ey, uid, unitData));
            }
        }

        // 4. Items (Loots)
        if (this.game.isFirstLoad && itemId) {
            const ix = (tx + 0.5) * TILE_SIZE;
            const iy = (ty + 0.5) * TILE_SIZE;
            const id = (typeof itemId === 'object') ? itemId.id : itemId;
            const count = (typeof itemId === 'object') ? (itemId.count || 1) : 1;
            this.game.loots.push(new Loot(this.game, ix, iy, id, count));
        }
    }

    // Legacy method kept for compatibility, but simplified
    placeStructure(tileMap, prefab, startX, startY) {
        prefab.layout.forEach((row, y) => {
            row.forEach((cell, x) => {
                this.processCell(tileMap, startX + x, startY + y, cell);
            });
        });
    }
}