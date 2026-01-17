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

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.lastTime = 0;
        this.accumulator = 0;
        this.deltaTime = 1 / 60; // Fixed time step

        this.init();
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

        // Handle Global Interaction (T Key)
        if (this.input.isKeyPressed('KeyT')) {
            if (!this.lastTState) {
                this.handleInteraction();
                this.lastTState = true;
            }
        } else {
            this.lastTState = false;
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
