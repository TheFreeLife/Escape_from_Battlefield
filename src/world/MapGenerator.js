import { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';
import Loot from '../entities/Loot.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';
import APC from '../entities/APC.js';
import TransportShip from '../entities/TransportShip.js';
import TransportPlane from '../entities/TransportPlane.js';
import Noise from '../core/Noise.js';

export default class MapGenerator {
    constructor(game) {
        this.game = game;
        this.noise = new Noise(Math.random());
        this.biomeNoise = new Noise(Math.random());
    }

    getBiomeAt(tx, ty) {
        const biomes = this.game.assetManager.getData('biomes');
        if (!biomes) return null;

        // Test Mode: Always return Plains
        if (this.game.testStructure) {
            return biomes.find(b => b.id === 'plains') || biomes[0];
        }

        const n = this.biomeNoise.perlin2D(tx / 100, ty / 100, 2, 0.5);
        const index = Math.floor(n * biomes.length);
        return biomes[Math.min(index, biomes.length - 1)];
    }

    generateChunk(tileMap, cx, cy) {
        let chunk = tileMap.getChunk(cx, cy);
        if (!chunk) chunk = tileMap.createChunk(cx, cy);
        
        const isTestMode = !!this.game.testStructure;

        // --- 1. Terrain Generation (Fill empty tiles only) ---
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const tx = cx * CHUNK_SIZE + lx;
                const ty = cy * CHUNK_SIZE + ly;

                // Only generate floor if it's empty to avoid overwriting structures
                if (chunk.getTile(lx, ly, 'floor') === null) {
                    const biome = this.getBiomeAt(tx, ty);
                    if (!biome) continue;

                    let tileId;
                    if (isTestMode) {
                        tileId = biome.tiles[0]; // Use first tile as default floor in test mode
                    } else {
                        const tn = this.noise.perlin2D(tx / 10, ty / 10, 2, 0.5);
                        const tileIndex = Math.floor(tn * biome.tiles.length);
                        tileId = biome.tiles[Math.min(tileIndex, biome.tiles.length - 1)];
                    }
                    chunk.setTile(lx, ly, tileId, 'floor');
                }
            }
        }
        
        chunk.isGenerated = true;

        // --- 2. Normal Mode Structure & Entity Placement ---
        if (!isTestMode) {
            const structures = this.game.assetManager.getData('structures');
            if (structures) {
                const distFromOrigin = Math.sqrt(cx * cx + cy * cy);
                if (distFromOrigin >= 1) {
                    const biome = this.getBiomeAt(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
                    if (biome) {
                        const structureAttempts = 3; 
                        let structuresInChunk = 0;
                        for (let i = 0; i < structureAttempts; i++) {
                            if (structuresInChunk >= 1) break; // Limit to 1 major structure per chunk for better spacing
                            
                            if (Math.random() < biome.spawnRate.structures) {
                                const prefabId = biome.structures[Math.floor(Math.random() * biome.structures.length)];
                                const prefab = structures.find(s => s.id === prefabId);

                                if (prefab) {
                                    const pHeight = prefab.layout.length;
                                    const pWidth = prefab.layout[0].length;
                                    const sx = Math.floor(Math.random() * (CHUNK_SIZE - pWidth));
                                    const sy = Math.floor(Math.random() * (CHUNK_SIZE - pHeight));
                                    const startX = cx * CHUNK_SIZE + sx;
                                    const startY = cy * CHUNK_SIZE + sy;

                                    if (this.canPlaceStructure(tileMap, prefab, startX, startY)) {
                                        this.placeStructure(tileMap, prefab, startX, startY);
                                        structuresInChunk++;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Entity Spawning (Vehicles only)
            const spawnBiome = this.getBiomeAt(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
            if (spawnBiome) {
                // Vehicles
                if (Math.random() < 0.05) {
                    const vx = (cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * TILE_SIZE;
                    const vy = (cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * TILE_SIZE;

                    if (!tileMap.isCollidable(vx, vy)) {
                        this.game.vehicles.push(new Vehicle(this.game, vx, vy));
                    }
                }
            }
        }
    }

    canPlaceStructure(tileMap, prefab, startX, startY) {
        const pHeight = prefab.layout.length;
        const pWidth = prefab.layout[0].length;
        const padding = 2; // Tiles of empty space required around the structure
        
        for (let y = -padding; y < pHeight + padding; y++) {
            for (let x = -padding; x < pWidth + padding; x++) {
                // Check if there's already a block at this location
                if (tileMap.getTile(startX + x, startY + y, 'block')) {
                    return false;
                }
            }
        }
        return true;
    }

    placeStructure(tileMap, prefab, startX, startY) {
        prefab.layout.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (Array.isArray(cell)) {
                    const [floorId, blockId, unitData, itemId, metadata] = cell;
                    
                    // Handle Loot Box Initialization or existing metadata (like rotations)
                    let finalMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;
                    
                    if (blockId === 'loot_box' && finalMetadata?.lootTable) {
                        // ... (loot table generation)
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

                    // Apply floor with metadata (for floorRotation)
                    if (floorId !== null && floorId !== undefined) {
                        tileMap.setTile(startX + x, startY + y, floorId, 'floor', finalMetadata);
                    }
                    
                    // Skip 'occupied_space' as TileMap.setTile handles it when the master tile is placed
                    if (blockId !== null && blockId !== undefined && blockId !== 'occupied_space') {
                        tileMap.setTile(startX + x, startY + y, blockId, 'block', finalMetadata);
                    }
                    
                    if (unitData && unitData.id) {
                        const uid = unitData.id;
                        if (uid.startsWith('v_')) {
                            // Calculate center based on unit size (default 2x2 if not specified)
                            const uw = unitData.w || 2;
                            const uh = unitData.h || 2;
                            const centerX = (startX + x + uw / 2) * TILE_SIZE;
                            const centerY = (startY + y + uh / 2) * TILE_SIZE;
                            
                            let v;
                            if (uid === 'v_tank') v = new Tank(this.game, centerX, centerY);
                            else if (uid === 'v_apc') v = new APC(this.game, centerX, centerY);
                            else if (uid === 'v_transport_ship') v = new TransportShip(this.game, centerX, centerY);
                            else if (uid === 'v_transport_plane') v = new TransportPlane(this.game, centerX, centerY);
                            else v = new Vehicle(this.game, centerX, centerY); 
                            
                            // Apply rotation from editor
                            if (unitData.angle !== undefined) {
                                v.angle = unitData.angle;
                            }
                            
                            this.game.vehicles.push(v);
                            console.log(`Spawned ${uid} at center: ${centerX}, ${centerY}`);
                        } else {
                            // Spawn Enemy (1x1 center)
                            const ex = (startX + x) * TILE_SIZE + TILE_SIZE / 2;
                            const ey = (startY + y) * TILE_SIZE + TILE_SIZE / 2;
                            this.game.enemies.push(new Enemy(this.game, ex, ey, uid, unitData));
                        }
                    }

                    if (itemId) {
                        const ix = (startX + x) * TILE_SIZE + TILE_SIZE / 2;
                        const iy = (startY + y) * TILE_SIZE + TILE_SIZE / 2;
                        
                        const id = (typeof itemId === 'object') ? itemId.id : itemId;
                        const count = (typeof itemId === 'object') ? (itemId.count || 1) : 1;
                        
                        this.game.loots.push(new Loot(this.game, ix, iy, id, count));
                    }
                } else if (cell !== null && cell !== undefined) {
                    tileMap.setTile(startX + x, startY + y, cell, 'block');
                }
            });
        });
    }
}