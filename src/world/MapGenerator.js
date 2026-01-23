import Chunk, { TILE_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';
import Loot from '../entities/Loot.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';
import APC from '../entities/APC.js';
import TransportShip from '../entities/TransportShip.js';
import TransportPlane from '../entities/TransportPlane.js';
import Train from '../entities/Train.js';

export default class MapGenerator {
    constructor(game) {
        this.game = game;
    }

    generateChunk(tileMap, cx, cy) {
        const chunk = tileMap.createChunk(cx, cy);
        const map = this.game.activeMap;
        
        const mapW = this.game.mapW || 0;
        const mapH = this.game.mapH || 0;

        for (let ly = 0; ly < 16; ly++) {
            for (let lx = 0; lx < 16; lx++) {
                const tx = cx * 16 + lx;
                const ty = cy * 16 + ly;
                
                // 1. Determine if this tile is within the actual map boundaries
                const isInside = map && tx >= 0 && tx < mapW && ty >= 0 && ty < mapH;

                // 2. Set floor: 'grass' for inside empty areas, 'void' for outside
                if (isInside) {
                    tileMap.setTile(tx, ty, 'grass', 'floor');
                    // Overwrite with actual map data if exists
                    if (map[ty] && map[ty][tx]) {
                        this.processCell(tileMap, tx, ty, map[ty][tx]);
                    }
                } else {
                    tileMap.setTile(tx, ty, 'void', 'floor');
                }
            }
        }
        chunk.isGenerated = true;
    }

    processCell(tileMap, tx, ty, cell) {
        if (!cell) return;
        const [floorId, blockId, , , metadata] = cell;
        
        if (floorId) tileMap.setTile(tx, ty, floorId, 'floor', metadata);

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
        } else if (blockId === 'occupied_space') {
            tileMap.setTile(tx, ty, 'occupied_space', 'block', metadata);
        }
    }

    spawnEntities() {
        const map = this.game.activeMap;
        if (!map) return;

        this.game.vehicles = [];
        this.game.enemies = [];
        this.game.loots = [];

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const cell = map[y][x];
                if (!cell) continue;

                const [, , unitData, itemId] = cell;

                if (unitData && unitData.id && unitData.id !== 'occupied_space') {
                    const uid = unitData.id;
                    const centerX = (x + (unitData.w || 1) / 2) * TILE_SIZE;
                    const centerY = (y + (unitData.h || 1) / 2) * TILE_SIZE;

                    if (uid === 'v_tank') {
                        this.game.vehicles.push(new Tank(this.game, centerX, centerY));
                    } else if (uid === 'v_apc') {
                        this.game.vehicles.push(new APC(this.game, centerX, centerY));
                    } else if (uid === 'v_train') {
                        this.game.vehicles.push(new Train(this.game, centerX, centerY));
                    } else if (uid === 'v_transport_ship') {
                        this.game.vehicles.push(new TransportShip(this.game, centerX, centerY));
                    } else if (uid === 'v_transport_plane') {
                        this.game.vehicles.push(new TransportPlane(this.game, centerX, centerY));
                    } else if (uid.startsWith('v_')) {
                        const v = new Vehicle(this.game, centerX, centerY, uid.replace('v_', ''));
                        if (unitData.angle !== undefined) v.angle = unitData.angle;
                        this.game.vehicles.push(v);
                    } else {
                        this.game.enemies.push(new Enemy(this.game, centerX, centerY, uid, unitData));
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