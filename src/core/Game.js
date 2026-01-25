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
import MachineGun from '../entities/MachineGun.js';
import Train from '../entities/Train.js';

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
        this.machineGuns = [];
        this.zoom = 0.8;

        this.minimapCache = document.createElement('canvas');
        this.minimapCache.width = 200;
        this.minimapCache.height = 200;
        this.lastMinimapUpdatePos = { x: -9999, y: -9999 };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.lastTime = 0;
        this.deltaTime = 1 / 60;
        this.gameState = 'MENU';
        this.activeMap = null;
        this.activeLogic = { variables: {}, events: [] };
        this.activeLocations = [];
        this.processedEvents = new Set(); // Track one-time events
        
        this.isTestMode = false;
        this.isFirstLoad = false;

        this.gameTime = 12 * 60;
        this.dayLength = 24 * 60;
        this.timeScale = 1.0;
        this.ambientLight = 1.0;

        this.init();
        this.setupMenu();
    }

    async init() {
        await this.assetManager.loadData([
            { name: 'tiles', path: 'assets/data/tiles.json' },
            { name: 'maps', path: 'assets/data/maps.json' },
            { name: 'enemies', path: 'assets/data/enemies.json' }
        ]);

        this.assetManager.data['items'] = allItems;
        await this.assetManager.generateBitmaps();

        this.tileMap = new TileMap(this);
        this.mapGenerator = new MapGenerator(this);
        this.tileMap.setGenerator(this.mapGenerator);

        this.player = new Player(this, 0, 0);
        this.inventory = new Inventory(this);
        this.debugMenu = new DebugMenu(this);

        this.loadSavedMaps();
        this.isReady = true;
        this.start();
    }

    loadSavedMaps() {
        this.defaultMaps = {};
        const mapsData = this.assetManager.getData('maps');
        if (mapsData) {
            mapsData.forEach(map => {
                this.defaultMaps[map.name] = map.layout;
            });
        }

        const saved = localStorage.getItem('efb_custom_maps');
        this.customMaps = saved ? JSON.parse(saved) : {};
    }

    handleBackNavigation() {
        if (this.gameState === 'PLAYING') {
            if (this.isTestMode) {
                // Return to Editor from Test Mode
                this.gameState = 'EDITOR';
                document.getElementById('editor-ui').classList.remove('hidden');
            } else {
                // Return to Menu from Game
                this.gameState = 'MENU';
                document.getElementById('main-menu').classList.remove('hidden');
            }
        } else if (this.gameState === 'EDITOR') {
            this.gameState = 'MENU';
            document.getElementById('main-menu').classList.remove('hidden');
            document.getElementById('editor-ui').classList.add('hidden');
        }
        document.getElementById('map-selection-menu').classList.add('hidden');
    }

    startTestMode(rawData) {
        if (Array.isArray(rawData)) {
            this.activeMap = rawData;
            this.activeLogic = { variables: {}, events: [] };
            this.activeLocations = [];
        } else {
            this.activeMap = rawData.layout;
            this.activeLogic = rawData.logic || { variables: {}, events: [] };
            this.activeLocations = rawData.locations || [];
        }
        
        this.processedEvents.clear();
        this.isTestMode = true;
        this.gameState = 'PLAYING';
        document.getElementById('editor-ui').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');
        this.resetGame();
    }

    startGame(mapName, isDefault = false) {
        const rawData = isDefault ? this.defaultMaps[mapName] : this.customMaps[mapName];
        if (!rawData) return;

        // Support both old (just array) and new (object with layout/logic) formats
        if (Array.isArray(rawData)) {
            this.activeMap = rawData;
            this.activeLogic = { variables: {}, events: [] };
            this.activeLocations = [];
        } else {
            this.activeMap = rawData.layout;
            this.activeLogic = rawData.logic || { variables: {}, events: [] };
            this.activeLocations = rawData.locations || [];
        }

        this.processedEvents.clear();
        this.isTestMode = false;
        this.gameState = 'PLAYING';
        document.getElementById('map-selection-menu').classList.add('hidden');
        this.resetGame();
    }

    resetGame() {
        this.enemies = []; this.projectiles = []; this.loots = []; this.grenades = []; this.vehicles = []; this.machineGuns = [];
        this.tileMap.chunks.clear(); 
        this.isFirstLoad = true;

        let sx = 0, sy = 0;
        let spawnFound = false;

        if (this.activeMap) {
            // --- NEW: Calculate EFFECTIVE map boundaries and find spawn point ---
            let maxTX = 0;
            let maxTY = 0;

            const tilesDef = this.assetManager.getData('tiles') || [];

            this.activeMap.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (!cell) return;
                    const [floorId, blockId, unitData] = cell;
                    
                    // Check for player spawn point
                    if (blockId === 'player_spawn') {
                        sx = (x + 0.5) * 64;
                        sy = (y + 0.5) * 64;
                        spawnFound = true;
                    }

                    let cellW = 1;
                    let cellH = 1;

                    // Check Block size
                    if (blockId && blockId !== 'occupied_space') {
                        const def = tilesDef.find(t => t.id === blockId);
                        if (def) {
                            const rot = cell[4]?.blockRotation || 0;
                            const isRot = (rot === 90 || rot === 270);
                            cellW = Math.max(cellW, isRot ? (def.height || 1) : (def.width || 1));
                            cellH = Math.max(cellH, isRot ? (def.width || 1) : (def.height || 1));
                        }
                    }

                    // Check Unit size
                    if (unitData && unitData.id && unitData.id !== 'occupied_space') {
                        if (unitData.id.startsWith('v_')) {
                            // Vehicle sizes are usually 2x2 or 3x2/3x3
                            let vw = 2, vh = 2;
                            if (unitData.id === 'v_transport_ship' || unitData.id === 'v_transport_plane') vw = 3;
                            if (unitData.id === 'v_transport_plane') vh = 3;
                            
                            const angle = unitData.angle || 0;
                            const isRot = (Math.abs(Math.sin(angle)) > 0.7); // Near 90 or 270 deg
                            cellW = Math.max(cellW, isRot ? vh : vw);
                            cellH = Math.max(cellH, isRot ? vw : vh);
                        }
                    }

                    maxTX = Math.max(maxTX, x + cellW);
                    maxTY = Math.max(maxTY, y + cellH);
                });
            });

            this.mapW = maxTX;
            this.mapH = maxTY;

            // Only fallback to map center if player_spawn was not found
            if (!spawnFound) {
                sx = (this.mapW / 2) * 64;
                sy = (this.mapH / 2) * 64;
            }
        }

        this.player.x = sx; this.player.y = sy;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.isInVehicle = false;
        this.player.isUsingMountedWeapon = false;

        // Force all chunks to generate BEFORE spawning entities to ensure tiles are ready
        if (this.tileMap) {
            const mapMaxCx = Math.ceil(this.mapW / 16);
            const mapMaxCy = Math.ceil(this.mapH / 16);
            for (let cy = 0; cy < mapMaxCy; cy++) {
                for (let cx = 0; cx < mapMaxCx; cx++) {
                    this.tileMap.getChunk(cx, cy); 
                }
            }
        }

        // Now spawn entities onto the ready tiles
        if (this.mapGenerator) {
            this.mapGenerator.spawnEntities();
        }

        this.isFirstLoad = false;
    }

    setupMenu() {
        document.getElementById('start-btn').addEventListener('click', () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('map-selection-menu').classList.remove('hidden');
            this.renderMapList();
        });

        document.getElementById('map-back-btn').addEventListener('click', () => {
            document.getElementById('map-selection-menu').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        });

        document.getElementById('editor-btn').addEventListener('click', () => {
            this.gameState = 'EDITOR';
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('editor-ui').classList.remove('hidden');
            if (!this.mapEditor) this.mapEditor = new MapEditor(this);
        });

        document.getElementById('exit-editor-btn').addEventListener('click', () => {
            this.gameState = 'MENU';
            document.getElementById('main-menu').classList.remove('hidden');
            document.getElementById('editor-ui').classList.add('hidden');
        });
    }

    renderMapList() {
        const list = document.getElementById('map-list');
        list.innerHTML = '';
        this.loadSavedMaps();

        const addHeader = (text) => {
            const h = document.createElement('div');
            h.innerText = text; h.className = "map-header";
            list.appendChild(h);
        };

        addHeader("--- 기본 제공 맵 ---");
        Object.keys(this.defaultMaps).forEach(name => this.createMapBtn(name, true, list));

        addHeader("--- 사용자 제작 맵 ---");
        Object.keys(this.customMaps).forEach(name => this.createMapBtn(name, false, list));

        const imp = document.createElement('button');
        imp.innerText = "+ 맵 코드 가져오기"; imp.className = 'map-select-btn'; imp.style.backgroundColor = "#3498db";
        imp.onclick = () => {
            const n = prompt("맵 이름:"), c = prompt("맵 코드:");
            if (n && c) {
                try {
                    this.customMaps[n] = JSON.parse(c);
                    localStorage.setItem('efb_custom_maps', JSON.stringify(this.customMaps));
                    this.renderMapList();
                } catch(e) { alert("코드 오류!"); }
            }
        };
        list.appendChild(imp);
    }

    createMapBtn(name, isDefault, container) {
        const btn = document.createElement('button');
        btn.className = 'map-select-btn';
        if (!isDefault) btn.style.backgroundColor = '#2c3e50';
        btn.innerText = name;
        btn.onclick = () => this.startGame(name, isDefault);
        container.appendChild(btn);
    }

    checkTileCollision(x, y, radius, moveType = 'land') {
        if (!this.activeMap) return true;
        const worldW = this.mapW * 64;
        const worldH = this.mapH * 64;

        // 1. Boundary Check
        if (x < 0 || x > worldW || y < 0 || y > worldH) return true;

        // 2. Air units fly over everything
        if (moveType === 'air') return false;
        
        // 3. Collision Points (Check 9 points around the entity radius for better accuracy)
        const b = radius; // Use full radius for edge detection
        const pts = [
            { x, y }, // Center
            { x: x - b, y: y - b }, { x: x + b, y: y - b }, // Corners
            { x: x - b, y: y + b }, { x: x + b, y: y + b },
            { x: x - b, y }, { x: x + b, y }, // Sides
            { x, y: y - b }, { x, y: y + b }
        ];

        for (const p of pts) {
            if (p.x < 0 || p.x >= worldW || p.y < 0 || p.y >= worldH) return true;

            // Use TileMap's centralized collision check
            if (this.tileMap.isCollidable(p.x, p.y)) return true;
        }
        
        return false;
    }

    checkCollision(x, y, radius, ignore = null, moveType = 'land') {
        // Always check tiles first (includes boundary check)
        if (this.checkTileCollision(x, y, radius, moveType)) return true;

        if (moveType === 'air') return false;

        const ents = [this.player, ...this.enemies, ...this.vehicles];
        for (const ent of ents) {
            if (!ent || ent === ignore || !ent.isCollidable) continue;
            
            let isColliding = false;
            
            // Case 1: Rectangle (Player) vs Circle (Checking point)
            if (ent.isRectCollision) {
                const rectX = ent.x - ent.width / 2;
                const rectY = ent.y - ent.height / 2;
                // Find the closest point to the circle within the rectangle
                const closestX = Math.max(rectX, Math.min(x, rectX + ent.width));
                const closestY = Math.max(rectY, Math.min(y, rectY + ent.height));
                const distanceX = x - closestX;
                const distanceY = y - closestY;
                isColliding = (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
            } 
            // Case 2: Circle vs Circle (Standard)
            else {
                const dx = x - ent.x, dy = y - ent.y, dSq = dx*dx + dy*dy, mD = radius + ent.radius;
                isColliding = (dSq < mD * mD);
            }

            if (isColliding) {
                if (ignore && ignore.weight > ent.weight) {
                    const dx = x - ent.x, dy = y - ent.y, dSq = dx*dx + dy*dy;
                    const dist = Math.sqrt(dSq) || 0.1, o = (radius + (ent.radius || 24)) - dist, nx = dx/dist, ny = dy/dist;
                    const entMT = ent.moveType || 'land';
                    if (!this.checkTileCollision(ent.x - nx*o, ent.y - ny*o, ent.radius || 24, entMT)) {
                        ent.x -= nx*o; ent.y -= ny*o; return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    resize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        if (this.camera) { this.camera.width = this.canvas.width / this.zoom; this.camera.height = this.canvas.height / this.zoom; }
    }

    start() { if (this.isReady) requestAnimationFrame((t) => this.loop(t)); }

    loop(t) {
        const dt = Math.min(0.1, (t - this.lastTime) / 1000);
        this.lastTime = t;
        this.update(dt); this.render(); this.input.reset();
        requestAnimationFrame((t) => this.loop(t));
    }

    updateDaylight() {
        const h = this.gameTime / 60;
        if (h >= 6 && h < 10) this.ambientLight = 0.2 + (h - 6) / 4 * 0.8;
        else if (h >= 10 && h < 18) this.ambientLight = 1.0;
        else if (h >= 18 && h < 22) this.ambientLight = 1.0 - (h - 18) / 4 * 0.8;
        else this.ambientLight = 0.2;
    }

    update(dt) {
        if (this.input.isKeyPressed('Escape')) { if (!this.lastEsc) { this.handleBackNavigation(); this.lastEsc = true; } } else this.lastEsc = false;
        if (this.gameState === 'EDITOR') { this.mapEditor?.update(dt); return; }
        if (this.gameState !== 'PLAYING') return;

        if (this.input.isKeyPressed('F1') || this.input.isKeyPressed('Backquote')) { if (!this.lastDbg) { this.debugMenu.toggle(); this.lastDbg = true; } } else this.lastDbg = false;
        if (this.debugMenu.isVisible) this.debugMenu.update(dt);

        if (this.input.isKeyPressed('KeyF')) { if (!this.lastF) { this.handleInteraction(); this.lastF = true; } } else this.lastF = false;

        // Inventory handles its own E key and Digit keys in its update() method
        if (this.inventory) {
            this.inventory.update(dt);
            if (this.inventory.isOpen) return; // Pause gameplay if inventory is open
        }

        this.gameTime = (this.gameTime + dt * this.timeScale) % this.dayLength;
        // updateDaylight removed - keeping ambientLight at 1.0
        this.ambientLight = 1.0;

        if (this.player) {
            this.player.update(dt);
            this.camera.x = this.player.x - this.camera.width / 2;
            this.camera.y = this.player.y - this.camera.height / 2;
            this.processEvents(); // Process map logic
        }

        [this.projectiles, this.enemies, this.loots, this.grenades, this.vehicles, this.machineGuns].forEach(l => {
            for (let i = l.length - 1; i >= 0; i--) { l[i].update(dt); if (l[i].markedForDeletion || l[i].isDead) l.splice(i, 1); }
        });

        if (this.input.isKeyPressed('KeyT') && !this.inventory.isOpen) {
            if (!this.lastT) {
                const idx = this.machineGuns.findIndex(mg => Math.sqrt((mg.x-this.player.x)**2+(mg.y-this.player.y)**2) < 60 && !mg.isOccupied);
                if (idx !== -1) { if (this.inventory.addItem({ id: this.machineGuns[idx].itemData.id, count: 1, ammo: this.machineGuns[idx].itemData.ammo })) this.machineGuns.splice(idx, 1); }
                else { const s = this.inventory.getSelectedItem(); if (s?.id === 'm2hb' && !this.player.isInVehicle) { this.machineGuns.push(new MachineGun(this, this.player.x, this.player.y, this.player.facingAngle, s)); this.inventory.hotbar[this.inventory.selectedSlot] = null; } }
                this.lastT = true;
            }
        } else this.lastT = false;
    }

    handleInteraction() {
        if (this.inventory?.isOpen) { this.inventory.toggle(); return; }
        if (this.player.isUsingMountedWeapon) { this.player.currentMountedWeapon.exit(); return; }
        if (this.player.isInVehicle) { this.player.currentVehicle.exit(); return; }
        const cands = []; const p = this.player, pA = p.facingAngle;
        this.machineGuns.forEach(mg => { const d = Math.sqrt((mg.x-p.x)**2+(mg.y-p.y)**2); if (d < 80) cands.push({ type: 'mg', ent: mg, dist: d, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(mg.y-p.y, mg.x-p.x))) }); });
        const px = Math.floor(p.x/64), py = Math.floor(p.y/64);
        for(let y=py-1; y<=py+1; y++) { for(let x=px-1; x<=px+1; x++) {
            const b = this.tileMap.getBlockAt(x, y); if (b?.def?.interactable || b?.id === 'gun_workbench') { const c = b.getCenterWorld(), d = Math.sqrt((c.x-p.x)**2+(c.y-p.y)**2); if (d < 100) cands.push({ type: 'tile', x: b.anchorX, y: b.anchorY, id: b.id, dist: d, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(c.y-p.y, c.x-p.x))) }); }
        } }
        this.vehicles.forEach(v => { const d = Math.sqrt((v.x-p.x)**2+(v.y-p.y)**2); if (d < v.interactionRadius) cands.push({ type: 'v', ent: v, dist: d, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(v.y-p.y, v.x-p.x))) }); });
        this.loots.forEach(l => { const d = Math.sqrt((l.x-p.x)**2+(l.y-p.y)**2); if (d < 80) cands.push({ type: 'l', ent: l, dist: d, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(l.y-p.y, l.x-p.x))) }); });
        if (cands.length === 0) return;
        cands.sort((a, b) => a.ad - b.ad); const best = cands[0];
        if (best.type === 'mg') best.ent.enter(p);
        else if (best.type === 'tile') {
            if (best.id === 'gun_workbench') this.inventory.openCrafting();
            else if (best.id === 'loot_box') this.inventory.openExternalStorage(this.tileMap.getMetadata(best.x, best.y) || { items: new Array(16).fill(null) }, 'chest');
            else if (best.id.startsWith('door')) this.tileMap.setTile(best.x, best.y, best.id === 'door' ? 'door_open' : 'door', 'block', this.tileMap.getMetadata(best.x, best.y));
        } else if (best.type === 'v') { if (best.ent.handleInteraction(p.x, p.y) === 'STORAGE') this.inventory.openExternalStorage(best.ent, 'vehicle'); }
        else if (best.type === 'l') { if (this.inventory.addItem({ id: best.ent.itemId, count: best.ent.count || 1 })) best.ent.markedForDeletion = true; }
    }

    getAngleDiff(a, b) { let d = b - a; while (d < -Math.PI) d += Math.PI * 2; while (d > Math.PI) d -= Math.PI * 2; return d; }

    isVisibleToPlayer(tx, ty) {
        if (!this.player) return true;
        const dx = tx - this.player.x, dy = ty - this.player.y, dSq = dx*dx + dy*dy;
        if (dSq < 6400) return true; if (dSq > 2400000) return false;
        if (Math.abs(this.getAngleDiff(this.player.facingAngle, Math.atan2(dy, dx))) >= (this.inventory.isAiming ? 0.5 : 0.9)) return false;
        const d = Math.sqrt(dSq), st = 20, sts = d / st;
        for (let i = 1; i < sts; i++) if (this.tileMap.blocksVision(this.player.x + (dx/sts)*i, this.player.y + (dy/sts)*i)) return false;
        return true;
    }

    // --- MAP LOGIC SYSTEM ---
    processEvents() {
        if (!this.activeLogic || !this.activeLogic.events) return;

        this.activeLogic.events.forEach((evt, index) => {
            // Skip already processed non-repeatable events (for now all are one-time)
            if (this.processedEvents.has(index)) return;

            let triggered = false;
            const type = evt.trigger.type;
            const params = evt.trigger.params;

            if (type === 'ON_START') {
                triggered = true;
            } else if (type === 'ON_ENTER_AREA') {
                const loc = this.activeLocations.find(l => l.id === params.locationId);
                if (loc) {
                    const px = this.player.x / 64;
                    const py = this.player.y / 64;
                    if (px >= loc.x && px < loc.x + loc.w && py >= loc.y && py < loc.y + loc.h) {
                        triggered = true;
                    }
                }
            }

            if (triggered) {
                console.log(`Event triggered: ${evt.name}`);
                evt.actions.forEach(action => this.executeAction(action));
                this.processedEvents.add(index); // Mark as done
            }
        });
    }

    executeAction(action) {
        const type = action.type;
        const params = action.params;

        // Boundary Check for spawn actions (Tile based)
        if (type === 'SPAWN_UNIT' || type === 'SPAWN_ITEM') {
            if (params.x < 0 || params.x >= this.mapW || params.y < 0 || params.y >= this.mapH) {
                console.warn(`Action ignored: Spawn tile (${params.x}, ${params.y}) is outside the map bounds.`);
                return;
            }
        }

        if (type === 'SPAWN_UNIT') {
            const worldX = (params.x + 0.5) * 64;
            const worldY = (params.y + 0.5) * 64;
            const newEnemy = new Enemy(this, worldX, worldY, params.unitId, { tag: params.unitTag });
            this.enemies.push(newEnemy);
            console.log(`Action: Spawned ${params.unitId} with tag '${params.unitTag}' at tile ${params.x}, ${params.y}`);
        } else if (type === 'SPAWN_ITEM') {
            const worldX = (params.x + 0.5) * 64;
            const worldY = (params.y + 0.5) * 64;
            this.loots.push(new Loot(this, worldX, worldY, params.itemId, params.count || 1));
            console.log(`Action: Spawned ${params.itemId} (x${params.count}) at tile ${params.x}, ${params.y}`);
        } else if (type === 'MOVE_UNIT') {
            const loc = this.activeLocations.find(l => l.id === params.locationId);
            if (!loc) return;
            const targetX = (loc.x + loc.w / 2) * 64;
            const targetY = (loc.y + loc.h / 2) * 64;

            this.enemies.forEach(enemy => {
                if (enemy.tag === params.tag) {
                    // Update enemy command and target to move to the location
                    enemy.command = 'MOVE';
                    enemy.targetPos = { x: targetX, y: targetY };
                    console.log(`Action: Moving unit with tag '${params.tag}' to ${loc.name}`);
                }
            });
        } else if (type === 'SHOW_MESSAGE') {
            this.showNotification(params.text);
        }
    }

    showNotification(text, duration = 3000) {
        const container = document.getElementById('game-notifications');
        if (!container) return;

        container.innerText = text;
        container.classList.remove('hidden');

        // Clear existing timeout if any
        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);

        this.notificationTimeout = setTimeout(() => {
            container.classList.add('hidden');
        }, duration);
    }

    updateMinimapCache() {
        const c = this.minimapCache.getContext('2d'), sz = 200, sc = 0.05, h = 100, tiles = this.assetManager.getData('tiles');
        c.clearRect(0, 0, sz, sz);
        const r = h/sc, sX = Math.floor((this.player.x-r)/64), eX = Math.ceil((this.player.x+r)/64), sY = Math.floor((this.player.y-r)/64), eY = Math.ceil((this.player.y+r)/64);
        for(let y=sY; y<=eY; y++) { for(let x=sX; x<=eX; x++) {
            const fid = this.tileMap.getTile(x, y, 'floor');
            if (fid) { c.fillStyle = tiles?.find(t => t.id === fid)?.color || '#000'; c.fillRect(h + (x*64 - this.player.x)*sc, h + (y*64 - this.player.y)*sc, 64*sc + 0.5, 64*sc + 0.5); }
        } }
    }

    renderMinimap() {
        const sz = 180, x = this.canvas.width - sz - 20, y = 20, ctx = this.ctx;
        if (Math.sqrt((this.player.x-this.lastMinimapUpdatePos.x)**2 + (this.player.y-this.lastMinimapUpdatePos.y)**2) > 64) {
            this.updateMinimapCache(); this.lastMinimapUpdatePos = { x: this.player.x, y: this.player.y };
        }
        ctx.save(); ctx.beginPath(); ctx.arc(x + sz/2, y + sz/2, sz/2, 0, Math.PI*2);
        ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
        ctx.drawImage(this.minimapCache, x, y, sz, sz);
        const sc = 0.05, cx = x+sz/2, cy = y+sz/2;
        const dot = (ex, ey, col, r) => { const sx = cx+(ex-this.player.x)*sc, sy = cy+(ey-this.player.y)*sc; if((sx-cx)**2+(sy-cy)**2 < (sz/2)**2){ ctx.fillStyle=col; ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill(); } };
        this.vehicles.forEach(v => dot(v.x, v.y, '#f1c40f', 4));
        this.enemies.forEach(e => dot(e.x, e.y, '#e74c3c', 2.5));
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    renderVisionOverlay(ctx) {
        if (!this.player || this.gameState !== 'PLAYING' || !this.activeMap) return;
        if (!this.vC) this.vC = document.createElement('canvas');
        if (this.vC.width !== this.canvas.width || this.vC.height !== this.canvas.height) {
            this.vC.width = this.canvas.width;
            this.vC.height = this.canvas.height;
        }
        const vCtx = this.vC.getContext('2d');
        vCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Fill the ENTIRE screen with deep black fog
        vCtx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // Normal Fog
        vCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Add extra darkness for area OUTSIDE the map
        const mx = -this.camera.x * this.zoom;
        const my = -this.camera.y * this.zoom;
        const mw = this.mapW * 64 * this.zoom;
        const mh = this.mapH * 64 * this.zoom;

        vCtx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Much darker for outside
        // Fill outside regions (top, bottom, left, right)
        vCtx.fillRect(0, 0, this.canvas.width, my); // Top
        vCtx.fillRect(0, my + mh, this.canvas.width, this.canvas.height - (my + mh)); // Bottom
        vCtx.fillRect(0, my, mx, mh); // Left
        vCtx.fillRect(mx + mw, my, this.canvas.width - (mx + mw), mh); // Right

        const sX = (this.player.x - this.camera.x) * this.zoom;
        const sY = (this.player.y - this.camera.y) * this.zoom;

        // 2. Punch a hole through the fog
        vCtx.globalCompositeOperation = 'destination-out'; 
        vCtx.fillStyle = 'black'; 
        vCtx.shadowBlur = 50 * this.zoom; // Softer, more atmospheric edge
        vCtx.shadowColor = 'black';
        
        const fov = this.inventory?.isAiming ? 0.5 : 0.9, st = 0.015, pA = this.player.facingAngle;
        vCtx.beginPath(); vCtx.moveTo(sX, sY);
        for (let a = pA - fov; a <= pA + fov + st; a += st) {
            const act = Math.max(pA - fov, Math.min(pA + fov, a)), cos = Math.cos(act), sin = Math.sin(act);
            let dF = 1500;
            for (let d = 50; d < 1500; d += 50) {
                if (this.tileMap.blocksVision(this.player.x + cos * d, this.player.y + sin * d)) {
                    let lo = d - 50, hi = d;
                    for (let n = 0; n < 5; n++) {
                        let mi = (lo + hi) / 2;
                        if (this.tileMap.blocksVision(this.player.x + cos * mi, this.player.y + sin * mi)) hi = mi; else lo = mi;
                    }
                    dF = hi; break;
                }
            }
            vCtx.lineTo(sX + cos * dF * this.zoom, sY + sin * dF * this.zoom);
        }
        vCtx.lineTo(sX, sY); vCtx.closePath(); vCtx.fill();
        
        // 3. Add a small ambient light circle around the player
        vCtx.beginPath(); vCtx.arc(sX, sY, 100 * this.zoom, 0, Math.PI * 2); vCtx.fill();
        
        vCtx.globalCompositeOperation = 'source-over'; 
        ctx.drawImage(this.vC, 0, 0);
    }

    render() {
        if (this.gameState === 'MENU') { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); return; }
        if (this.gameState === 'EDITOR') { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.mapEditor?.render(this.ctx); return; }
        
        // --- Game Play Rendering ---
        this.ctx.fillStyle = '#000'; // Pure black background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save(); 
        this.ctx.scale(this.zoom, this.zoom);
        
        // 1. Render Floor Tiles
        this.tileMap?.render(this.ctx, this.camera, ['floor']); 
        
        // 2. Render Passable Blocks (Rails, Carpets, etc. - Always below units)
        this.tileMap?.renderPassableBlocks(this.ctx, this.camera);

        // 3. Prepare for Y-Sorting (Remaining Blocks + Entities)
        const renderQueue = [];
        
        // Add visible blocks to queue
        if (this.tileMap) {
            const visibleBlocks = this.tileMap.getVisibleBlocks(this.camera);
            visibleBlocks.forEach(b => {
                renderQueue.push({
                    type: 'block',
                    sortY: b.sortY,
                    data: b
                });
            });
        }

        // Add entities to queue
        const allEntities = [
            this.player, ...this.enemies, ...this.projectiles, ...this.loots, 
            ...this.grenades, ...this.vehicles, ...this.machineGuns
        ];

        allEntities.forEach(ent => {
            if (!ent) return;
            const isAirborne = (ent.moveType === 'air') || (ent.altitude > 0);
            if (!isAirborne && this.isVisibleToPlayer(ent.x, ent.y)) {
                // Determine the visual bottom of the entity for accurate sorting
                let visualBottom = ent.y;
                if (ent.type === 'train' || ent.type === 'vehicle' || ent.type === 'tank' || ent.type === 'apc') {
                    // For vehicles, use half of the actual visual height/width based on angle
                    const halfH = (ent.height || 64) / 2;
                    const halfW = (ent.width || 64) / 2;
                    // Approximate the projection on Y axis
                    const sin = Math.abs(Math.sin(ent.angle || 0));
                    const cos = Math.abs(Math.cos(ent.angle || 0));
                    visualBottom = ent.y + (halfH * cos + halfW * sin);
                } else {
                    // For human-sized units, the bottom is at y + radius
                    visualBottom = ent.y + (ent.radius || 32);
                }

                renderQueue.push({
                    type: 'entity',
                    sortY: visualBottom,
                    data: ent
                });
            }
        });

        // 3. Sort and Render Ground Layer
        renderQueue.sort((a, b) => a.sortY - b.sortY);
        renderQueue.forEach(item => {
            if (item.type === 'block') {
                this.tileMap.renderBlock(this.ctx, item.data, this.camera);
            } else {
                item.data.render(this.ctx, this.camera);
            }
        });

        // 4. Render Overlays (Tall objects' tops, camo nets, etc.)
        this.tileMap?.renderOverlays(this.ctx, this.camera);

        // 5. Render Airborne Entities (always on top of ground layer)
        allEntities.forEach(ent => {
            if (!ent) return;
            const isAirborne = (ent.moveType === 'air') || (ent.altitude > 0);
            if (isAirborne && this.isVisibleToPlayer(ent.x, ent.y)) {
                ent.render(this.ctx, this.camera);
            }
        });

        // --- Interaction Hints ([F] Label) ---
        if (this.player && !this.player.isInVehicle && !this.inventory?.isOpen) {
            const c = []; const p = this.player, pA = p.facingAngle;
            
            // 1. Machine Guns
            this.machineGuns.forEach(mg => { 
                const d = Math.sqrt((mg.x-p.x)**2+(mg.y-p.y)**2); 
                if(d < 80) c.push({ n: '기관총 사용', x: mg.x, y: mg.y, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(mg.y-p.y, mg.x-p.x))) }); 
            });

            // 2. Tiles (Doors, Loot boxes, etc.)
            const px = Math.floor(p.x/64), py = Math.floor(p.y/64);
            for(let y=py-1; y<=py+1; y++) { 
                for(let x=px-1; x<=px+1; x++) {
                    const b = this.tileMap.getBlockAt(x, y); 
                    if(b?.def?.interactable) { 
                        const ctr = b.getCenterWorld(); 
                        let label = b.def.name;
                        if (b.id === 'door') label = '문 열기';
                        else if (b.id === 'door_open') label = '문 닫기';
                        else if (b.id === 'loot_box') label = '상자 열기';
                        else if (b.id === 'gun_workbench') label = '총기 제작대';

                        c.push({ n: label, x: ctr.x, y: ctr.y, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(ctr.y-p.y, ctr.x-p.x))) }); 
                    }
                } 
            }

            // 3. Vehicles (Context Sensitive: Front vs Rear)
            this.vehicles.forEach(v => { 
                const dx = p.x - v.x, dy = p.y - v.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if(d < v.interactionRadius) {
                    // Calculate if player is at the front or back of the vehicle
                    const localX = dx * Math.cos(-v.angle) - dy * Math.sin(-v.angle);
                    let label = '차량';
                    if (v.type === 'tank') label = '전차';
                    else if (v.type === 'apc') label = '장갑차';
                    else if (v.type === 'transport_ship') label = '수송선';
                    else if (v.type === 'transport_plane') label = '수송기';
                    
                    if (localX > -v.width / 2) label += ' 탑승';
                    else if (v.hasExternalStorage) label = '적재함 열기';
                    else label += ' 탑승';

                    c.push({ n: label, x: v.x, y: v.y, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(v.y-p.y, v.x-p.x))) }); 
                }
            });

            // 4. Loot Items
            this.loots.forEach(l => {
                const d = Math.sqrt((l.x-p.x)**2+(l.y-p.y)**2);
                if(d < 80) {
                    const itemDef = this.assetManager.getData('items')?.find(it => it.id === l.itemId);
                    c.push({ n: `${itemDef?.name || '아이템'} 줍기`, x: l.x, y: l.y, ad: Math.abs(this.getAngleDiff(pA, Math.atan2(l.y-p.y, l.x-p.x))) });
                }
            });

            if(c.length > 0) { 
                c.sort((a, b) => a.ad - b.ad); 
                const b = c[0]; 
                this.ctx.fillStyle = '#fff'; 
                this.ctx.font = 'bold 16px Arial'; 
                this.ctx.textAlign = 'center'; 
                this.ctx.fillText(`[F] ${b.n}`, b.x - this.camera.x, b.y - this.camera.y - 45); 
            }
        }

        this.ctx.restore();
        this.renderVisionOverlay(this.ctx);
        if (this.inventory) { 
            this.inventory.render(this.ctx); 
            this.inventory.renderHotbar(this.ctx); 
        }

        this.renderMinimap(); 
                
        this.debugMenu?.render(this.ctx);
        if (this.debugMenu?.showCollisions) this.debugRender();

        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.fillText("Escape from Battlefield", 20, 35);
        const tm = `${Math.floor(this.gameTime/60).toString().padStart(2,'0')}:${Math.floor(this.gameTime%60).toString().padStart(2,'0')}`;
        this.ctx.fillStyle = '#f1c40f'; this.ctx.fillText(`🕒 ${tm}`, 20, 65);
    }

    debugRender() {
        const ctx = this.ctx;
        const cam = this.camera;
        ctx.save();
        ctx.scale(this.zoom, this.zoom);

        // 1. All Visible Blocks Structure & Collisions
        if (this.tileMap) {
            const blocks = this.tileMap.getVisibleBlocks(cam);
            blocks.forEach(b => {
                const sx = b.worldX - cam.x;
                const sy = b.worldY - cam.y;
                const sw = b.width * 64;
                const sh = b.height * 64;

                // Purple outline for the whole block area
                ctx.strokeStyle = 'rgba(155, 89, 182, 0.4)';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx, sy, sw, sh);
                
                // Red fill for the actual collision area
                if (b.def.collidable) {
                    const cb = b.getCollisionBoundsWorld();
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                    ctx.fillRect(cb.x1 - cam.x, cb.y1 - cam.y, cb.x2 - cb.x1, cb.y2 - cb.y1);
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cb.x1 - cam.x, cb.y1 - cam.y, cb.x2 - cb.x1, cb.y2 - cb.y1);
                }

                // Show Anchor Point & ID
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(sx + 2, sy + 2, 8, 8);
                ctx.font = '10px Arial';
                ctx.fillText(`${b.id}`, sx + 12, sy + 10);
            });
        }

        // 2. Extra Floor Collisions (like water)
        const sX = Math.floor(cam.x / 64), eX = Math.ceil((cam.x + cam.width) / 64);
        const sY = Math.floor(cam.y / 64), eY = Math.ceil((cam.y + cam.height) / 64);

        for (let y = sY; y <= eY; y++) {
            for (let x = sX; x <= eX; x++) {
                const floorId = this.tileMap.getTile(x, y, 'floor');
                const fDef = this.assetManager.getData('tiles')?.find(t => t.id === floorId);
                if (fDef?.collidable) {
                    ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
                    ctx.fillRect(x * 64 - cam.x, y * 64 - cam.y, 64, 64);
                }
            }
        }

        // 3. Entity Collisions (Green Shapes)
        const ents = [this.player, ...this.enemies, ...this.vehicles];
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.lineWidth = 2;
        ents.forEach(ent => {
            if (!ent) return;
            if (ent.isRectCollision) {
                ctx.strokeRect(ent.x - ent.width / 2 - cam.x, ent.y - ent.height / 2 - cam.y, ent.width, ent.height);
            } else {
                ctx.beginPath();
                ctx.arc(ent.x - cam.x, ent.y - cam.y, ent.radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        });

        ctx.restore();
    }
}