import { CHUNK_SIZE, TILE_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';
import Loot from '../entities/Loot.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';
import APC from '../entities/APC.js';
import TransportShip from '../entities/TransportShip.js';
import TransportPlane from '../entities/TransportPlane.js';

export default class MapGenerator {
    constructor(game) {
        this.game = game;
    }

    generateChunk(tileMap, cx, cy) {
        if (!this.game.activeMap) return;

        let chunk = tileMap.getChunk(cx, cy);
        if (!chunk) chunk = tileMap.createChunk(cx, cy);

        const map = this.game.activeMap;
        const mapH = map.length;
        const mapW = map[0].length;
        const startX = cx * CHUNK_SIZE;
        const startY = cy * CHUNK_SIZE;

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const tx = startX + lx;
                const ty = startY + ly;

                if (tx >= 0 && tx < mapW && ty >= 0 && ty < mapH) {
                    const cell = map[ty][tx];
                    if (cell) {
                        const [floorId, blockId, , , metadata] = cell;
                        // 1. Floor
                        if (floorId) {
                            tileMap.setTile(tx, ty, floorId, 'floor', metadata);
                        } else {
                            // If floor is missing in data, treat as void block area
                            tileMap.setTile(tx, ty, 'void', 'block');
                        }
                        
                        // 2. Block
                        if (blockId && blockId !== 'occupied_space') {
                            let finalMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;
                            if (blockId === 'loot_box' && finalMetadata?.lootTable) {
                                const items = new Array(16).fill(null);
                                let slotIdx = 0;
                                finalMetadata.lootTable.forEach(entry => {
                                    if (slotIdx < 16 && Math.random() * 100 < entry.chance) {
                                        items[slotIdx++] = { id: entry.id, count: 1 };
                                    }
                                });
                                finalMetadata.items = items;
                                delete finalMetadata.lootTable; 
                            }
                            tileMap.setTile(tx, ty, blockId, 'block', finalMetadata);
                        }
                    } else {
                        // Null cell within bounds -> Void block
                        tileMap.setTile(tx, ty, 'void', 'block');
                    }
                }
                // Chunks outside map bounds are left empty (rendering handles the rest)
            }
        }
        chunk.isGenerated = true;
    }

    spawnEntities() {
        const map = this.game.activeMap;
        if (!map) return;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const cell = map[y][x];
                if (!cell) continue;

                const [, , unitData, itemId] = cell;

                if (unitData && unitData.id && unitData.id !== 'occupied_space') {
                    const uid = unitData.id;
                    const centerX = (x + (unitData.w || 1) / 2) * TILE_SIZE;
                    const centerY = (y + (unitData.h || 1) / 2) * TILE_SIZE;

                    if (uid.startsWith('v_')) {
                        let v;
                        if (uid === 'v_tank') v = new Tank(this.game, centerX, centerY);
                        else if (uid === 'v_apc') v = new APC(this.game, centerX, centerY);
                        else if (uid === 'v_transport_ship') v = new TransportShip(this.game, centerX, centerY);
                        else if (uid === 'v_transport_plane') v = new TransportPlane(this.game, centerX, centerY);
                        else v = new Vehicle(this.game, centerX, centerY, uid.replace('v_', ''));
                        
                        if (unitData.angle !== undefined) v.angle = unitData.angle;
                        this.game.vehicles.push(v);
                    } else {
                        this.game.enemies.push(new Enemy(this.game, (x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, uid, unitData));
                    }
                }

                if (itemId) {
                    const id = (typeof itemId === 'object') ? itemId.id : itemId;
                    const count = (typeof itemId === 'object') ? (itemId.count || 1) : 1;
                    this.game.loots.push(new Loot(this.game, (x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE, id, count));
                }
            }
        }
    }
}
