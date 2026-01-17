import Input from './Input.js';
import AssetManager from './AssetManager.js';
import TileMap from '../world/TileMap.js';
import MapGenerator from '../world/MapGenerator.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Projectile from '../entities/Projectile.js';
import Inventory from '../ui/Inventory.js';

export default class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new Input();

        this.assetManager = new AssetManager();
        this.camera = { x: 0, y: 0, width: 0, height: 0 };
        this.enemies = [];
        this.projectiles = [];
        this.zoom = 0.8; // Default zoom level (1.0 is normal, <1.0 is zoom out)

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
            { name: 'items', path: 'assets/data/items.json' },
            { name: 'structures', path: 'assets/data/structures.json' }
        ]);
        await this.assetManager.generateBitmaps();

        this.tileMap = new TileMap(this);

        // Procedural generation
        const mapGenerator = new MapGenerator(this);
        const mapW = 50;
        const mapH = 50;
        this.tileMap.width = mapW;
        this.tileMap.height = mapH;
        mapGenerator.generate(this.tileMap, mapW, mapH); // Generate 50x50 map

        this.player = new Player(this, 300, 300); // Start position
        this.inventory = new Inventory(this);

        // Generate bitmaps for items as well
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

        this.ctx.restore();

        // Render UI (Not affected by zoom)
        if (this.inventory) {
            this.inventory.render(this.ctx);
            this.inventory.renderHotbar(this.ctx);
        }

        // Placeholder debug text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText("Escape from Battlefield - Core Running", 20, 30);
        if (this.player) {
            this.ctx.fillText(`Pos: ${Math.floor(this.player.x)}, ${Math.floor(this.player.y)}`, 20, 60);
        }
    }
}
