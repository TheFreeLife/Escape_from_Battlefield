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
        this.activeMap = null; // Current map layout
        this.isFirstLoad = false;

        // Day/Night Cycle
        this.gameTime = 12 * 60; // Start at Noon (minutes)
        this.dayLength = 24 * 60; // 24 hours in minutes
        this.timeScale = 1.0; // 1 real second = 1 game minute
        this.ambientLight = 1.0; // 0.0 (Night) to 1.0 (Day)

        this.init();
        this.setupMenu();
    }

    async init() {
        await this.assetManager.loadData([
            { name: 'tiles', path: 'assets/data/tiles.json' },
            { name: 'maps', path: 'assets/data/maps.json' },
            { name: 'biomes', path: 'assets/data/biomes.json' },
            { name: 'enemies', path: 'assets/data/enemies.json' }
        ]);

        this.assetManager.data['items'] = allItems;
        await this.assetManager.generateBitmaps();

        this.tileMap = new TileMap(this);
        const mapGenerator = new MapGenerator(this);
        this.tileMap.setGenerator(mapGenerator);
        this.mapGenerator = mapGenerator;

        this.player = new Player(this, 300, 300);
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
        const mainMenu = document.getElementById('main-menu');
        const editorUi = document.getElementById('editor-ui');
        const mapMenu = document.getElementById('map-selection-menu');

        if (this.gameState === 'PLAYING') {
            this.gameState = 'MENU';
            mainMenu.classList.remove('hidden');
        } else if (this.gameState === 'EDITOR') {
            this.gameState = 'MENU';
            editorUi.classList.add('hidden');
            mainMenu.classList.remove('hidden');
        }
        mapMenu.classList.add('hidden');
    }

    startTestMode(layout) {
        this.activeMap = layout;
        this.gameState = 'PLAYING';
        document.getElementById('editor-ui').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');
        this.resetGame();
    }

    startGame(mapName, isDefault = false) {
        this.activeMap = isDefault ? this.defaultMaps[mapName] : this.customMaps[mapName];
        if (!this.activeMap) return;

        this.gameState = 'PLAYING';
        document.getElementById('map-selection-menu').classList.add('hidden');
        this.resetGame();
    }

    resetGame() {
        this.enemies = [];
        this.projectiles = [];
        this.loots = [];
        this.grenades = [];
        this.vehicles = [];
        this.machineGuns = [];
        this.tileMap.chunks.clear(); 
        
        this.isFirstLoad = true;

        let sx = 0, sy = 0;
        if (this.activeMap) {
            sx = (this.activeMap[0].length / 2) * 64;
            sy = (this.activeMap.length / 2) * 64;
        }

        this.player.x = sx;
        this.player.y = sy;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.isInVehicle = false;
        this.player.isUsingMountedWeapon = false;

        // Force initial chunk generation
        const cx = Math.floor(sx / (64 * 16));
        const cy = Math.floor(sy / (64 * 16));
        for (let y = cy - 1; y <= cy + 1; y++) {
            for (let x = cx - 1; x <= cx + 1; x++) {
                this.tileMap.getChunk(x, y);
            }
        }

        this.isFirstLoad = false;
    }

    setupMenu() {
        const startBtn = document.getElementById('start-btn');
        const editorBtn = document.getElementById('editor-btn');
        const mainMenu = document.getElementById('main-menu');
        const editorUi = document.getElementById('editor-ui');
        const mapMenu = document.getElementById('map-selection-menu');
        const mapBackBtn = document.getElementById('map-back-btn');
        
        startBtn.addEventListener('click', () => {
            mainMenu.classList.add('hidden');
            mapMenu.classList.remove('hidden');
            this.renderMapList();
        });

        mapBackBtn.addEventListener('click', () => {
            mapMenu.classList.add('hidden');
            mainMenu.classList.remove('hidden');
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

    renderMapList() {
        const mapList = document.getElementById('map-list');
        mapList.innerHTML = '';
        this.loadSavedMaps();

        // Default Maps
        const defHeader = document.createElement('div');
        defHeader.innerText = "--- 기본 제공 맵 ---";
        defHeader.className = "map-header";
        mapList.appendChild(defHeader);

        Object.keys(this.defaultMaps).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'map-select-btn';
            btn.innerText = name;
            btn.addEventListener('click', () => this.startGame(name, true));
            mapList.appendChild(btn);
        });

        // Custom Maps
        const custHeader = document.createElement('div');
        custHeader.innerText = "--- 사용자 제작 맵 ---";
        custHeader.className = "map-header";
        mapList.appendChild(custHeader);

        Object.keys(this.customMaps).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'map-select-btn';
            btn.style.backgroundColor = '#2c3e50';
            btn.innerText = name;
            btn.addEventListener('click', () => this.startGame(name, false));
            mapList.appendChild(btn);
        });

        const importBtn = document.createElement('button');
        importBtn.innerText = "+ 맵 코드 가져오기";
        importBtn.className = 'map-select-btn';
        importBtn.style.backgroundColor = "#3498db";
        importBtn.addEventListener('click', () => {
            const name = prompt("맵 이름:");
            const code = prompt("맵 코드:");
            if (name && code) {
                try {
                    this.customMaps[name] = JSON.parse(code);
                    localStorage.setItem('efb_custom_maps', JSON.stringify(this.customMaps));
                    this.renderMapList();
                } catch(e) { alert("코드 오류!"); }
            }
        });
        mapList.appendChild(importBtn);
    }

    checkTileCollision(x, y, radius, moveType = 'land') {
        const buffer = radius * 0.8;
        const floorBuffer = (moveType === 'sea') ? radius * 0.2 : buffer;
        const points = [
            { x: x - buffer, y: y - buffer }, { x: x + buffer, y: y - buffer },
            { x: x - buffer, y: y + buffer }, { x: x + buffer, y: y + buffer }
        ];
        const floorPoints = (moveType === 'sea') ? [...points, { x, y }] : points;
        if (!this.tileMap || moveType === 'air') return false;

        const hasBlockCollision = points.some(p => {
            const tx = Math.floor(p.x / 64);
            const ty = Math.floor(p.y / 64);
            const block = this.tileMap.getBlockAt(tx, ty);
            return block && block.def && block.def.collidable;
        });
        if (hasBlockCollision) return true;

        return floorPoints.some(p => {
            const tx = Math.floor(p.x / 64);
            const ty = Math.floor(p.y / 64);
            const floorId = this.tileMap.getTile(tx, ty, 'floor');
            
            // Get tile definition to check 'collidable' property
            const tileDef = this.assetManager.getData('tiles')?.find(t => t.id === floorId);

            if (moveType === 'land') {
                // 1. Check if tile is explicitly marked as collidable (like 'void')
                if (tileDef && tileDef.collidable && floorId !== 'water') return true;

                // 2. Special water logic for land units
                if (floorId === 'water') return radius > 32;
            }
            if (moveType === 'sea' && floorId !== 'water' && floorId !== null) return true;
            return false;
        });
    }

    checkCollision(x, y, radius, ignore = null, moveType = 'land') {
        if (this.checkTileCollision(x, y, radius, moveType)) return true;
        if (moveType === 'air') return false;

        const entities = [this.player, ...this.enemies, ...this.vehicles];
        for (const ent of entities) {
            if (!ent || ent === ignore || !ent.isCollidable) continue;
            const dx = x - ent.x, dy = y - ent.y;
            const distSq = dx * dx + dy * dy, minDist = radius + ent.radius;
            if (distSq < minDist * minDist) {
                if (ignore && ignore.weight > ent.weight) {
                    const dist = Math.sqrt(distSq) || 0.1, overlap = minDist - dist;
                    const nx = dx / dist, ny = dy / dist;
                    if (!this.checkTileCollision(ent.x - nx * overlap, ent.y - ny * overlap, ent.radius, ent.moveType || 'land')) {
                        ent.x -= nx * overlap; ent.y -= ny * overlap;
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
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
        if (!this.isReady) return;
        requestAnimationFrame((time) => this.loop(time));
    }

    loop(currentTime) {
        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (dt > 0.1) { requestAnimationFrame((t) => this.loop(t)); return; }
        this.update(dt);
        this.render();
        this.input.reset();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.input.isKeyPressed('Escape')) {
            if (!this.lastEscState) { this.handleBackNavigation(); this.lastEscState = true; }
        } else this.lastEscState = false;

        if (this.gameState === 'EDITOR' && this.mapEditor) { this.mapEditor.update(dt); return; }
        if (this.gameState !== 'PLAYING') return;

        if (this.input.isKeyPressed('F1') || this.input.isKeyPressed('Backquote')) {
            if (!this.lastDebugState) { this.debugMenu.toggle(); this.lastDebugState = true; }
        } else this.lastDebugState = false;

        if (this.debugMenu.isVisible) this.debugMenu.update(dt);

        if (this.input.isKeyPressed('KeyF')) {
            if (!this.lastFState) { this.handleInteraction(); this.lastFState = true; }
        } else this.lastFState = false;

        if (this.inventory && this.inventory.isOpen) { this.inventory.update(dt); return; }

        this.gameTime = (this.gameTime + dt * this.timeScale) % this.dayLength;
        this.updateDaylight();

        if (this.player) {
            this.player.update(dt);
            this.camera.x = this.player.x - this.camera.width / 2;
            this.camera.y = this.player.y - this.camera.height / 2;
        }

        [this.projectiles, this.enemies, this.loots, this.grenades, this.vehicles, this.machineGuns].forEach(list => {
            for (let i = list.length - 1; i >= 0; i--) {
                list[i].update(dt);
                if (list[i].markedForDeletion || list[i].isDead) list.splice(i, 1);
            }
        });

        if (this.input.isKeyPressed('KeyT') && !this.inventory.isOpen) {
            if (!this.lastTStateGlobal) {
                const nearbyMGIdx = this.machineGuns.findIndex(mg => {
                    const dx = mg.x - this.player.x, dy = mg.y - this.player.y;
                    return Math.sqrt(dx*dx + dy*dy) < 60 && !mg.isOccupied;
                });
                if (nearbyMGIdx !== -1) this.retrieveMachineGun(nearbyMGIdx);
                else {
                    const sel = this.inventory.getSelectedItem();
                    if (sel && sel.id === 'm2hb' && !this.player.isInVehicle) this.deployMachineGun(sel);
                }
                this.lastTStateGlobal = true;
            }
        } else this.lastTStateGlobal = false;
    }

    deployMachineGun(item) {
        this.machineGuns.push(new MachineGun(this, this.player.x, this.player.y, this.player.facingAngle, item));
        this.inventory.hotbar[this.inventory.selectedSlot] = null;
    }

    retrieveMachineGun(idx) {
        const mg = this.machineGuns[idx];
        if (this.inventory.addItem({ id: mg.itemData.id, count: 1, ammo: mg.itemData.ammo })) this.machineGuns.splice(idx, 1);
    }

    handleInteraction() {
        if (this.inventory?.isOpen) { this.inventory.toggle(); return; }
        if (this.player.isUsingMountedWeapon) { this.player.currentMountedWeapon.exit(); return; }
        if (this.player.isInVehicle) { this.player.currentVehicle.exit(); return; }

        const candidates = [];
        const p = this.player, pAngle = p.facingAngle;

        this.machineGuns.forEach(mg => {
            const dx = mg.x - p.x, dy = mg.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
            if (dist < 80) candidates.push({ type: 'machine_gun', entity: mg, dist, angleDiff: Math.abs(this.getAngleDiff(pAngle, Math.atan2(dy, dx))) });
        });

        const px = Math.floor(p.x/64), py = Math.floor(p.y/64);
        for(let y=py-1; y<=py+1; y++) {
            for(let x=px-1; x<=px+1; x++) {
                const block = this.tileMap.getBlockAt(x, y);
                if (block?.def?.interactable || block?.id === 'gun_workbench') {
                    const center = block.getCenterWorld(), dx = center.x - p.x, dy = center.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
                    if (dist < 100) candidates.push({ type: 'tile', x: block.anchorX, y: block.anchorY, id: block.id, dist, angleDiff: Math.abs(this.getAngleDiff(pAngle, Math.atan2(dy, dx))) });
                }
            }
        }

        this.vehicles.forEach(v => {
            const dx = v.x - p.x, dy = v.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
            if (dist < v.interactionRadius) candidates.push({ type: 'vehicle', entity: v, dist, angleDiff: Math.abs(this.getAngleDiff(pAngle, Math.atan2(dy, dx))) });
        });

        this.loots.forEach((l, i) => {
            const dx = l.x - p.x, dy = l.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
            if (dist < 80) candidates.push({ type: 'loot', entity: l, index: i, dist, angleDiff: Math.abs(this.getAngleDiff(pAngle, Math.atan2(dy, dx))) });
        });

        if (candidates.length === 0) return;
        candidates.sort((a, b) => a.angleDiff - b.angleDiff);
        const best = candidates[0];

        if (best.type === 'machine_gun') best.entity.enter(p);
        else if (best.type === 'tile') {
            if (best.id === 'gun_workbench') this.inventory.openCrafting();
            else if (best.id === 'loot_box') {
                let meta = this.tileMap.getMetadata(best.x, best.y) || { items: new Array(16).fill(null) };
                this.inventory.openExternalStorage(meta, 'chest');
            } else if (best.id.startsWith('door')) {
                const next = (best.id === 'door') ? 'door_open' : 'door';
                this.tileMap.setTile(best.x, best.y, next, 'block', this.tileMap.getMetadata(best.x, best.y));
            }
        } else if (best.type === 'vehicle') {
            if (best.entity.handleInteraction(p.x, p.y) === 'STORAGE') this.inventory.openExternalStorage(best.entity, 'vehicle');
        } else if (best.type === 'loot') {
            if (this.inventory.addItem({ id: best.entity.itemId, count: best.entity.count || 1 })) best.entity.markedForDeletion = true;
        }
    }

    getAngleDiff(a, b) {
        let d = b - a;
        while (d < -Math.PI) d += Math.PI * 2;
        while (d > Math.PI) d -= Math.PI * 2;
        return d;
    }

    updateDaylight() {
        const h = this.gameTime / 60;
        if (h >= 6 && h < 10) this.ambientLight = 0.2 + (h - 6) / 4 * 0.8;
        else if (h >= 10 && h < 18) this.ambientLight = 1.0;
        else if (h >= 18 && h < 22) this.ambientLight = 1.0 - (h - 18) / 4 * 0.8;
        else this.ambientLight = 0.2;
    }

    isVisibleToPlayer(tx, ty) {
        if (!this.player) return true;
        const dx = tx - this.player.x, dy = ty - this.player.y, dSq = dx*dx + dy*dy;
        if (dSq < 80*80) return true;
        if (dSq > 1600*1500) return false;
        const fov = this.inventory.isAiming ? 0.5 : 0.9;
        if (Math.abs(this.getAngleDiff(this.player.facingAngle, Math.atan2(dy, dx))) >= fov) return false;
        return this.isLineOfSightClear(this.player.x, this.player.y, tx, ty);
    }

    isLineOfSightClear(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1, dist = Math.sqrt(dx*dx+dy*dy), step = 20, steps = dist / step;
        for (let i = 1; i < steps; i++) {
            if (this.tileMap.blocksVision(x1 + (dx/steps)*i, y1 + (dy/steps)*i)) return false;
        }
        return true;
    }

    renderVisionOverlay(ctx) {
        if (!this.player || this.gameState !== 'PLAYING') return;
        if (!this.visionCanvas) this.visionCanvas = document.createElement('canvas');
        if (this.visionCanvas.width !== this.canvas.width) { this.visionCanvas.width = this.canvas.width; this.visionCanvas.height = this.canvas.height; }
        const vCtx = this.visionCanvas.getContext('2d');
        const sX = (this.player.x - this.camera.x) * this.zoom, sY = (this.player.y - this.camera.y) * this.zoom;
        vCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        vCtx.fillStyle = 'rgba(0, 2, 8, 0.15)'; vCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        vCtx.globalCompositeOperation = 'destination-out'; vCtx.fillStyle = 'white'; vCtx.shadowBlur = 30 * this.zoom; vCtx.shadowColor = 'white';
        const fov = this.inventory.isAiming ? 0.5 : 0.9, dist = 1500, step = 0.015, start = this.player.facingAngle - fov, end = this.player.facingAngle + fov;
        vCtx.beginPath(); vCtx.moveTo(sX, sY);
        for (let a = start; a <= end + step; a += step) {
            const act = Math.max(start, Math.min(end, a)), cos = Math.cos(act), sin = Math.sin(act);
            let dFinal = dist;
            for (let d = 50; d < dist; d += 50) {
                if (this.tileMap.blocksVision(this.player.x + cos * d, this.player.y + sin * d)) {
                    let lo = d - 50, hi = d;
                    for (let n = 0; n < 5; n++) { let mi = (lo + hi) / 2; if (this.tileMap.blocksVision(this.player.x + cos * mi, this.player.y * sin * mi)) hi = mi; else lo = mi; }
                    dFinal = hi; break;
                }
            }
            vCtx.lineTo(sX + cos * dFinal * this.zoom, sY + sin * dFinal * this.zoom);
        }
        vCtx.lineTo(sX, sY); vCtx.closePath(); vCtx.fill();
        vCtx.beginPath(); vCtx.arc(sX, sY, 80 * this.zoom, 0, Math.PI * 2); vCtx.fill();
        vCtx.shadowBlur = 0; vCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.visionCanvas, 0, 0);
    }

    updateMinimapCache() {
        const c = this.minimapCache.getContext('2d'), sz = 200, sc = 0.05, hsz = sz/2;
        c.clearRect(0, 0, sz, sz);
        const r = hsz / sc, sX = Math.floor((this.player.x - r)/64), eX = Math.ceil((this.player.x + r)/64);
        const sY = Math.floor((this.player.y - r)/64), eY = Math.ceil((this.player.y + r)/64);
        for(let ty=sY; ty<=eY; ty++) {
            for(let tx=sX; tx<=eX; tx++) {
                const b = this.mapGenerator.getBiomeAt(tx, ty);
                if (b) { c.fillStyle = b.color; c.fillRect(hsz + (tx*64 - this.player.x)*sc, hsz + (ty*64 - this.player.y)*sc, 64*sc + 0.5, 64*sc + 0.5); }
            }
        }
    }

    renderMinimap() {
        const sz = 180, m = 20, x = this.canvas.width - sz - m, y = m, ctx = this.ctx;
        if (Math.sqrt((this.player.x-this.lastMinimapUpdatePos.x)**2 + (this.player.y-this.lastMinimapUpdatePos.y)**2) > 64) {
            this.updateMinimapCache(); this.lastMinimapUpdatePos = { x: this.player.x, y: this.player.y };
        }
        ctx.save(); ctx.beginPath(); ctx.arc(x + sz/2, y + sz/2, sz/2, 0, Math.PI*2);
        ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
        ctx.drawImage(this.minimapCache, x, y, sz, sz);
        const sc = 0.05, cx = x + sz/2, cy = y + sz/2;
        const dot = (ex, ey, col, r) => {
            const sx = cx + (ex - this.player.x)*sc, sy = cy + (ey - this.player.y)*sc;
            if ((sx-cx)**2 + (sy-cy)**2 < (sz/2)**2) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill(); }
        };
        this.vehicles.forEach(v => dot(v.x, v.y, '#f1c40f', 4));
        this.enemies.forEach(e => dot(e.x, e.y, '#e74c3c', 2.5));
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }

    renderTileInteractionHints(ctx) {
        if (!this.player || this.player.isInVehicle || this.inventory.isOpen) return;
        const cands = []; const p = this.player, pA = p.facingAngle, px = Math.floor(p.x/64), py = Math.floor(p.y/64);
        for(let y=py-1; y<=py+1; y++) {
            for(let x=px-1; x<=px+1; x++) {
                const b = this.tileMap.getBlockAt(x, y);
                if (b?.def?.interactable || b?.id === 'gun_workbench') {
                    const ctr = b.getCenterWorld(), dx = ctr.x - p.x, dy = ctr.y - p.y, dist = Math.sqrt(dx*dx+dy*dy);
                    if (dist < 100) cands.push({ type: 'tile', centerX: ctr.x, centerY: ctr.y, name: b.def.name, dist, angleDiff: Math.abs(this.getAngleDiff(pA, Math.atan2(dy, dx))) });
                }
            }
        }
        this.vehicles.forEach(v => {
            const dx = v.x-p.x, dy = v.y-p.y, dist = Math.sqrt(dx*dx+dy*dy);
            if (dist < v.interactionRadius) cands.push({ type: 'vehicle', entity: v, centerX: v.x, centerY: v.y, name: v.type.toUpperCase(), dist, angleDiff: Math.abs(this.getAngleDiff(pA, Math.atan2(dy, dx))) });
        });
        if (cands.length === 0) return;
        cands.sort((a, b) => a.angleDiff - b.angleDiff);
        const b = cands[0], sX = b.centerX - this.camera.x, sY = b.centerY - this.camera.y;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`[F] ${b.name}`, sX, sY - 45);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(sX - 10, sY - 30, 20, 20);
    }

    renderDaylightOverlay(ctx) {
        if (this.ambientLight >= 1.0) return;
        ctx.fillStyle = `rgba(0, 5, 20, ${(1.0-this.ambientLight)*0.75})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        if (this.gameState === 'MENU') { this.ctx.fillStyle = '#1a1a1a'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); return; }
        if (this.gameState === 'EDITOR') { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.mapEditor?.render(this.ctx); return; }
        this.ctx.fillStyle = '#1a1a1a'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save(); this.ctx.scale(this.zoom, this.zoom);
        this.tileMap?.render(this.ctx, this.camera);
        this.player?.render(this.ctx, this.camera);
        this.tileMap?.renderOverlays(this.ctx, this.camera);
        [this.enemies, this.projectiles, this.loots, this.grenades, this.vehicles, this.machineGuns].forEach(list => {
            list.forEach(ent => { if (this.isVisibleToPlayer(ent.x, ent.y)) ent.render(this.ctx, this.camera); });
        });
        this.renderTileInteractionHints(this.ctx); this.ctx.restore();
        this.renderVisionOverlay(this.ctx);
        if (this.inventory) { this.inventory.render(this.ctx); this.inventory.renderHotbar(this.ctx); }
        this.renderMinimap(); this.renderDaylightOverlay(this.ctx);
        this.debugMenu?.render(this.ctx);
        this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.fillText("Escape from Battlefield", 20, 35);
        const t = `${Math.floor(this.gameTime/60).toString().padStart(2,'0')}:${Math.floor(this.gameTime%60).toString().padStart(2,'0')}`;
        this.ctx.fillStyle = '#f1c40f'; this.ctx.fillText(`🕒 ${t}`, 20, 65);
    }
}