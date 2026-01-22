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
import TransportShip from '../entities/TransportShip.js';
import TransportPlane from '../entities/TransportPlane.js';

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

        // Day/Night Cycle
        this.gameTime = 12 * 60; // Start at Noon (minutes)
        this.dayLength = 24 * 60; // 24 hours in minutes
        this.timeScale = 1.0; // 1 real second = 1 game minute
        this.ambientLight = 1.0; // 0.0 (Night) to 1.0 (Day)

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
        this.tileMap.chunks.clear(); 
        
        // Find a safe land spot near origin
        let sx = 300, sy = 300;
        if (this.mapGenerator) {
            let foundLand = false;
            // Larger spiral search for a solid land biome
            for (let r = 0; r < 5000; r += 64) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                    const worldX = 300 + Math.cos(a) * r;
                    const worldY = 300 + Math.sin(a) * r;
                    const tx = Math.floor(worldX / 64);
                    const ty = Math.floor(worldY / 64);
                    
                    const biome = this.mapGenerator.getBiomeAt(tx, ty);
                    // Check if this biome is NOT Sea and has solid ground
                    if (biome && biome.id !== 'sea') {
                        sx = worldX;
                        sy = worldY;
                        foundLand = true;
                        break;
                    }
                }
                if (foundLand) break;
            }
        }

        this.player.x = sx;
        this.player.y = sy;
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
    checkTileCollision(x, y, radius, moveType = 'land') {
        const buffer = radius * 0.8;
        // For floor/terrain checks, use a much smaller buffer for sea units to prevent getting stuck on shores
        const floorBuffer = (moveType === 'sea') ? radius * 0.2 : buffer;
        
        const points = [
            { x: x - buffer, y: y - buffer },
            { x: x + buffer, y: y - buffer },
            { x: x - buffer, y: y + buffer },
            { x: x + buffer, y: y + buffer }
        ];

        const floorPoints = (moveType === 'sea') ? [
            { x: x - floorBuffer, y: y - floorBuffer },
            { x: x + floorBuffer, y: y - floorBuffer },
            { x: x - floorBuffer, y: y + floorBuffer },
            { x: x + floorBuffer, y: y + floorBuffer },
            { x: x, y: y } // Always check center for sea units
        ] : points;

        if (!this.tileMap) return false;

        // Air Units: Fly over everything (Blocks and Floor)
        if (moveType === 'air') return false;

        // 1. Block Collision (Walls, objects etc.) - Always use full buffer
        const hasBlockCollision = points.some(p => {
            const tx = Math.floor(p.x / 64);
            const ty = Math.floor(p.y / 64);
            const block = this.tileMap.getBlockAt(tx, ty);
            return block && block.def && block.def.collidable;
        });
        if (hasBlockCollision) return true;

        // 2. Floor Collision (Terrain types) - Use floorBuffer
        return floorPoints.some(p => {
            const tx = Math.floor(p.x / 64);
            const ty = Math.floor(p.y / 64);
            const floorId = this.tileMap.getTile(tx, ty, 'floor');

            // Air Units: Fly over everything
            if (moveType === 'air') return false;

            if (moveType === 'land') {
                // If it's water, check if the radius is small (likely player) 
                // to allow swimming, while blocking large vehicles.
                if (floorId === 'water') {
                    if (radius <= 32) return false; // Allow player (32px radius)
                    return true; // Block vehicles (>32px radius)
                }
            } else if (moveType === 'sea') {
                if (floorId !== 'water' && floorId !== null) return true;
            }
            return false;
        });
    }

    checkCollision(x, y, radius, ignore = null, moveType = 'land') {
        // 1. Tile Map Collision (Based on moveType)
        if (this.checkTileCollision(x, y, radius, moveType)) return true;

        // 2. Entity Collision
        // Air units usually don't collide with ground entities
        if (moveType === 'air') return false;

        const entities = [
            this.player,
            ...this.enemies,
            ...this.vehicles
        ];

        for (const ent of entities) {
            if (!ent || ent === ignore || !ent.isCollidable) continue;
            
            // For sea/land separation, maybe vehicles of different moveTypes don't collide?
            // Usually, they should still collide if they hit each other (e.g. ship hitting a bridge/dock)
            // But for simplicity, we'll keep standard circular collision.

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
                    // Use entity's own moveType if available, fallback to 'land'
                    const entMoveType = ent.moveType || 'land';
                    if (!this.checkTileCollision(ent.x + pushX, ent.y + pushY, ent.radius, entMoveType)) {
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
        this.vehicles.push(new TransportShip(this, 1100, 300));
        this.vehicles.push(new TransportPlane(this, 1300, 500));

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

        // --- Day/Night Cycle Progression ---
        this.gameTime = (this.gameTime + dt * this.timeScale) % this.dayLength;
        this.updateDaylight();

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
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            v.update(dt);
            if (v.markedForDeletion) {
                this.vehicles.splice(i, 1);
            }
        }
    }

    handleInteraction() {
        // 1. If any UI window is open (Inventory, Crafting, Storage), close it
        if (this.inventory && this.inventory.isOpen) {
            this.inventory.toggle(); // This will handle closing everything safely
            return;
        }

        if (this.player.isInVehicle) {
            this.player.currentVehicle.exit();
            return;
        }

        const candidates = [];
        const p = this.player;
        const pAngle = p.facingAngle;

        // 2. Collect candidates: Loot Boxes, Doors, and Multi-tile blocks
        const px = Math.floor(p.x / 64);
        const py = Math.floor(p.y / 64);
        for (let y = py - 1; y <= py + 1; y++) {
            for (let x = px - 1; x <= px + 1; x++) {
                const block = this.tileMap.getBlockAt(x, y);
                if (block && block.def && (block.id === 'loot_box' || block.id === 'door' || block.id === 'door_open' || block.id === 'gun_workbench')) {
                    const center = block.getCenterWorld();
                    const dx = center.x - p.x;
                    const dy = center.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 100) {
                        const targetAngle = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                        candidates.push({ 
                            type: 'tile', 
                            x: block.anchorX, 
                            y: block.anchorY, 
                            id: block.id, 
                            dist, 
                            angleDiff 
                        });
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
            if (best.id === 'gun_workbench') {
                this.inventory.openCrafting();
            } else if (best.id === 'loot_box') {
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
            const lootItem = best.entity;
            const itemId = (typeof lootItem.itemId === 'object') ? lootItem.itemId.id : lootItem.itemId;
            const count = (typeof lootItem.itemId === 'object') ? (lootItem.itemId.count || 1) : (lootItem.count || 1);
            
            if (this.inventory.addItem({ id: itemId, count: count })) {
                lootItem.markedForDeletion = true;
            }
        }
    }

    getAngleDiff(a, b) {
        let diff = b - a;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return diff;
    }

    updateDaylight() {
        const hour = this.gameTime / 60;
        if (hour >= 6 && hour < 10) {
            this.ambientLight = 0.2 + (hour - 6) / 4 * 0.8;
        } else if (hour >= 10 && hour < 18) {
            this.ambientLight = 1.0;
        } else if (hour >= 18 && hour < 22) {
            this.ambientLight = 1.0 - (hour - 18) / 4 * 0.8;
        } else {
            this.ambientLight = 0.2;
        }
    }

    isVisibleToPlayer(targetX, targetY) {
        if (!this.player) return true;
        
        const dx = targetX - this.player.x;
        const dy = targetY - this.player.y;
        const distSq = dx * dx + dy * dy;

        // 1. Proximity vision (Always see very close objects)
        if (distSq < 80 * 80) return true;

        // 2. Max vision distance
        if (distSq > 1600 * 1500) return false;

        // 3. 100-degree FOV Angle check
        const targetAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(this.getAngleDiff(this.player.facingAngle, targetAngle));
        
        const fov = this.inventory.isAiming ? Math.PI * 0.17 : Math.PI * 0.28; 
        if (angleDiff >= fov) return false;

        // 4. Wall Check (Raycasting)
        return this.isLineOfSightClear(this.player.x, this.player.y, targetX, targetY);
    }

    isLineOfSightClear(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Step size for raycasting (half a tile size for accuracy)
        const step = 20; 
        const steps = dist / step;
        
        for (let i = 1; i < steps; i++) {
            const checkX = x1 + (dx / steps) * i;
            const checkY = y1 + (dy / steps) * i;
            
            if (this.tileMap.blocksVision(checkX, checkY)) {
                return false; // Vision blocked by wall
            }
        }
        return true;
    }

                renderVisionOverlay(ctx) {

                    if (!this.player || this.gameState !== 'PLAYING') return;

            

                    if (!this.visionCanvas) this.visionCanvas = document.createElement('canvas');

                    if (this.visionCanvas.width !== this.canvas.width || this.visionCanvas.height !== this.canvas.height) {

                        this.visionCanvas.width = this.canvas.width;

                        this.visionCanvas.height = this.canvas.height;

                    }

            

                            const vCtx = this.visionCanvas.getContext('2d');

            

                            const screenX = (this.player.x - this.camera.x) * this.zoom;

            

                            const screenY = (this.player.y - this.camera.y) * this.zoom;

            

                            const pAngle = this.player.facingAngle;

            

                    

            

                            vCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            

                            // Even lighter fog (0.15 opacity)

            

                            vCtx.fillStyle = 'rgba(0, 2, 8, 0.15)'; 

            

                            vCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            

                    

            

                            vCtx.globalCompositeOperation = 'destination-out';

                    vCtx.fillStyle = 'white';

                    vCtx.shadowBlur = 30 * this.zoom;

                    vCtx.shadowColor = 'white';

            

                    const fov = this.inventory.isAiming ? Math.PI * 0.17 : Math.PI * 0.28;

                    const visionDist = 1500;

                    

                    // --- Stable World-Fixed Raycasting ---

                    const rayStep = 0.015; // Fixed angular step in radians (~0.85 degrees)

                    const startAngle = pAngle - fov;

                    const endAngle = pAngle + fov;

            

                    vCtx.beginPath();

                    vCtx.moveTo(screenX, screenY);

            

                    // Align starting angle to the fixed global grid of angles to prevent rotation jitter

                    const alignedStart = Math.floor(startAngle / rayStep) * rayStep;

            

                                        for (let angle = alignedStart; angle <= endAngle + rayStep; angle += rayStep) {

            

                                            const actualAngle = Math.max(startAngle, Math.min(endAngle, angle));

            

                                            const cos = Math.cos(actualAngle);

            

                                            const sin = Math.sin(actualAngle);

            

                                

            

                                            let finalDist = visionDist;

            

                                            const coarseStep = 50; 

            

                                

            

                                            // 1. Coarse Search

            

                                            for (let d = coarseStep; d < visionDist; d += coarseStep) {

            

                                                if (this.tileMap.blocksVision(this.player.x + cos * d, this.player.y + sin * d)) {

            

                                                    // 2. Binary Search Refinement (Extremely stable)

            

                                                    let low = d - coarseStep;

            

                                                    let high = d;

            

                                                    for (let n = 0; n < 5; n++) { // 5 iterations = ~1.5px precision

            

                                                        let mid = (low + high) / 2;

            

                                                        if (this.tileMap.blocksVision(this.player.x + cos * mid, this.player.y + sin * mid)) high = mid;

            

                                                        else low = mid;

            

                                                    }

            

                                                    finalDist = high;

            

                                                    break;

            

                                                }

            

                                            }

            

                                

            

                                            vCtx.lineTo(screenX + cos * finalDist * this.zoom, screenY + sin * finalDist * this.zoom);

            

                                        }

            

                    

            

                    vCtx.lineTo(screenX, screenY);

                    vCtx.closePath();

                    vCtx.fill();

            

                    vCtx.beginPath();

                    vCtx.arc(screenX, screenY, 80 * this.zoom, 0, Math.PI * 2);

                    vCtx.fill();

            

                    vCtx.shadowBlur = 0;

                    vCtx.globalCompositeOperation = 'source-over';

                    ctx.drawImage(this.visionCanvas, 0, 0);

                }    updateMinimapCache() {
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

        const candidates = [];
        const p = this.player;
        const pAngle = p.facingAngle;

        // 1. Collect Tiles (Loot boxes, Doors, Crafting)
        const px = Math.floor(p.x / 64);
        const py = Math.floor(p.y / 64);
        for (let y = py - 1; y <= py + 1; y++) {
            for (let x = px - 1; x <= px + 1; x++) {
                const block = this.tileMap.getBlockAt(x, y);
                if (block && block.def && (block.def.interactable || block.id === 'gun_workbench')) {
                    const center = block.getCenterWorld();
                    const dx = center.x - p.x;
                    const dy = center.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 100) {
                        const targetAngle = Math.atan2(dy, dx);
                        let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                        candidates.push({ type: 'tile', centerX: center.x, centerY: center.y, id: block.id, name: block.def.name, dist, angleDiff });
                    }
                }
            }
        }

        // 2. Collect Vehicles
        for (const v of this.vehicles) {
            const dx = v.x - p.x;
            const dy = v.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < v.interactionRadius) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                let name = '차량';
                if (v.type === 'tank') name = '전차';
                else if (v.type === 'apc') name = '장갑차';
                else if (v.type === 'transport_ship') name = '운반선';
                else if (v.type === 'transport_plane') name = '수송기';
                
                candidates.push({ type: 'vehicle', entity: v, centerX: v.x, centerY: v.y, name, dist, angleDiff });
            }
        }

        // 3. Collect Loots
        for (const l of this.loots) {
            const dx = l.x - p.x;
            const dy = l.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 80) {
                const targetAngle = Math.atan2(dy, dx);
                let angleDiff = Math.abs(this.getAngleDiff(pAngle, targetAngle));
                const itemDef = this.assetManager.data['items']?.find(it => it.id === l.itemId);
                candidates.push({ type: 'loot', centerX: l.x, centerY: l.y, name: itemDef?.name || '아이템', dist, angleDiff });
            }
        }

        if (candidates.length === 0) return;

        // 4. Select the BEST candidate (closest angle difference)
        candidates.sort((a, b) => a.angleDiff - b.angleDiff);
        const best = candidates[0];

        // 5. Render only the BEST one
        const screenX = best.centerX - this.camera.x;
        const screenY = best.centerY - this.camera.y;

        let label = `[F] ${best.name}`;
        if (best.id === 'door_open') label = "[F] 닫기";
        else if (best.id === 'door') label = "[F] 열기";
        else if (best.type === 'vehicle') {
            const v = best.entity;
            const dx = p.x - v.x;
            const dy = p.y - v.y;
            const localX = dx * Math.cos(-v.angle) - dy * Math.sin(-v.angle);
            
            // Allow entry from the front half of the vehicle (localX > -width/2)
            if (localX > -v.width / 2) {
                label = `[F] ${best.name} 탑승`;
            } else if (v.hasExternalStorage) {
                label = (v.type === 'transport_ship') ? `[F] ${best.name}` : "[F] 적재함";
            } else {
                // If no storage and not in front half, still allow entry but prioritize front
                label = `[F] ${best.name} 탑승`; 
            }
        }

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(label, screenX, screenY - 45);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX - 10, screenY - 30, 20, 20);
        ctx.restore();
    }

    renderDaylightOverlay(ctx) {
        if (this.ambientLight >= 1.0) return;

        // Darkness opacity is inverse of ambient light
        const darkness = 1.0 - this.ambientLight;
        
        ctx.save();
        // Use multiply or overlay-like effect using semi-transparent black/blue
        ctx.fillStyle = `rgba(0, 5, 20, ${darkness * 0.75})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
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

        // Render Tile Overlays (Bushes on top of player)
        if (this.tileMap) {
            this.tileMap.renderOverlays(this.ctx, this.camera);
        }

        // Render Enemies
        for (const e of this.enemies) {
            if (this.isVisibleToPlayer(e.x, e.y)) {
                e.render(this.ctx, this.camera);
            }
        }

        // Render Projectiles
        for (const p of this.projectiles) {
            if (this.isVisibleToPlayer(p.x, p.y)) {
                p.render(this.ctx, this.camera);
            }
        }

        // Render Loots
        for (const l of this.loots) {
            if (this.isVisibleToPlayer(l.x, l.y)) {
                l.render(this.ctx, this.camera);
            }
        }

        // Render Grenades
        for (const g of this.grenades) {
            g.render(this.ctx, this.camera);
        }

        // Render Vehicles
        for (const v of this.vehicles) {
            if (this.isVisibleToPlayer(v.x, v.y)) {
                v.render(this.ctx, this.camera);
            }
        }

        // Render Tile Interaction Hints (e.g. Loot Boxes)
        this.renderTileInteractionHints(this.ctx);

        this.ctx.restore();

        // Render Vision Fog (Over the world, under the UI)
        this.renderVisionOverlay(this.ctx);

        // Render UI (Not affected by zoom)
        if (this.inventory) {
            this.inventory.render(this.ctx);
            this.inventory.renderHotbar(this.ctx);
        }

        this.renderMinimap();
        this.renderDaylightOverlay(this.ctx);
        if (this.debugMenu) this.debugMenu.render(this.ctx);

        // UI Layout
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.fillText("Escape from Battlefield", 20, 35);

        // Time HUD
        const hours = Math.floor(this.gameTime / 60);
        const mins = Math.floor(this.gameTime % 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillText(`🕒 ${timeStr}`, 20, 65);

        if (this.player && this.mapGenerator) {
            const tx = Math.floor(this.player.x / 64);
            const ty = Math.floor(this.player.y / 64);
            const biome = this.mapGenerator.getBiomeAt(tx, ty);

            if (biome) {
                this.ctx.fillStyle = biome.color || '#fff';
                this.ctx.font = 'bold 18px Arial';
                this.ctx.fillText(`📍 ${biome.name}`, 20, 95);

                this.ctx.fillStyle = '#aaa';
                this.ctx.font = '14px Arial';
                this.ctx.fillText(`좌표: ${tx}, ${ty}`, 20, 115);

                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText(`이동 속도: ${Math.round(this.player.currentSpeed || 0)} px/s`, 20, 135);
            }
        }
    }
}
