import Input from './Input.js';
import AssetManager from './AssetManager.js';
import TileMap from '../world/TileMap.js';
import MapGenerator from '../world/MapGenerator.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Projectile from '../entities/Projectile.js';
import Inventory from '../ui/Inventory.js';
import Loot from '../entities/Loot.js';
import Grenade from '../entities/Grenade.js';
import Vehicle from '../entities/Vehicle.js';

import { allItems } from '../items/index.js';

export default class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new Input();

        this.assetManager = new AssetManager();
        this.camera = { x: 0, y: 0, width: 0, height: 0 };
        this.enemies = [];
        this.projectiles = [];
        this.loots = [];
        this.grenades = [];
        this.vehicles = [];
        this.zoom = 0.8;

        // Minimap Cache (Optimized)
        this.minimapCache = document.createElement('canvas');
        this.minimapCache.width = 200;
        this.minimapCache.height = 200;
        this.lastMinimapUpdatePos = { x: -9999, y: -9999 };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.lastTime = 0;
        this.accumulator = 0;
        this.deltaTime = 1 / 60; // Fixed time step

        this.init();
    }

    /**
     * Unified collision check
     * @param {number} x Target X coordinate
     * @param {number} y Target Y coordinate
     * @param {number} radius Radius of the object checking collision
     * @param {Object} ignore Object to ignore (usually the caller itself)
     * @returns {boolean} True if collision detected
     */
    /**
     * Check only tile map collision
     */
    checkTileCollision(x, y, radius) {
        const buffer = radius * 0.8;
        const points = [
            { x: x - buffer, y: y - buffer },
            { x: x + buffer, y: y - buffer },
            { x: x - buffer, y: y + buffer },
            { x: x + buffer, y: y + buffer }
        ];
        return this.tileMap && points.some(p => this.tileMap.isCollidable(p.x, p.y));
    }

    checkCollision(x, y, radius, ignore = null) {
        // 1. Tile Map Collision (Walls always block)
        if (this.checkTileCollision(x, y, radius)) return true;

        // 2. Entity Collision
        const entities = [
            this.player,
            ...this.enemies,
            ...this.vehicles
        ];

        for (const ent of entities) {
            if (!ent || ent === ignore || !ent.isCollidable) continue;
            
            const dx = x - ent.x;
            const dy = y - ent.y;
            const distSq = dx * dx + dy * dy;
            const minDist = radius + ent.radius;

            if (distSq < minDist * minDist) {
                // Collision Detected!
                
                // Weight Logic: Can we push this object?
                if (ignore && ignore.weight > ent.weight) {
                    const dist = Math.sqrt(distSq) || 0.1;
                    const overlap = minDist - dist;
                    const nx = dx / dist; // Vector from ent to x,y
                    const ny = dy / dist;

                    // Calculate where to push the entity (away from the moving object)
                    const pushX = -nx * overlap;
                    const pushY = -ny * overlap;

                    // Can the entity be pushed there? (Check tile collision for the entity)
                    if (!this.checkTileCollision(ent.x + pushX, ent.y + pushY, ent.radius)) {
                        // Push successful
                        ent.x += pushX;
                        ent.y += pushY;
                        return false; // Don't block the heavier object
                    }
                }
                
                return true; // Blocked if same/lower weight or pushed entity hit a wall
            }
        }

        return false;
    }

    async init() {
        await this.assetManager.loadData([
            { name: 'tiles', path: 'assets/data/tiles.json' },
            { name: 'structures', path: 'assets/data/structures.json' },
            { name: 'biomes', path: 'assets/data/biomes.json' },
            { name: 'enemies', path: 'assets/data/enemies.json' }
        ]);

        // Inject items from JS registry
        this.assetManager.data['items'] = allItems;

        await this.assetManager.generateBitmaps();

        this.tileMap = new TileMap(this);
        const mapGenerator = new MapGenerator(this);
        this.tileMap.setGenerator(mapGenerator);
        this.mapGenerator = mapGenerator;

        this.player = new Player(this, 300, 300); // Start position
        this.inventory = new Inventory(this);

        // Spawn test vehicle
        this.vehicles.push(new Vehicle(this, 500, 500));

        // Generate bitmaps for items
        const items = this.assetManager.getData('items');
        if (items) {
            for (const item of items) {
                if (item.svg) {
                    await this.assetManager.renderSVG(item.id, item.svg, item.color);
                }
            }
        }

        this.isReady = true;
        this.start();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.camera) {
            this.camera.width = this.canvas.width / this.zoom;
            this.camera.height = this.canvas.height / this.zoom;
        }
    }

    start() {
        if (!this.isReady) return; // Wait for init
        requestAnimationFrame((time) => this.loop(time));
    }

    loop(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Prevent huge delta times if tab is inactive
        if (dt > 0.1) {
            requestAnimationFrame((time) => this.loop(time));
            return;
        }

        this.update(dt);
        this.render();
        this.input.reset(); // Reset single-frame inputs

        requestAnimationFrame((time) => this.loop(time));
    }

    update(dt) {
        if (this.inventory && this.inventory.isOpen) {
            this.inventory.update(dt);
            return; // Pause game when inventory is open
        }

        if (this.inventory) this.inventory.update(dt);

        if (this.player) {
            this.player.update(dt);

            // Camera follow player
            this.camera.x = this.player.x - this.camera.width / 2;
            this.camera.y = this.player.y - this.camera.height / 2;
        }

        // Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.markedForDeletion) {
                this.projectiles.splice(i, 1);
            }
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt);
            if (e.isDead) {
                this.enemies.splice(i, 1);
            }
        }

        // Update Loots
        for (let i = this.loots.length - 1; i >= 0; i--) {
            const l = this.loots[i];
            l.update(dt);
            if (l.markedForDeletion) {
                this.loots.splice(i, 1);
            }
        }

        // Update Grenades
        for (let i = this.grenades.length - 1; i >= 0; i--) {
            const g = this.grenades[i];
            g.update(dt);
            if (g.markedForDeletion) {
                this.grenades.splice(i, 1);
            }
        }

        // Update Vehicles
        for (const v of this.vehicles) {
            v.update(dt);
        }

        // Handle Global Interaction (F Key)
        if (this.input.isKeyPressed('KeyF')) {
            if (!this.lastFState) {
                this.handleInteraction();
                this.lastFState = true;
            }
        } else {
            this.lastFState = false;
        }
    }

    handleInteraction() {
        if (this.player.isInVehicle) {
            // Exit logic handled in Vehicle.handleInput/exit
            this.player.currentVehicle.exit();
            return;
        }

        // 1. Search for nearby vehicle to enter
        for (const v of this.vehicles) {
            const dist = Math.sqrt((this.player.x - v.x) ** 2 + (this.player.y - v.y) ** 2);
            if (dist < v.interactionRadius && !v.isOccupied) {
                v.enter();
                return; // Prioritize vehicle entry
            }
        }

        // 2. Search for nearby loot to pick up
        for (let i = this.loots.length - 1; i >= 0; i--) {
            const l = this.loots[i];
            const dx = this.player.x - l.x;
            const dy = this.player.y - l.y;
            const distSq = dx * dx + dy * dy;
            const interactDist = 60;

            if (distSq < interactDist * interactDist) {
                if (this.inventory.addItem({ id: l.itemId, count: l.count })) {
                    l.markedForDeletion = true;
                    console.log(`Picked up ${l.itemId} x${l.count} via T key`);
                    return; // Pick one at a time
                }
            }
        }
    }

    updateMinimapCache() {
        const ctx = this.minimapCache.getContext('2d');
        const size = this.minimapCache.width;
        const scale = 0.05; // Zoom level
        const centerX = size / 2;
        const centerY = size / 2;

        ctx.clearRect(0, 0, size, size);

        // Render terrain tiles to cache
        const range = (size / 2) / scale;
        const startX = Math.floor((this.player.x - range) / 64);
        const endX = Math.ceil((this.player.x + range) / 64);
        const startY = Math.floor((this.player.y - range) / 64);
        const endY = Math.ceil((this.player.y + range) / 64);

        for (let ty = startY; ty <= endY; ty++) {
            for (let tx = startX; tx <= endX; tx++) {
                const biome = this.mapGenerator.getBiomeAt(tx, ty);
                if (biome) {
                    const sx = centerX + (tx * 64 - this.player.x) * scale;
                    const sy = centerY + (ty * 64 - this.player.y) * scale;
                    const ts = 64 * scale;
                    ctx.fillStyle = biome.color;
                    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
                }
            }
        }
    }

    renderMinimap() {
        const size = 180;
        const margin = 20;
        const x = this.canvas.width - size - margin;
        const y = margin;
        const ctx = this.ctx;

        // Update cache if moved significantly
        const dist = Math.sqrt((this.player.x - this.lastMinimapUpdatePos.x)**2 + (this.player.y - this.lastMinimapUpdatePos.y)**2);
        if (dist > 64) {
            this.updateMinimapCache();
            this.lastMinimapUpdatePos = { x: this.player.x, y: this.player.y };
        }

        ctx.save();
        
        // Shadow & Border
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI*2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Clip content to circle
        ctx.clip();

        // Draw cached terrain
        ctx.drawImage(this.minimapCache, x, y, size, size);

        // Draw entities
        const scale = 0.05;
        const cx = x + size/2;
        const cy = y + size/2;

        const drawDot = (ex, ey, color, radius) => {
            const sx = cx + (ex - this.player.x) * scale;
            const sy = cy + (ey - this.player.y) * scale;
            // Only draw if within minimap circle
            const dx = sx - cx;
            const dy = sy - cy;
            if (dx*dx + dy*dy < (size/2)*(size/2)) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(sx, sy, radius, 0, Math.PI*2);
                ctx.fill();
            }
        };

        this.vehicles.forEach(v => drawDot(v.x, v.y, '#f1c40f', 4));
        this.enemies.forEach(e => { if(!e.isDead) drawDot(e.x, e.y, '#e74c3c', 2.5); });
        
        // Player (Self)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }

    render() {
        // Clear screen
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.scale(this.zoom, this.zoom);

        if (this.tileMap) {
            this.tileMap.render(this.ctx, this.camera);
        }

        if (this.player) {
            this.player.render(this.ctx, this.camera);
        }

        // Render Enemies
        for (const e of this.enemies) {
            e.render(this.ctx, this.camera);
        }

        // Render Projectiles
        for (const p of this.projectiles) {
            p.render(this.ctx, this.camera);
        }

        // Render Loots
        for (const l of this.loots) {
            l.render(this.ctx, this.camera);
        }

        // Render Grenades
        for (const g of this.grenades) {
            g.render(this.ctx, this.camera);
        }

        // Render Vehicles
        for (const v of this.vehicles) {
            v.render(this.ctx, this.camera);
        }

        this.ctx.restore();

        // Render UI (Not affected by zoom)
        if (this.inventory) {
            this.inventory.render(this.ctx);
            this.inventory.renderHotbar(this.ctx);
        }

        this.renderMinimap();

        // UI Layout
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillText("Escape from Battlefield", 20, 35);

        if (this.player && this.mapGenerator) {
            const tx = Math.floor(this.player.x / 64);
            const ty = Math.floor(this.player.y / 64);
            const biome = this.mapGenerator.getBiomeAt(tx, ty);

            if (biome) {
                this.ctx.fillStyle = biome.color || '#fff';
                this.ctx.font = 'bold 18px Arial';
                this.ctx.fillText(`현재 바이옴: ${biome.name}`, 20, 65);

                this.ctx.fillStyle = '#aaa';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(`좌표: ${tx}, ${ty}`, 20, 85);
            }
        }
    }
}
