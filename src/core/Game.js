import Input from './Input.js';
import AssetManager from './AssetManager.js';
import TileMap from '../world/TileMap.js';
import MapGenerator from '../world/MapGenerator.js';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Projectile from '../entities/Projectile.js';
import Inventory from '../ui/Inventory.js';
import DebugMenu from '../ui/DebugMenu.js';
import MapEditor from '../ui/MapEditor.js';
import Loot from '../entities/Loot.js';
import Grenade from '../entities/Grenade.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';
import APC from '../entities/APC.js';

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

        this.gameState = 'MENU'; // MENU, PLAYING, EDITOR
        this.testStructure = null; // For editor testing
        this.init();
        this.setupMenu();
    }

    handleBackNavigation() {
        const mainMenu = document.getElementById('main-menu');
        const editorUi = document.getElementById('editor-ui');

        if (this.gameState === 'PLAYING') {
            if (this.testStructure) {
                // Return to Editor from Test Mode
                this.gameState = 'EDITOR';
                this.testStructure = null;
                editorUi.classList.remove('hidden');
            } else {
                // Return to Menu from Game
                this.gameState = 'MENU';
                mainMenu.classList.remove('hidden');
            }
        } else if (this.gameState === 'EDITOR') {
            // Return to Menu from Editor
            this.gameState = 'MENU';
            editorUi.classList.add('hidden');
            mainMenu.classList.remove('hidden');
        }
    }

    startTestMode(layout) {
        this.testStructure = layout;
        this.gameState = 'PLAYING';
        
        // Hide UI
        document.getElementById('editor-ui').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');

        // Reset Game World
        this.resetGame();

        // Place test structure globally once
        if (this.mapGenerator && layout) {
            this.mapGenerator.placeStructure(this.tileMap, { layout: layout }, 10, 10);
        }
    }

    resetGame() {
        this.enemies = [];
        this.projectiles = [];
        this.loots = [];
        this.grenades = [];
        this.vehicles = [];
        this.tileMap.chunks.clear(); // Clear all generated terrain
        
        // Re-initialize player at origin
        this.player.x = 300;
        this.player.y = 300;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.isInVehicle = false;
    }

    setupMenu() {
        const startBtn = document.getElementById('start-btn');
        const editorBtn = document.getElementById('editor-btn');
        const mainMenu = document.getElementById('main-menu');
        const editorUi = document.getElementById('editor-ui');
        
        startBtn.addEventListener('click', () => {
            this.testStructure = null; // Clear test mode data
            this.gameState = 'PLAYING';
            mainMenu.classList.add('hidden');
            this.resetGame(); // Fully reset terrain and entities
        });

        editorBtn.addEventListener('click', () => {
            this.gameState = 'EDITOR';
            mainMenu.classList.add('hidden');
            editorUi.classList.remove('hidden');
            if (!this.mapEditor) this.mapEditor = new MapEditor(this);
        });

        document.getElementById('exit-editor-btn').addEventListener('click', () => {
            this.gameState = 'MENU';
            mainMenu.classList.remove('hidden');
            editorUi.classList.add('hidden');
        });
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
        this.debugMenu = new DebugMenu(this);

        // Spawn test vehicles
        this.vehicles.push(new Vehicle(this, 500, 500));
        this.vehicles.push(new Tank(this, 700, 300));
        this.vehicles.push(new APC(this, 900, 500));

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
        // ESC to go back
        if (this.input.isKeyPressed('Escape')) {
            if (!this.lastEscState) {
                this.handleBackNavigation();
                this.lastEscState = true;
            }
        } else {
            this.lastEscState = false;
        }

        if (this.gameState === 'EDITOR' && this.mapEditor) {
            this.mapEditor.update(dt);
            return;
        }
        if (this.gameState !== 'PLAYING') return;

        // Debug Menu Toggle
        if (this.input.isKeyPressed('F1') || this.input.isKeyPressed('Backquote')) {
            if (!this.lastDebugState) {
                this.debugMenu.toggle();
                this.lastDebugState = true;
            }
        } else {
            this.lastDebugState = false;
        }

        if (this.debugMenu.isVisible) {
            this.debugMenu.update(dt);
            // Optionally pause or continue game based on preference
        }

        // Handle Global Interaction (F Key) - Move this BEFORE the inventory early return
        if (this.input.isKeyPressed('KeyF')) {
            if (!this.lastFState) {
                this.handleInteraction();
                this.lastFState = true;
            }
        } else {
            this.lastFState = false;
        }

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
    }

    handleInteraction() {
        // 1. If any external storage is open, close it
        if (this.inventory && this.inventory.isExternalStorageOpen) {
            this.inventory.closeExternalStorage();
            this.inventory.isOpen = false;
            return;
        }

        if (this.player.isInVehicle) {
            this.player.currentVehicle.exit();
            return;
        }

        const candidates = [];
        const p = this.player;
        const pAngle = p.facingAngle;

        // 2. Collect candidates: Loot Boxes and Doors (Tiles)
        const px = Math.floor(p.x / 64);
        const py = Math.floor(p.y / 64);
        for (let y = py - 1; y <= py + 1; y++) {
            for (let x = px - 1; x <= px + 1; x++) {
                const blockId = this.tileMap.getTile(x, y, 'block');
                if (blockId === 'loot_box' || blockId === 'door' || blockId === 'door_open') {
                    const worldX = x * 64 + 32;
                    const worldY = y * 64 + 32;
                    const dx = worldX - p.x;
                    const dy = worldY - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 100) {
                        const targetAngle = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                        candidates.push({ type: 'tile', x, y, id: blockId, dist, angleDiff });
                    }
                }
            }
        }

        // 3. Collect candidates: Vehicles (Entities)
        for (const v of this.vehicles) {
            const dx = v.x - p.x;
            const dy = v.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < v.interactionRadius) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                candidates.push({ type: 'vehicle', entity: v, dist, angleDiff });
            }
        }

        // 4. Collect candidates: Loot Items (Entities)
        for (let i = this.loots.length - 1; i >= 0; i--) {
            const l = this.loots[i];
            const dx = l.x - p.x;
            const dy = l.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                candidates.push({ type: 'loot', entity: l, index: i, dist, angleDiff });
            }
        }

        if (candidates.length === 0) return;

        // 5. Prioritize by Angle (Smallest angle difference first)
        // If angle difference is within 45 degrees, prioritize the one most centered.
        // Otherwise, distance could be a factor, but here we'll stick to direction.
        candidates.sort((a, b) => a.angleDiff - b.angleDiff);

        const best = candidates[0];

        // 6. Execute Interaction
        if (best.type === 'tile') {
            if (best.id === 'loot_box') {
                let metadata = this.tileMap.getMetadata(best.x, best.y);
                if (!metadata) {
                    metadata = { items: new Array(16).fill(null) };
                    this.tileMap.setTile(best.x, best.y, best.id, 'block', metadata);
                }
                if (!metadata.items || metadata.items.length !== 16) {
                    const oldItems = metadata.items || [];
                    metadata.items = new Array(16).fill(null);
                    oldItems.forEach((item, i) => { if(i < 16) metadata.items[i] = item; });
                }
                this.inventory.openExternalStorage(metadata, 'chest');
            } else if (best.id === 'door' || best.id === 'door_open') {
                const nextId = (best.id === 'door') ? 'door_open' : 'door';
                this.tileMap.setTile(best.x, best.y, nextId, 'block', this.tileMap.getMetadata(best.x, best.y));
            }
        } else if (best.type === 'vehicle') {
            const result = best.entity.handleInteraction(p.x, p.y);
            if (result && best.entity.isStorageOpen) {
                this.inventory.openExternalStorage(best.entity, 'vehicle');
            }
        } else if (best.type === 'loot') {
            if (this.inventory.addItem({ id: best.entity.itemId, count: best.entity.count })) {
                best.entity.markedForDeletion = true;
            }
        }
    }

    getAngleDiff(a, b) {
        let diff = b - a;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return diff;
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

    renderTileInteractionHints(ctx) {
        if (!this.player || this.player.isInVehicle || this.inventory.isOpen) return;

        const range = 1.5; // Interaction range in tiles
        const px = Math.floor(this.player.x / 64);
        const py = Math.floor(this.player.y / 64);

        for (let y = py - 1; y <= py + 1; y++) {
            for (let x = px - 1; x <= px + 1; x++) {
                const blockId = this.tileMap.getTile(x, y, 'block');
                if (blockId === 'loot_box' || blockId === 'door' || blockId === 'door_open') {
                    const worldX = x * 64 + 32;
                    const worldY = y * 64 + 32;
                    const dist = Math.sqrt((this.player.x - worldX) ** 2 + (this.player.y - worldY) ** 2);

                    if (dist < 100) {
                        const screenX = worldX - this.camera.x;
                        const screenY = worldY - this.camera.y;

                        let label = "[F] 열기";
                        if (blockId === 'door_open') label = "[F] 닫기";

                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 16px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(label, screenX, screenY - 45);
                        
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(screenX - 10, screenY - 30, 20, 20);
                        
                        ctx.textAlign = 'left';
                    }
                }
            }
        }
    }

    render() {
        if (this.gameState === 'MENU') {
            // Clear screen for menu background
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        if (this.gameState === 'EDITOR' && this.mapEditor) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.mapEditor.render(this.ctx);
            return;
        }

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

        // Render Tile Interaction Hints (e.g. Loot Boxes)
        this.renderTileInteractionHints(this.ctx);

        this.ctx.restore();

        // Render UI (Not affected by zoom)
        if (this.inventory) {
            this.inventory.render(this.ctx);
            this.inventory.renderHotbar(this.ctx);
        }

        this.renderMinimap();
        if (this.debugMenu) this.debugMenu.render(this.ctx);

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

                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText(`이동 속도: ${Math.round(this.player.currentSpeed || 0)} px/s`, 20, 105);
            }
        }
    }
}
