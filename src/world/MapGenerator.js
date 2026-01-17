import { CHUNK_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';

export default class MapGenerator {
    constructor(game) {
        this.game = game;
    }

    generate(tileMap, width, height) {
        // Simple noise or random generation for now
        // 0: grass, 1: dirt, 2: concrete

        console.log("Generating map...");

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Base terrain
                let tileId = 'grass';
                const noise = Math.random();

                if (noise > 0.7) tileId = 'dirt';
                if (noise > 0.9) tileId = 'concrete';

                tileMap.setTile(x, y, tileId);
            }
        }

        // Place structures (Prefabs)
        const structures = this.game.assetManager.getData('structures');
        if (structures) {
            const structureCount = 20; // Increased attempt count
            const occupancyMap = Array.from({ length: height }, () => new Array(width).fill(false));
            let placedCount = 0;

            for (let i = 0; i < structureCount && placedCount < 15; i++) {
                const prefab = structures[Math.floor(Math.random() * structures.length)];

                const sx = Math.floor(Math.random() * (width - prefab.width - 2)) + 1;
                const sy = Math.floor(Math.random() * (height - prefab.height - 2)) + 1;

                // Player start protection
                const playerX = 4;
                const playerY = 4;
                if (Math.abs(sx - playerX) < 6 && Math.abs(sy - playerY) < 6) continue;

                // Overlap Check (including 1-tile margin for better spacing)
                let canPlace = true;
                for (let py = sy - 1; py < sy + prefab.height + 1; py++) {
                    for (let px = sx - 1; px < sx + prefab.width + 1; px++) {
                        if (px < 0 || px >= width || py < 0 || py >= height || occupancyMap[py][px]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (!canPlace) break;
                }

                if (canPlace) {
                    this.placeStructure(tileMap, prefab, sx, sy);
                    // Mark as occupied
                    for (let py = sy; py < sy + prefab.height; py++) {
                        for (let px = sx; px < sx + prefab.width; px++) {
                            occupancyMap[py][px] = true;
                        }
                    }
                    placedCount++;
                }
            }
        }

        // Spawn Enemies
        const enemyCount = 30;
        for (let i = 0; i < enemyCount; i++) {
            const ex = Math.random() * width * 64;
            const ey = Math.random() * height * 64;

            const dist = Math.sqrt((ex - 300) ** 2 + (ey - 300) ** 2);
            if (dist > 500 && !tileMap.isCollidable(ex, ey)) {
                this.game.enemies.push(new Enemy(this.game, ex, ey));
            } else {
                i--;
            }
        }
    }

    placeStructure(tileMap, prefab, startX, startY) {
        prefab.layout.forEach((row, y) => {
            [...row].forEach((char, x) => {
                const tileId = prefab.legend[char];
                if (tileId) {
                    tileMap.setTile(startX + x, startY + y, tileId);
                }
            });
        });
    }
}
