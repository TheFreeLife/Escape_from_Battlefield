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

    startTestMode(layout) {
        this.activeMap = layout;
        this.isTestMode = true;
        this.gameState = 'PLAYING';
        document.getElementById('editor-ui').classList.add('hidden');
        document.getElementById('main-menu').classList.add('hidden');
        this.resetGame();
    }

    startGame(mapName, isDefault = false) {
        this.activeMap = isDefault ? this.defaultMaps[mapName] : this.customMaps[mapName];
        if (!this.activeMap) return;
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
        if (this.activeMap) {
            this.mapW = this.activeMap[0].length;
            this.mapH = this.activeMap.length;
            sx = (this.mapW / 2) * 64;
            sy = (this.mapH / 2) * 64;
        }

        this.player.x = sx; this.player.y = sy;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
        this.player.isInVehicle = false;
        this.player.isUsingMountedWeapon = false;

        // --- NEW: Spawn all entities once ---
        if (this.mapGenerator) {
            this.mapGenerator.spawnEntities();
        }

        const range = 16 * 64;
        const cx = Math.floor(sx / range), cy = Math.floor(sy / range);
        for (let y = cy - 1; y <= cy + 1; y++) {
            for (let x = cx - 1; x <= cx + 1; x++) this.tileMap.getChunk(x, y);
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
        
        // 3. Collision Points
        const buffer = radius * 0.5;
        const pts = [
            { x: x - buffer, y: y - buffer }, { x: x + buffer, y: y - buffer },
            { x: x - buffer, y: y + buffer }, { x: x + buffer, y: y + buffer },
            { x, y }
        ];

        for (const p of pts) {
            const tx = Math.floor(p.x / 64);
            const ty = Math.floor(p.y / 64);
            
            if (tx < 0 || tx >= this.mapW || ty < 0 || ty >= this.mapH) return true;

            // Block Check (includes the new 'void' block)
            const block = this.tileMap.getBlockAt(tx, ty);
            if (block?.def?.collidable) return true;

            // Floor check for special types
            const fid = this.tileMap.getTile(tx, ty, 'floor');
            
            if (moveType === 'land') {
                if (fid === 'water' && radius > 32) return true;
            } else if (moveType === 'sea') {
                if (fid !== 'water') {
                    // We allow ships on land but very slow (handled in Vehicle.js)
                    // No physical block here anymore
                }
            }
        }
        
        return false;
    }

    checkCollision(x, y, radius, ignore = null, moveType = 'land') {
        // Always check tiles first (includes boundary check)
        if (this.checkTileCollision(x, y, radius, moveType)) return true;

        // For air units, we might skip entity-to-entity collision with ground units,
        // but for now let's keep it simple and check boundaries.
        // If air, only return true if hit map boundary (handled above)
        // Let's assume air units only collide with other air units or boundaries.
        if (moveType === 'air') return false;

        const ents = [this.player, ...this.enemies, ...this.vehicles];
        for (const ent of ents) {
            if (!ent || ent === ignore || !ent.isCollidable) continue;
            
            // Skip ground entity collision for air units (already handled by early return if moveType is air)
            
            const dx = x - ent.x, dy = y - ent.y, dSq = dx*dx + dy*dy, mD = radius + ent.radius;
            if (dSq < mD * mD) {
                if (ignore && ignore.weight > ent.weight) {
                    const dist = Math.sqrt(dSq) || 0.1, o = mD - dist, nx = dx/dist, ny = dy/dist;
                    // Push the other entity
                    const entMT = ent.moveType || 'land';
                    if (!this.checkTileCollision(ent.x - nx*o, ent.y - ny*o, ent.radius, entMT)) {
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
        this.updateDaylight();

        if (this.player) {
            this.player.update(dt);
            this.camera.x = this.player.x - this.camera.width / 2;
            this.camera.y = this.player.y - this.camera.height / 2;
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

        // Fill fog ONLY within map boundaries
        vCtx.fillStyle = 'rgba(0, 2, 8, 0.15)'; 
        const mx = -this.camera.x * this.zoom;
        const my = -this.camera.y * this.zoom;
        vCtx.fillRect(mx, my, this.mapW * 64 * this.zoom, this.mapH * 64 * this.zoom);

        const sX = (this.player.x - this.camera.x) * this.zoom;
        const sY = (this.player.y - this.camera.y) * this.zoom;

        vCtx.globalCompositeOperation = 'destination-out'; 
        vCtx.fillStyle = 'white'; vCtx.shadowBlur = 30 * this.zoom; vCtx.shadowColor = 'white';
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
        vCtx.beginPath(); vCtx.arc(sX, sY, 80 * this.zoom, 0, Math.PI * 2); vCtx.fill();
        vCtx.globalCompositeOperation = 'source-over'; ctx.drawImage(this.vC, 0, 0);
    }

    render() {
        if (this.gameState === 'MENU') { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); return; }
        if (this.gameState === 'EDITOR') { this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); this.mapEditor?.render(this.ctx); return; }
        
        // --- Game Play Rendering ---
        this.ctx.fillStyle = '#000'; // Pure black background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save(); 
        this.ctx.scale(this.zoom, this.zoom);
        this.tileMap?.render(this.ctx, this.camera); 
        this.player?.render(this.ctx, this.camera); 
        this.tileMap?.renderOverlays(this.ctx, this.camera);

        const allEntities = [
            ...this.enemies, ...this.projectiles, ...this.loots, 
            ...this.grenades, ...this.vehicles, ...this.machineGuns
        ];

        // 1. Render Ground Entities
        allEntities.forEach(ent => {
            const isAirborne = (ent.moveType === 'air') || (ent.altitude > 0);
            if (!isAirborne && this.isVisibleToPlayer(ent.x, ent.y)) {
                ent.render(this.ctx, this.camera);
            }
        });

        // 2. Render Airborne Entities (on top)
        allEntities.forEach(ent => {
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
        if (this.inventory) { this.inventory.render(this.ctx); this.inventory.renderHotbar(this.ctx); }
                this.renderMinimap(); 
                
                // --- Daylight Overlay clipped to map ---
                if (this.ambientLight < 1.0 && this.activeMap) {
                    this.ctx.save();
                    const mx = -this.camera.x * this.zoom;
                    const my = -this.camera.y * this.zoom;
                    this.ctx.beginPath();
                    this.ctx.rect(mx, my, this.mapW * 64 * this.zoom, this.mapH * 64 * this.zoom);
                    this.ctx.clip();
                    this.ctx.fillStyle = `rgba(0, 5, 20, ${(1 - this.ambientLight) * 0.75})`;
                    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.restore();
                }
        
                this.debugMenu?.render(this.ctx);
         this.ctx.fillStyle = '#fff'; this.ctx.font = 'bold 20px Arial'; this.ctx.fillText("Escape from Battlefield", 20, 35);
        const tm = `${Math.floor(this.gameTime/60).toString().padStart(2,'0')}:${Math.floor(this.gameTime%60).toString().padStart(2,'0')}`;
        this.ctx.fillStyle = '#f1c40f'; this.ctx.fillText(`🕒 ${tm}`, 20, 65);
    }
}