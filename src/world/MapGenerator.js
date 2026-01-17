import { CHUNK_SIZE } from './Chunk.js';
import Enemy from '../entities/Enemy.js';
import Loot from '../entities/Loot.js';
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

        const n = this.biomeNoise.perlin2D(tx / 100, ty / 100, 2, 0.5);
        const index = Math.floor(n * biomes.length);
        return biomes[Math.min(index, biomes.length - 1)];
    }

    generateChunk(tileMap, cx, cy) {
        const chunk = tileMap.createChunk(cx, cy);
        const structures = this.game.assetManager.getData('structures');

        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                const tx = cx * CHUNK_SIZE + lx;
                const ty = cy * CHUNK_SIZE + ly;

                const biome = this.getBiomeAt(tx, ty);
                if (!biome) continue;

                const tn = this.noise.perlin2D(tx / 10, ty / 10, 2, 0.5);
                const tileIndex = Math.floor(tn * biome.tiles.length);
                const tileId = biome.tiles[Math.min(tileIndex, biome.tiles.length - 1)];

                chunk.setTile(lx, ly, tileId);
            }
        }

        // Place structures in chunk
        if (structures) {
            const biome = this.getBiomeAt(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
            if (biome && Math.random() < biome.spawnRate.structures) {
                const prefabId = biome.structures[Math.floor(Math.random() * biome.structures.length)];
                const prefab = structures.find(s => s.id === prefabId);

                if (prefab) {
                    const sx = Math.floor(Math.random() * (CHUNK_SIZE - prefab.width));
                    const sy = Math.floor(Math.random() * (CHUNK_SIZE - prefab.height));
                    this.placeStructure(tileMap, prefab, cx * CHUNK_SIZE + sx, cy * CHUNK_SIZE + sy);
                }
            }
        }

        // Spawn Entities (Enemies & Items)
        const spawnBiome = this.getBiomeAt(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
        if (spawnBiome) {
            // 1. Enemies
            if (spawnBiome.enemies && spawnBiome.enemies.length > 0) {
                const enemyAttempts = 3;
                for (let i = 0; i < enemyAttempts; i++) {
                    if (Math.random() < spawnBiome.spawnRate.enemies) {
                        const ex = (cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * 64;
                        const ey = (cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * 64;

                        const player = this.game.player;
                        let farEnough = true;
                        if (player) {
                            const dist = Math.sqrt((ex - player.x) ** 2 + (ey - player.y) ** 2);
                            if (dist < 600) farEnough = false;
                        }

                        if (farEnough && !tileMap.isCollidable(ex, ey)) {
                            const enemyId = spawnBiome.enemies[Math.floor(Math.random() * spawnBiome.enemies.length)];
                            this.game.enemies.push(new Enemy(this.game, ex, ey, enemyId));
                        }
                    }
                }
            }

            // 2. Items (Ground Loot)
            if (spawnBiome.items && spawnBiome.items.length > 0) {
                const itemAttempts = 2;
                for (let i = 0; i < itemAttempts; i++) {
                    if (Math.random() < spawnBiome.spawnRate.items) {
                        const ix = (cx * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * 64;
                        const iy = (cy * CHUNK_SIZE + Math.random() * CHUNK_SIZE) * 64;

                        if (!tileMap.isCollidable(ix, iy)) {
                            const itemId = spawnBiome.items[Math.floor(Math.random() * spawnBiome.items.length)];
                            this.game.loots.push(new Loot(this.game, ix, iy, itemId));
                        }
                    }
                }
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
