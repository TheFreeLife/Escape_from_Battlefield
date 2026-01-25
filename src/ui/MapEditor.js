export default class MapEditor {
    constructor(game) {
        this.game = game;
        this.baseTileSize = 40;
        this.zoom = 1.0;
        this.offsetX = 100;
        this.offsetY = 100;
        this.lastMousePos = { x: 0, y: 0 };
        this.tiles = new Map(); 
        this.selectedTileId = 'grass';
        this.selectedTool = 'pen';
        this.activeLayer = 'floor';
        this.currentRotation = 0; // 0, 90, 180, 270 degrees
        this.rectStart = null;
        this.isDrawing = false;
        this.mapLogic = {
            variables: {},
            events: []
        };
        this.locations = []; // [{id, name, x, y, w, h}]
        this.selectedEventIndex = -1;
        this.editingLocationIndex = -1;
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            if (this.game.gameState !== 'EDITOR') return;
            if (e.key.toLowerCase() === 'r') {
                const tiles = this.game.assetManager.getData('tiles') || [];
                const def = tiles.find(t => t.id === this.selectedTileId);
                
                if (def && def.rotatable === false) {
                    console.log(`Tile ${this.selectedTileId} is not rotatable.`);
                    this.currentRotation = 0; // Reset to default
                    return;
                }

                this.currentRotation = (this.currentRotation + 90) % 360;
                console.log(`Rotation: ${this.currentRotation}°`);
            }
        });

        const shapeMainBtn = document.getElementById('tool-shape-main');
        const shapeSubPalette = document.getElementById('shape-sub-palette');

        ['pen', 'eraser', 'fill'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) btn.addEventListener('click', () => this.selectTool(tool));
        });

        shapeMainBtn.addEventListener('click', () => {
            shapeSubPalette.classList.toggle('hidden');
        });

        ['rect', 'circle', 'triangle'].forEach(tool => {
            const btn = document.getElementById(`tool-${tool}`);
            if (btn) btn.addEventListener('click', () => {
                this.selectTool(tool);
                shapeMainBtn.innerText = btn.innerText;
                shapeSubPalette.classList.add('hidden');
            });
        });

        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.layer === 'logic') {
                    this.openLogicModal();
                    return;
                }
                document.querySelectorAll('.layer-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                this.activeLayer = btn.dataset.layer;
                this.updatePaletteFilter();
            });
        });

        document.getElementById('unit-settings-save').addEventListener('click', () => this.saveUnitSettings());
        document.getElementById('unit-settings-cancel').addEventListener('click', () => this.closeUnitSettings());
        document.getElementById('unit-settings-delete').addEventListener('click', () => this.deleteUnit());
        document.getElementById('add-loot-entry-btn').addEventListener('click', () => this.addLootEntry());
        document.getElementById('loot-settings-save').addEventListener('click', () => this.saveLootSettings());
        document.getElementById('loot-settings-cancel').addEventListener('click', () => this.closeLootSettings());

        // Map Logic Modal Events
        document.getElementById('logic-settings-close').addEventListener('click', () => this.closeLogicModal());
        document.getElementById('add-event-btn').addEventListener('click', () => this.addNewEvent());
        document.getElementById('logic-settings-save').addEventListener('click', () => this.saveLogicData());
        document.getElementById('event-trigger-type').addEventListener('change', (e) => this.renderTriggerParams(e.target.value));
        document.getElementById('delete-event-btn').addEventListener('click', () => this.deleteSelectedEvent());
        document.getElementById('add-action-btn').addEventListener('click', () => this.addNewAction());

        // Location Settings
        document.getElementById('location-settings-save').addEventListener('click', () => this.saveLocationSettings());
        document.getElementById('location-settings-cancel').addEventListener('click', () => this.closeLocationSettings());
        document.getElementById('location-settings-delete').addEventListener('click', () => this.deleteLocation());

        // Item Settings
        document.getElementById('item-settings-save').addEventListener('click', () => this.saveItemSettings());
        document.getElementById('item-settings-cancel').addEventListener('click', () => this.closeItemSettings());
        document.getElementById('item-settings-delete').addEventListener('click', () => this.deleteItem());

        // Generic Block Settings
        document.getElementById('block-settings-save').addEventListener('click', () => this.saveBlockSettings());
        document.getElementById('block-settings-cancel').addEventListener('click', () => this.closeBlockSettings());

        this.updatePaletteFilter();
        document.getElementById('export-btn').addEventListener('click', () => this.exportArray());
        document.getElementById('import-btn').addEventListener('click', () => this.importArray());
        document.getElementById('test-editor-btn').addEventListener('click', () => this.testCurrentMap());
        document.getElementById('save-map-btn').addEventListener('click', () => this.saveMap());
        document.getElementById('clear-editor-btn').addEventListener('click', () => {
            if(confirm("정말 모든 타일을 삭제하시겠습니까?")) {
                this.tiles.clear();
                const output = document.getElementById('export-output');
                if (output) output.value = '';
            }
        });
    }

    getUnitSize(id) {
        if (id === 'v_tank') return { w: 2, h: 2 };
        if (id === 'v_apc') return { w: 2, h: 2 };
        if (id === 'v_truck') return { w: 2, h: 2 };
        if (id === 'v_train') return { w: 2, h: 1 };
        if (id === 'v_transport_ship') return { w: 3, h: 2 };
        if (id === 'v_transport_plane') return { w: 3, h: 3 };
        return { w: 1, h: 1 };
    }

    getTileSize(id) {
        const tiles = this.game.assetManager.getData('tiles') || [];
        const tile = tiles.find(t => t.id === id);
        return { w: tile?.width || 1, h: tile?.height || 1 };
    }

    selectTool(tool) {
        document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(el => el.classList.remove('selected'));
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) btn.classList.add('selected');
        if (['rect', 'circle', 'triangle'].includes(tool)) {
            document.getElementById('tool-shape-main').classList.add('selected');
        }
        this.selectedTool = tool;
    }

    updatePaletteFilter() {
        const palette = document.getElementById('tile-palette');
        if (!palette) return;
        palette.innerHTML = '';
        
        const addHeader = (text) => {
            const h = document.createElement('div');
            h.style.width = '100%';
            h.style.padding = '8px 5px';
            h.style.fontSize = '12px';
            h.style.color = '#aaa';
            h.style.background = '#222';
            h.style.marginBottom = '5px';
            h.style.borderLeft = '3px solid #f1c40f';
            h.style.gridColumn = '1 / -1'; // Grid layout 지원용
            h.innerText = text;
            palette.appendChild(h);
        };

        if (this.activeLayer === 'units') {
            const enemies = this.game.assetManager.getData('enemies') || [];
            if (enemies.length > 0) {
                addHeader('👥 인명 유닛');
                enemies.forEach(enemy => {
                    const div = document.createElement('div');
                    div.className = 'palette-tile';
                    if (enemy.id === this.selectedTileId) div.classList.add('selected');
                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = 50; previewCanvas.height = 50;
                    const pCtx = previewCanvas.getContext('2d');
                    pCtx.fillStyle = enemy.color || '#e74c3c';
                    pCtx.beginPath(); pCtx.arc(25, 25, 15, 0, Math.PI * 2); pCtx.fill();
                    pCtx.strokeStyle = '#fff'; pCtx.lineWidth = 2; pCtx.stroke();
                    div.appendChild(previewCanvas);
                    div.title = enemy.name;
                    div.addEventListener('click', () => this.selectTile(enemy.id, div));
                    palette.appendChild(div);
                });
            }

                        const landVehicles = [
                            { id: 'v_truck', name: '군용 트럭', color: '#4b5320' },
                            { id: 'v_tank', name: '전차 (Tank)', color: '#1e8449' },
                            { id: 'v_apc', name: '장갑차 (APC)', color: '#34495e' },
                            { id: 'v_train', name: '열차 (Train)', color: '#2c3e50' }
                        ];
                        const seaVehicles = [
                            { id: 'v_transport_ship', name: '운반선 (Carrier)', color: '#2c3e50' }
                        ];
                        const airVehicles = [
                            { id: 'v_transport_plane', name: '수송기 (Plane)', color: '#7f8c8d' }
                        ]; 
                        
                        if (landVehicles.length > 0) {
                            addHeader('🚜 지상 이동수단');
                            landVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                        if (seaVehicles.length > 0) {
                            addHeader('🚢 해상 이동수단');
                            seaVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                        if (airVehicles.length > 0) {
                            addHeader('🚁 공중 이동수단');
                            airVehicles.forEach(v => this.createVehiclePaletteTile(v, palette));
                        }
                    } else if (this.activeLayer === 'items') {                    const items = this.game.assetManager.getData('items') || [];
                    
                    const weapons = items.filter(i => i.type === 'weapon');
                    const ammos = items.filter(i => i.type === 'ammo');
                    const consumables = items.filter(i => i.type === 'consumable' || i.type === 'grenade'); // Include grenades
                    const others = items.filter(i => i.type !== 'weapon' && i.type !== 'ammo' && i.type !== 'consumable' && i.type !== 'grenade');
        
                    if (weapons.length > 0) {
                        const melee = weapons.filter(w => w.subType === 'melee');
                        const pistols = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '9mm' || w.caliber === '.50 AE' || w.caliber === '.357'));
                        const rifles = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '5.56mm' || w.caliber === '7.62mm') && w.magSize > 10 && w.fireRate < 0.2);
                        const snipers = weapons.filter(w => ['ranged'].includes(w.subType) && (w.caliber === '.338' || w.caliber === '7.62mm') && w.fireRate >= 0.4);
                        const shotguns = weapons.filter(w => w.caliber === '12g');
                        const heavy = weapons.filter(w => w.caliber === 'rocket' || w.caliber === '40mm' || w.magSize >= 100);
        
                        if (melee.length > 0) { addHeader('🗡️ 근접 무기'); melee.forEach(i => this.createPaletteTile(i, palette)); }
                        if (pistols.length > 0) { addHeader('🔫 권총'); pistols.forEach(i => this.createPaletteTile(i, palette)); }
                        if (rifles.length > 0) { addHeader('🔫 소총 / 기관단총'); rifles.forEach(i => this.createPaletteTile(i, palette)); }
                        if (snipers.length > 0) { addHeader('🔭 저격 / 지정사수'); snipers.forEach(i => this.createPaletteTile(i, palette)); }
                        if (shotguns.length > 0) { addHeader('🧱 산탄총'); shotguns.forEach(i => this.createPaletteTile(i, palette)); }
                        if (heavy.length > 0) { addHeader('🚀 중화기 / 폭발물'); heavy.forEach(i => this.createPaletteTile(i, palette)); }
                    }
        
                    if (ammos.length > 0) {
                        addHeader('📦 탄약');
                        ammos.forEach(i => this.createPaletteTile(i, palette));
                    }
        
                    if (consumables.length > 0) {
                        const partsIds = ['iron_ingot', 'wood_plank', 'spring', 'pistol_grip', 'short_barrel', 'long_barrel', 'ar_receiver', 'ak_receiver', 'smg_receiver', 'bolt_action_parts', 'shotgun_parts', 'explosive_material'];
                        const materials = consumables.filter(c => partsIds.includes(c.id));
                        const realConsumables = consumables.filter(c => !partsIds.includes(c.id));
        
                        if (materials.length > 0) {
                            addHeader('🛠️ 제작 재료 / 부품');
                            materials.forEach(i => this.createPaletteTile(i, palette));
                        }
                        if (realConsumables.length > 0) {
                            addHeader('💊 일반 소모품 / 폭발물');
                            realConsumables.forEach(i => this.createPaletteTile(i, palette));
                        }
                    }
        
            
            if (others.length > 0) {
                // 기타 아이템들 (장비 등)
                const equipment = others.filter(o => o.type === 'equipment');
                const attachments = others.filter(o => o.type === 'attachment');
                
                if (equipment.length > 0) { addHeader('👕 개인 장비'); equipment.forEach(i => this.createPaletteTile(i, palette)); }
                if (attachments.length > 0) { addHeader('🔍 총기 부착물'); attachments.forEach(i => this.createPaletteTile(i, palette)); }
            }
        } else if (this.activeLayer === 'block') {
            const tiles = this.game.assetManager.getData('tiles') || [];
            // Filter: must be in block layer AND not explicitly hidden from palette
            const blocks = tiles.filter(t => t.layer === 'block' && t.showInPalette !== false);
            
            const structures = blocks.filter(b => b.width > 1 || b.height > 1);
            const props = blocks.filter(b => (b.width || 1) === 1 && (b.height || 1) === 1 && !b.interactable);
            const interactable = blocks.filter(b => b.interactable);

            if (structures.length > 0) {
                addHeader('🏢 대형 구조물 및 시설');
                structures.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (props.length > 0) {
                addHeader('🧱 일반 블록 및 소품');
                props.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (interactable.length > 0) {
                addHeader('🖱️ 상호작용 가능');
                interactable.forEach(tile => this.createPaletteTile(tile, palette));
            }
        } else if (this.activeLayer === 'floor') {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const floors = tiles.filter(t => t.layer === 'floor');

            const natural = floors.filter(f => !f.id.includes('runway') && !f.id.includes('road') && !f.id.includes('sidewalk') && !f.id.includes('crosswalk') && !f.id.includes('asphalt'));
            const road = floors.filter(f => f.id.includes('road') || f.id === 'asphalt' || f.id === 'crosswalk');
            const sidewalk = floors.filter(f => f.id.includes('sidewalk'));
            const runway = floors.filter(f => f.id.includes('runway'));

            if (natural.length > 0) {
                addHeader('🌿 자연 및 기본 지형');
                natural.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (road.length > 0) {
                addHeader('🛣️ 도로 및 교통');
                road.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (sidewalk.length > 0) {
                addHeader('🚶 인도 및 보도');
                sidewalk.forEach(tile => this.createPaletteTile(tile, palette));
            }
            if (runway.length > 0) {
                addHeader('🛫 활주로 시설');
                runway.forEach(tile => this.createPaletteTile(tile, palette));
            }
        } else {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const filtered = tiles.filter(t => t.layer === this.activeLayer);
            filtered.forEach(tile => this.createPaletteTile(tile, palette));
        }
    }

    createPaletteTile(tile, container) {
        const div = document.createElement('div');
        div.className = 'palette-tile';
        if (tile.id === this.selectedTileId) div.classList.add('selected');

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 50; previewCanvas.height = 50;
        const pCtx = previewCanvas.getContext('2d');

        const img = this.game.assetManager.get(tile.id);
        if (img) {
            pCtx.drawImage(img, 5, 5, 40, 40);
        } else {
            pCtx.fillStyle = tile.color || '#555';
            pCtx.fillRect(10, 10, 30, 30);
            pCtx.strokeStyle = '#fff';
            pCtx.lineWidth = 1;
            pCtx.strokeRect(10, 10, 30, 30);
        }

        div.appendChild(previewCanvas);
        div.title = tile.name || tile.id;
        div.addEventListener('click', () => this.selectTile(tile.id, div));
        container.appendChild(div);
    }

    createVehiclePaletteTile(v, palette) {
        const div = document.createElement('div');
        div.className = 'palette-tile';
        if (v.id === this.selectedTileId) div.classList.add('selected');
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 50; previewCanvas.height = 50;
        const pCtx = previewCanvas.getContext('2d');
        pCtx.fillStyle = v.color; 
        pCtx.fillRect(10, 15, 30, 20);
        pCtx.strokeStyle = '#fff'; pCtx.lineWidth = 2; pCtx.strokeRect(10, 15, 30, 20);
        div.appendChild(previewCanvas);
        div.title = v.name;
        div.addEventListener('click', () => this.selectTile(v.id, div));
        palette.appendChild(div);
    }

    selectTile(id, element) {
        document.querySelectorAll('.palette-tile').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedTileId = id; 
        
        // Auto-reset rotation for non-rotatable tiles
        const tiles = this.game.assetManager.getData('tiles') || [];
        const def = tiles.find(t => t.id === id);
        if (def && def.rotatable === false) {
            this.currentRotation = 0;
            console.log(`Rotation reset to 0° for non-rotatable tile: ${id}`);
        }

        if (this.selectedTool === 'eraser') this.selectTool('pen');
    }

    isCellEmpty(cell) {
        return cell.floor === null && cell.block === null && cell.unit === null && cell.item === null;
    }

    getTileAt(x, y) {
        return this.tiles.get(`${x},${y}`) || { floor: null, block: null, unit: null, item: null, metadata: null };
    }

    setTileAt(x, y, tileId, layer, phase = 'start') {
        const key = `${x},${y}`;
        const cell = this.tiles.get(key) || { floor: null, block: null, unit: null, item: null, metadata: null };
        
        if (tileId === null) {
            if (layer === 'items') {
                cell.item = null;
            } else if (layer === 'units') {
                const unit = cell.unit;
                if (!unit) return;
                let masterKey = key;
                if (unit.id === 'occupied_space') masterKey = unit.master || key;
                
                const [mx, my] = masterKey.split(',').map(Number);
                const masterCell = this.tiles.get(masterKey);
                const mUnit = masterCell?.unit;
                if (mUnit) {
                    const { w, h } = this.getUnitSize(mUnit.id);
                    for (let oy = 0; oy < h; oy++) {
                        for (let ox = 0; ox < w; ox++) {
                            const tKey = `${mx + ox},${my + oy}`;
                            const tCell = this.tiles.get(tKey);
                            if (tCell) {
                                tCell.unit = null;
                                if (this.isCellEmpty(tCell)) this.tiles.delete(tKey);
                            }
                        }
                    }
                } else {
                    cell.unit = null;
                }
            } else {
                const current = cell[layer];
                if (!current) return;
                let masterKey = key;
                if (current === 'occupied_space') masterKey = cell.metadata?.[layer + 'Master'] || key;

                const [mx, my] = masterKey.split(',').map(Number);
                const masterCell = this.tiles.get(masterKey);
                const mItem = masterCell?.[layer];
                if (mItem) {
                    const metadata = masterCell.metadata || {};
                    const rot = (metadata[layer + 'Rotation'] || 0);
                    const baseSize = this.getTileSize(mItem);
                    const isRotated = (rot === 90 || rot === 270);
                    const ew = isRotated ? baseSize.h : baseSize.w;
                    const eh = isRotated ? baseSize.w : baseSize.h;

                    for (let oy = 0; oy < eh; oy++) {
                        for (let ox = 0; ox < ew; ox++) {
                            const tKey = `${mx + ox},${my + oy}`;
                            const tCell = this.tiles.get(tKey);
                            if (tCell) {
                                tCell[layer] = null;
                                if (tCell.metadata) delete tCell.metadata[layer + 'Master'];
                                if (this.isCellEmpty(tCell)) this.tiles.delete(tKey);
                            }
                        }
                    }
                } else {
                    cell[layer] = null;
                }
            }
            if (this.isCellEmpty(cell)) this.tiles.delete(key);
            return;
        }

        const baseSize = (layer === 'units') ? this.getUnitSize(tileId) : this.getTileSize(tileId);
        const isRotated = (this.currentRotation === 90 || this.currentRotation === 270);
        const ew = isRotated ? baseSize.h : baseSize.w;
        const eh = isRotated ? baseSize.w : baseSize.h;

        // --- UNIQUE BLOCK HANDLING (e.g. Player Spawn) ---
        if (layer === 'block' && tileId) {
            const tiles = this.game.assetManager.getData('tiles') || [];
            const def = tiles.find(t => t.id === tileId);
            if (def && def.isUnique) {
                // Find and remove any existing tile with the same ID
                this.tiles.forEach((existingCell, existingKey) => {
                    if (existingCell.block === tileId) {
                        const [ex, ey] = existingKey.split(',').map(Number);
                        this.setTileAt(ex, ey, null, 'block');
                    }
                });
            }
        }

        // Train Placement Restriction: Only allow on rails
        if (layer === 'units' && tileId === 'v_train') {
            for (let oy = 0; oy < eh; oy++) {
                for (let ox = 0; ox < ew; ox++) {
                    const targetCell = this.getTileAt(x + ox, y + oy);
                    const isRail = targetCell.block && (targetCell.block === 'rail' || targetCell.block.startsWith('rail_'));
                    if (!isRail) {
                        console.log("Trains can only be placed on rails!");
                        return;
                    }
                }
            }
        }

        if (ew > 1 || eh > 1 || (layer === 'units' || layer === 'block')) {
            for (let oy = 0; oy < eh; oy++) {
                for (let ox = 0; ox < ew; ox++) {
                    const tKey = `${x + ox},${y + oy}`;
                    const tCell = this.tiles.get(tKey);
                    if (tCell) {
                        // 1. If placing a unit
                        if (layer === 'units') {
                            // Don't overlap with other units
                            if (tCell.unit !== null) return;
                            // Only block if existing block is collidable
                            if (tCell.block !== null) {
                                const bDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tCell.block);
                                if (bDef && bDef.collidable !== false) return;
                            }
                        }
                        // 2. If placing a block
                        if (layer === 'block') {
                            // Don't overlap with other blocks
                            if (tCell.block !== null) return;
                            // Only block if placing a collidable block where a unit exists
                            const newBDef = this.game.assetManager.getData('tiles')?.find(t => t.id === tileId);
                            if (tCell.unit !== null && newBDef && newBDef.collidable !== false) return;
                        }
                    }
                }
            }
        }

        if (ew > 1 || eh > 1) {
            if (phase !== 'start') return;
            for (let oy = 0; oy < eh; oy++) {
                for (let ox = 0; ox < ew; ox++) {
                    const tKey = `${x + ox},${y + oy}`;
                    const tCell = this.tiles.get(tKey) || { floor: null, block: null, unit: null, item: null, metadata: null };
                    if (ox === 0 && oy === 0) {
                        if (layer === 'units') {
                            const rotRad = this.currentRotation * (Math.PI / 180);
                            tCell.unit = { 
                                id: tileId, 
                                w: ew, 
                                h: eh, 
                                angle: rotRad, // Initial direction
                                command: 'GUARD', 
                                patrolRadius: 250, 
                                healthMult: 1.0, 
                                damageMult: 1.0, 
                                speedMult: 1.0 
                            };
                        } else {
                            tCell[layer] = tileId;
                            if (!tCell.metadata) tCell.metadata = {};
                            tCell.metadata[layer + 'Rotation'] = this.currentRotation;
                            if (layer === 'block' && tileId === 'loot_box' && !tCell.metadata.lootTable) tCell.metadata.lootTable = [];
                        }
                    } else {
                        if (layer === 'units') {
                            tCell.unit = { id: 'occupied_space', master: key };
                        } else {
                            tCell[layer] = 'occupied_space';
                            if (!tCell.metadata) tCell.metadata = {};
                            tCell.metadata[layer + 'Master'] = key;
                        }
                    }
                    this.tiles.set(tKey, tCell);
                }
            }
            return;
        }

        if (layer === 'units') {
            cell.unit = { id: tileId, command: 'GUARD', patrolRadius: 250, healthMult: 1.0, damageMult: 1.0, speedMult: 1.0 };
        } else if (layer === 'items') {
            const itemId = (typeof tileId === 'object') ? tileId.id : tileId;
            const count = (typeof tileId === 'object') ? (tileId.count || 1) : 1;
            cell.item = { id: itemId, count: count };
        } else {
            cell[layer] = tileId;
            if (!cell.metadata) cell.metadata = {};
            cell.metadata[layer + 'Rotation'] = this.currentRotation;
            if (layer === 'block' && tileId === 'loot_box' && !cell.metadata.lootTable) cell.metadata.lootTable = [];
        }
        this.tiles.set(key, cell);
    }

    openLootSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (cell.block !== 'loot_box') return;
        this.editingLootPos = { x: gx, y: gy };
        const list = document.getElementById('loot-entries-list');
        list.innerHTML = '';
        document.getElementById('loot-box-settings-modal').classList.remove('hidden');
        const lootTable = cell.metadata?.lootTable || [];
        lootTable.forEach(entry => this.addLootEntry(entry.id, entry.chance));
        if (lootTable.length === 0) this.addLootEntry('', 100);
    }

    addLootEntry(selectedId = '', chance = 100) {
        const list = document.getElementById('loot-entries-list');
        const div = document.createElement('div');
        div.className = 'loot-entry';
        const items = this.game.assetManager.getData('items') || [];
        let optionsHtml = '<option value="">-- 아이템 선택 --</option>';
        items.forEach(item => { optionsHtml += `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.name} (${item.id})</option>`; });
        div.innerHTML = `<select class="loot-item-id">${optionsHtml}</select><input type="number" class="loot-item-chance" value="${chance}" min="0" max="100"><button class="remove-entry-btn">×</button>`;
        div.querySelector('.remove-entry-btn').addEventListener('click', () => div.remove());
        list.appendChild(div);
    }

    saveLootSettings() {
        if (!this.editingLootPos) return;
        const cell = this.getTileAt(this.editingLootPos.x, this.editingLootPos.y);
        const lootTable = [];
        document.querySelectorAll('.loot-entry').forEach(div => {
            const id = div.querySelector('.loot-item-id').value.trim();
            const chance = parseInt(div.querySelector('.loot-item-chance').value);
            if (id) lootTable.push({ id, chance });
        });
        cell.metadata = { ...cell.metadata, lootTable };
        this.closeLootSettings();
    }

    closeLootSettings() { document.getElementById('loot-box-settings-modal').classList.add('hidden'); this.editingLootPos = null; }

    openItemSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.item) return;
        this.editingItemPos = { x: gx, y: gy };
        const modal = document.getElementById('item-settings-modal');
        const countInput = document.getElementById('item-count-input');
        const tagInput = document.getElementById('item-tag');
        modal.classList.remove('hidden');
        
        const itemId = (typeof cell.item === 'string') ? cell.item : cell.item.id;
        const itemCount = (typeof cell.item === 'string') ? 1 : (cell.item.count || 1);
        const itemTag = (typeof cell.item === 'object') ? (cell.item.tag || '') : '';
        
        const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === itemId);
        const isWeapon = itemDef?.type === 'weapon';
        countInput.value = isWeapon ? 1 : itemCount;
        countInput.disabled = isWeapon; 
        if (tagInput) tagInput.value = itemTag;
    }

    saveItemSettings() {
        if (!this.editingItemPos) return;
        const cell = this.getTileAt(this.editingItemPos.x, this.editingItemPos.y);
        const countInput = document.getElementById('item-count-input');
        const tagInput = document.getElementById('item-tag');
        const itemId = (typeof cell.item === 'string') ? cell.item : cell.item.id;
        cell.item = { id: itemId, count: parseInt(countInput.value) || 1, tag: tagInput.value.trim() };
        this.closeItemSettings();
    }

    closeItemSettings() {
        document.getElementById('item-settings-modal').classList.add('hidden');
        this.editingItemPos = null;
    }

    // --- GENERIC BLOCK SETTINGS ---
    openBlockSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.block || cell.block === 'occupied_space') return;
        this.editingBlockPos = { x: gx, y: gy };
        document.getElementById('block-tag').value = cell.metadata?.tag || '';
        document.getElementById('block-settings-modal').classList.remove('hidden');
    }

    saveBlockSettings() {
        if (!this.editingBlockPos) return;
        const cell = this.getTileAt(this.editingBlockPos.x, this.editingBlockPos.y);
        if (!cell.metadata) cell.metadata = {};
        cell.metadata.tag = document.getElementById('block-tag').value.trim();
        this.closeBlockSettings();
    }

    closeBlockSettings() {
        document.getElementById('block-settings-modal').classList.add('hidden');
        this.editingBlockPos = null;
    }

    deleteItem() {
        if (!this.editingItemPos) return;
        const cell = this.getTileAt(this.editingItemPos.x, this.editingItemPos.y);
        cell.item = null;
        if (cell.floor === null && cell.block === null && cell.unit === null && cell.item === null) {
            this.tiles.delete(`${this.editingItemPos.x},${this.editingItemPos.y}`);
        }
        this.closeItemSettings();
    }

    openUnitSettings(gx, gy) {
        const cell = this.getTileAt(gx, gy);
        if (!cell.unit) return;
        this.editingUnitPos = { x: gx, y: gy };
        document.getElementById('unit-settings-modal').classList.remove('hidden');
        document.getElementById('unit-tag').value = cell.unit.tag || '';
        document.getElementById('unit-command').value = cell.unit.command || 'GUARD';
        document.getElementById('unit-patrol-radius').value = cell.unit.patrolRadius || 250;
        document.getElementById('unit-health-mult').value = cell.unit.healthMult || 1.0;
        document.getElementById('unit-damage-mult').value = cell.unit.damageMult || 1.0;
        document.getElementById('unit-speed-mult').value = cell.unit.speedMult || 1.0;
    }

    saveUnitSettings() {
        if (!this.editingUnitPos) return;
        const cell = this.getTileAt(this.editingUnitPos.x, this.editingUnitPos.y);
        if (cell.unit) {
            cell.unit.tag = document.getElementById('unit-tag').value.trim();
            cell.unit.command = document.getElementById('unit-command').value;
            cell.unit.patrolRadius = parseInt(document.getElementById('unit-patrol-radius').value);
            cell.unit.healthMult = parseFloat(document.getElementById('unit-health-mult').value);
            cell.unit.damageMult = parseFloat(document.getElementById('unit-damage-mult').value);
            cell.unit.speedMult = parseFloat(document.getElementById('unit-speed-mult').value);
        }
        this.closeUnitSettings();
    }

    closeUnitSettings() { document.getElementById('unit-settings-modal').classList.add('hidden'); this.editingUnitPos = null; }
    deleteUnit() { if (!this.editingUnitPos) return; this.setTileAt(this.editingUnitPos.x, this.editingUnitPos.y, null, 'units'); this.closeUnitSettings(); }

    // --- MAP LOGIC SYSTEM ---
    openLogicModal() {
        document.getElementById('map-logic-modal').classList.remove('hidden');
        this.renderEventList();
    }

    closeLogicModal() {
        document.getElementById('map-logic-modal').classList.add('hidden');
    }

    renderEventList() {
        const list = document.getElementById('event-list');
        list.innerHTML = '';
        this.mapLogic.events.forEach((evt, index) => {
            const div = document.createElement('div');
            div.className = `event-item ${this.selectedEventIndex === index ? 'active' : ''}`;
            div.innerText = evt.name || `이벤트 #${index + 1}`;
            div.onclick = () => this.selectEvent(index);
            list.appendChild(div);
        });
    }

    addNewEvent() {
        const newEvent = {
            name: "새 이벤트",
            trigger: { type: "ON_START", params: {} },
            conditions: [],
            actions: []
        };
        this.mapLogic.events.push(newEvent);
        this.selectedEventIndex = this.mapLogic.events.length - 1;
        this.renderEventList();
        this.renderEventEditor();
    }

    deleteSelectedEvent() {
        if (this.selectedEventIndex === -1) return;
        if (confirm("정말 이 이벤트를 삭제하시겠습니까?")) {
            this.mapLogic.events.splice(this.selectedEventIndex, 1);
            this.selectedEventIndex = -1;
            this.renderEventList();
            this.renderEventEditor();
        }
    }

    selectEvent(index) {
        this.selectedEventIndex = index;
        this.renderEventList();
        this.renderEventEditor();
    }

    renderEventEditor() {
        const details = document.getElementById('event-editor-details');
        const empty = document.getElementById('logic-empty-state');
        
        if (this.selectedEventIndex === -1) {
            details.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        details.classList.remove('hidden');
        empty.classList.add('hidden');

        const evt = this.mapLogic.events[this.selectedEventIndex];
        document.getElementById('event-name').value = evt.name;
        document.getElementById('event-trigger-type').value = evt.trigger.type;
        this.renderTriggerParams(evt.trigger.type, evt.trigger.params);
        this.renderEventActions();
    }

    renderTriggerParams(type, currentParams = {}) {
        // ... (previous logic for ON_ENTER_AREA)
        const container = document.getElementById('trigger-params');
        container.innerHTML = '';
        container.style.marginTop = '10px';

        if (type === 'ON_ENTER_AREA') {
            const label = document.createElement('label');
            label.innerText = '대상 영역 선택: ';
            const select = document.createElement('select');
            select.id = 'param-trigger-location-id';
            
            if (this.locations.length === 0) {
                const opt = document.createElement('option');
                opt.innerText = '-- 먼저 Location을 만드세요 --';
                select.appendChild(opt);
            } else {
                this.locations.forEach(loc => {
                    const opt = document.createElement('option');
                    opt.value = loc.id;
                    opt.innerText = loc.name;
                    if (currentParams.locationId === loc.id) opt.selected = true;
                    select.appendChild(opt);
                });
            }
            container.appendChild(label);
            container.appendChild(select);
        }
    }

    addNewAction() {
        if (this.selectedEventIndex === -1) return;
        const newAction = {
            type: "SPAWN_UNIT",
            params: { unitId: "soldier", x: 0, y: 0 }
        };
        this.mapLogic.events[this.selectedEventIndex].actions.push(newAction);
        this.renderEventActions();
    }

    renderEventActions() {
        const container = document.getElementById('event-actions-list');
        container.innerHTML = '';
        const evt = this.mapLogic.events[this.selectedEventIndex];

        evt.actions.forEach((action, index) => {
            const div = document.createElement('div');
            div.className = 'logic-section action-item';
            div.style.borderLeft = '3px solid #3498db';
            
            let html = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <select class="action-type-select" data-index="${index}">
                        <option value="SPAWN_UNIT" ${action.type === 'SPAWN_UNIT' ? 'selected' : ''}>유닛 소환</option>
                        <option value="SPAWN_ITEM" ${action.type === 'SPAWN_ITEM' ? 'selected' : ''}>아이템 소환</option>
                        <option value="SHOW_MESSAGE" ${action.type === 'SHOW_MESSAGE' ? 'selected' : ''}>메시지 표시</option>
                    </select>
                    <button class="remove-action-btn" data-index="${index}" style="background:#e74c3c; padding:2px 8px;">×</button>
                </div>
                <div class="action-params" data-index="${index}">
            `;

            if (action.type === 'SPAWN_UNIT') {
                const enemies = this.game.assetManager.getData('enemies') || [];
                let enemyOptions = enemies.map(e => `<option value="${e.id}" ${action.params.unitId === e.id ? 'selected' : ''}>${e.name}</option>`).join('');
                html += `
                    <label>유닛: <select class="param-unit-id">${enemyOptions}</select></label><br>
                    <label>타일 X: <input type="number" class="param-x" value="${action.params.x || 0}" style="width:60px;"></label>
                    <label> Y: <input type="number" class="param-y" value="${action.params.y || 0}" style="width:60px;"></label>
                `;
            } else if (action.type === 'SPAWN_ITEM') {
                const items = this.game.assetManager.getData('items') || [];
                let itemOptions = items.map(i => `<option value="${i.id}" ${action.params.itemId === i.id ? 'selected' : ''}>${i.name}</option>`).join('');
                html += `
                    <label>아이템: <select class="param-item-id">${itemOptions}</select></label><br>
                    <label>수량: <input type="number" class="param-count" value="${action.params.count || 1}" style="width:50px;"></label><br>
                    <label>타일 X: <input type="number" class="param-x" value="${action.params.x || 0}" style="width:60px;"></label>
                    <label> Y: <input type="number" class="param-y" value="${action.params.y || 0}" style="width:60px;"></label>
                `;
            } else if (action.type === 'SHOW_MESSAGE') {
                html += `<label>내용: <input type="text" class="param-text" value="${action.params.text || ''}" style="width:100%;"></label>`;
            }

            html += `</div>`;
            div.innerHTML = html;

            // Listeners
            div.querySelector('.action-type-select').onchange = (e) => {
                action.type = e.target.value;
                this.renderEventActions();
            };
            div.querySelector('.remove-action-btn').onclick = () => {
                evt.actions.splice(index, 1);
                this.renderEventActions();
            };

            container.appendChild(div);
        });
    }

    saveLogicData() {
        if (this.selectedEventIndex === -1) return;
        const evt = this.mapLogic.events[this.selectedEventIndex];
        evt.name = document.getElementById('event-name').value;
        evt.trigger.type = document.getElementById('event-trigger-type').value;
        
        // Save Trigger Params
        evt.trigger.params = {};
        if (evt.trigger.type === 'ON_ENTER_AREA') {
            const locSelect = document.getElementById('param-trigger-location-id');
            if (locSelect) evt.trigger.params.locationId = locSelect.value;
        }

        // Save Actions Params
        const actionDivs = document.querySelectorAll('.action-item');
        evt.actions = [];
        actionDivs.forEach(div => {
            const type = div.querySelector('.action-type-select').value;
            const params = {};
            if (type === 'SPAWN_UNIT') {
                params.unitId = div.querySelector('.param-unit-id').value;
                params.x = parseInt(div.querySelector('.param-x').value);
                params.y = parseInt(div.querySelector('.param-y').value);
            } else if (type === 'SPAWN_ITEM') {
                params.itemId = div.querySelector('.param-item-id').value;
                params.count = parseInt(div.querySelector('.param-count').value) || 1;
                params.x = parseInt(div.querySelector('.param-x').value);
                params.y = parseInt(div.querySelector('.param-y').value);
            } else if (type === 'SHOW_MESSAGE') {
                params.text = div.querySelector('.param-text').value;
            }
            evt.actions.push({ type, params });
        });

        alert("이벤트 데이터가 임시 저장되었습니다.");
        this.renderEventList();
    }

    // --- LOCATION SETTINGS ---
    addNewLocation(x, y, w, h) {
        const newLoc = {
            id: 'loc_' + Date.now(),
            name: '새 구역 ' + (this.locations.length + 1),
            x, y, w, h
        };
        this.locations.push(newLoc);
    }

    openLocationSettings(index) {
        this.editingLocationIndex = index;
        const loc = this.locations[index];
        document.getElementById('location-name').value = loc.name;
        document.getElementById('location-settings-modal').classList.remove('hidden');
    }

    saveLocationSettings() {
        if (this.editingLocationIndex !== -1) {
            this.locations[this.editingLocationIndex].name = document.getElementById('location-name').value;
        }
        this.closeLocationSettings();
    }

    closeLocationSettings() {
        document.getElementById('location-settings-modal').classList.add('hidden');
        this.editingLocationIndex = -1;
    }

    deleteLocation() {
        if (this.editingLocationIndex !== -1) {
            this.locations.splice(this.editingLocationIndex, 1);
        }
        this.closeLocationSettings();
    }

    update(dt) {
        if (this.game.gameState !== 'EDITOR') return;
        
        // Block all interaction if ANY modal is open
        const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
        const isModalOpen = visibleModals.length > 0;
        
        const input = this.game.input; 
        const mx = input.mouse.x; 
        const my = input.mouse.y;
        const ts = this.baseTileSize * this.zoom;
        const gx = Math.floor((mx - this.offsetX) / ts); 
        const gy = Math.floor((my - this.offsetY) / ts);
        
        let isOverUI = mx > this.game.canvas.width - 300;
        if (isModalOpen) isOverUI = true; 
        
        if (input.mouse.rightDown && !isOverUI) {
            const dx = mx - this.lastMousePos.x; const dy = my - this.lastMousePos.y;
            this.offsetX += dx; this.offsetY += dy;
            this.rightClickMoveDist = (this.rightClickMoveDist || 0) + Math.sqrt(dx*dx + dy*dy);
        } else if (this.lastRightDown && !input.mouse.rightDown && !isOverUI && !isModalOpen) {
            if ((this.rightClickMoveDist || 0) < 5) {
                // Check if clicked a location area
                const locIdx = this.locations.findIndex(loc => gx >= loc.x && gx < loc.x + loc.w && gy >= loc.y && gy < loc.y + loc.h);
                if (locIdx !== -1) {
                    this.openLocationSettings(locIdx);
                } else {
                    const cell = this.getTileAt(gx, gy);
                    if (cell.unit && !cell.unit.id.startsWith('v_')) this.openUnitSettings(gx, gy);
                    else if (cell.block === 'loot_box') this.openLootSettings(gx, gy);
                    else if (cell.block && cell.block !== 'occupied_space') this.openBlockSettings(gx, gy);
                    else if (cell.item) this.openItemSettings(gx, gy);
                }
            }
            this.rightClickMoveDist = 0;
        }
        this.lastRightDown = input.mouse.rightDown; this.lastMousePos = { x: mx, y: my };
        if (input.wheel !== 0 && !isOverUI) {
            const oldZoom = this.zoom;
            this.zoom = Math.max(0.2, Math.min(5.0, this.zoom + (input.wheel > 0 ? -0.1 : 0.1)));
            const factor = this.zoom / oldZoom;
            this.offsetX = mx - (mx - this.offsetX) * factor; this.offsetY = my - (my - this.offsetY) * factor;
        }
        if (input.mouse.leftDown && !isOverUI && !isModalOpen) {
            const phase = !this.isDrawing ? 'start' : 'drag';
            this.handleToolAction(gx, gy, phase);
            this.isDrawing = true;
        } else { if (this.isDrawing) this.handleToolAction(gx, gy, 'end'); this.isDrawing = false; }
    }

    handleToolAction(gx, gy, phase) {
        const tileId = this.selectedTool === 'eraser' ? null : this.selectedTileId;
        const layer = this.activeLayer;

        // --- LOCATION LAYER HANDLING ---
        if (layer === 'location') {
            if (this.selectedTool === 'pen' || this.selectedTool === 'rect') {
                if (phase === 'start') {
                    this.rectStart = { x: gx, y: gy };
                } else if (phase === 'end' && this.rectStart) {
                    const x = Math.min(this.rectStart.x, gx);
                    const y = Math.min(this.rectStart.y, gy);
                    const w = Math.abs(gx - this.rectStart.x) + 1;
                    const h = Math.abs(gy - this.rectStart.y) + 1;
                    
                    this.addNewLocation(x, y, w, h);
                    this.rectStart = null;
                }
            } else if (this.selectedTool === 'eraser' && phase === 'start') {
                const idx = this.locations.findIndex(loc => gx >= loc.x && gx < loc.x + loc.w && gy >= loc.y && gy < loc.y + loc.h);
                if (idx !== -1) this.locations.splice(idx, 1);
            }
            return;
        }

        switch (this.selectedTool) {
            case 'pen': case 'eraser': this.setTileAt(gx, gy, tileId, layer, phase); break;
            case 'fill': if (phase === 'start') this.floodFill(gx, gy, this.getTileAt(gx, gy)[layer], tileId, layer); break;
            case 'rect': case 'circle': case 'triangle':
                if (phase === 'start') this.rectStart = { x: gx, y: gy };
                else if (phase === 'end' && this.rectStart) {
                    const x1 = Math.min(this.rectStart.x, gx), x2 = Math.max(this.rectStart.x, gx);
                    const y1 = Math.min(this.rectStart.y, gy), y2 = Math.max(this.rectStart.y, gy);
                    for (let y = y1; y <= y2; y++) {
                        for (let x = x1; x <= x2; x++) {
                            if (this.selectedTool === 'rect') this.setTileAt(x, y, tileId, layer);
                            else if (this.selectedTool === 'circle') {
                                const cx = (x1+x2)/2, cy = (y1+y2)/2, rx = (x2-x1)/2, ry = (y2-y1)/2;
                                if (((x-cx)**2)/(rx**2||1) + ((y-cy)**2)/(ry**2||1) <= 1.1) this.setTileAt(x, y, tileId, layer);
                            } else {
                                const normY = (y-y1)/(y2-y1||1), width = normY*(x2-x1), cx = (x1+x2)/2;
                                if (Math.abs(x-cx) <= width/2+0.5) this.setTileAt(x, y, tileId, layer);
                            }
                        }
                    }
                    this.rectStart = null;
                } break;
        }
    }

    floodFill(startX, startY, targetId, replacementId, layer) {
        if (targetId === replacementId) return;
        const queue = [{ x: startX, y: startY }], seen = new Set();
        let count = 0;
        while (queue.length > 0 && count++ < 2500) {
            const { x, y } = queue.shift(); const key = `${x},${y}`;
            if (seen.has(key)) continue; seen.add(key);
            if (this.getTileAt(x, y)[layer] === targetId) {
                this.setTileAt(x, y, replacementId, layer);
                queue.push({x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1});
            }
        }
    }

    saveMap() {
        if (this.tiles.size === 0) { alert("저장할 타일이 없습니다."); return; }
        const name = prompt("맵 이름을 입력하세요:", "새로운 맵");
        if (!name) return;

        const mapData = this.getLayoutArray();
        const saved = localStorage.getItem('efb_custom_maps');
        const customMaps = saved ? JSON.parse(saved) : {};
        customMaps[name] = mapData;
        localStorage.setItem('efb_custom_maps', JSON.stringify(customMaps));
        alert(`'${name}' 맵이 저장되었습니다.`);
    }

    getLayoutArray() {
        if (this.tiles.size === 0) return { layout: [], logic: this.mapLogic, locations: this.locations };
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        // 1. Find the absolute bounds including negative coordinates
        this.tiles.forEach((cell, key) => {
            const [x, y] = key.split(',').map(Number);
            let cellW = 1, cellH = 1;

            if (cell.floor && cell.floor !== 'occupied_space') {
                const s = this.getTileSize(cell.floor);
                cellW = Math.max(cellW, s.w); cellH = Math.max(cellH, s.h);
            }
            if (cell.block && cell.block !== 'occupied_space') {
                const s = this.getTileSize(cell.block);
                const rot = cell.metadata?.blockRotation || 0;
                const isRot = (rot === 90 || rot === 270);
                cellW = Math.max(cellW, isRot ? s.h : s.w);
                cellH = Math.max(cellH, isRot ? s.w : s.h);
            }
            if (cell.unit && cell.unit.id !== 'occupied_space') {
                const s = this.getUnitSize(cell.unit.id);
                const rotDeg = (cell.unit.angle || 0) * (180 / Math.PI);
                const isRot = (rotDeg === 90 || rotDeg === 270);
                cellW = Math.max(cellW, isRot ? s.h : s.w);
                cellH = Math.max(cellH, isRot ? s.w : s.h);
            }

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + cellW - 1);
            maxY = Math.max(maxY, y + cellH - 1);
        });

        // Calculate shift amounts to bring (minX, minY) to (0,0)
        const shiftX = -minX;
        const shiftY = -minY;

        // 2. Map Layout Generation (Shifted)
        const layout = [];
        for (let y = minY; y <= maxY; y++) {
            const row = [];
            for (let x = minX; x <= maxX; x++) {
                const c = this.getTileAt(x, y);
                row.push([c.floor, c.block, (c.unit && (c.unit.id === 'occupied_space' || c.unit.id === 'v_reserved')) ? null : c.unit, c.item, c.metadata]);
            }
            layout.push(row);
        }

        // 3. Clone and Shift Logic/Events
        const shiftedLogic = JSON.parse(JSON.stringify(this.mapLogic));
        shiftedLogic.events.forEach(evt => {
            // Shift trigger area if any
            if (evt.trigger.type === 'ON_ENTER_AREA' && evt.trigger.params.locationId) {
                // Locations are shifted separately, so we just keep the ID
            }
            // Shift coordinate-based actions (SPAWN_UNIT, SPAWN_ITEM)
            evt.actions.forEach(action => {
                if (action.params.x !== undefined) action.params.x += shiftX;
                if (action.params.y !== undefined) action.params.y += shiftY;
            });
        });

        // 4. Clone and Shift Locations
        const shiftedLocations = this.locations.map(loc => ({
            ...loc,
            x: loc.x + shiftX,
            y: loc.y + shiftY
        }));
        
        return {
            layout: layout,
            logic: shiftedLogic,
            locations: shiftedLocations,
            editorOffset: { x: shiftX, y: shiftY } // Store for proper re-importing
        };
    }

    exportArray() {
        const data = this.getLayoutArray();
        if (data.layout.length === 0) { alert("배치된 타일이 없습니다."); return; }
        document.getElementById('export-output').value = JSON.stringify(data);
    }

    importArray() {
        const input = document.getElementById('export-output').value.trim();
        if (!input) return;
        try {
            const data = JSON.parse(input);
            const layout = data.layout || data; 
            const offset = data.editorOffset || { x: 0, y: 0 };
            
            // Restore logic and locations with inverse offset
            this.mapLogic = data.logic || { variables: {}, events: [] };
            this.mapLogic.events.forEach(evt => {
                evt.actions.forEach(action => {
                    if (action.params.x !== undefined) action.params.x -= offset.x;
                    if (action.params.y !== undefined) action.params.y -= offset.y;
                });
            });

            this.locations = data.locations || [];
            this.locations.forEach(loc => {
                loc.x -= offset.x;
                loc.y -= offset.y;
            });

            if (confirm("현재 작업 중인 타일들이 모두 삭제됩니다. 계속하시겠습니까?")) {
                this.tiles.clear();
                layout.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        const [floor, block, unit, item, metadata] = cell;
                        if (!floor && !block && !unit && !item) return;

                        // Place at original editor position
                        const tx = x - offset.x;
                        const ty = y - offset.y;

                        // Helper to get or create cell
                        const getOrCreateCell = (gx, gy) => {
                            const key = `${gx},${gy}`;
                            if (!this.tiles.has(key)) {
                                this.tiles.set(key, { floor: null, block: null, unit: null, item: null, metadata: null });
                            }
                            return this.tiles.get(key);
                        };

                        const mainCell = getOrCreateCell(tx, ty);
                        mainCell.floor = floor;
                        mainCell.block = block;
                        mainCell.item = item;
                        mainCell.metadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;

                        if (unit && unit.id !== 'occupied_space') {
                            const size = this.getUnitSize(unit.id);
                            for (let oy = 0; oy < size.h; oy++) {
                                for (let ox = 0; ox < size.w; ox++) {
                                    const targetCell = getOrCreateCell(tx + ox, ty + oy);
                                    if (ox === 0 && oy === 0) {
                                        unit.w = size.w; unit.h = size.h;
                                        targetCell.unit = unit;
                                    } else {
                                        targetCell.unit = { id: 'occupied_space', master: `${tx},${ty}` };
                                    }
                                }
                            }
                        }
                    });
                });
            }
        } catch (e) { alert("가져오기 실패: " + e.message); }
    }

    testCurrentMap() {
        const layout = this.getLayoutArray();
        if (layout.length === 0) { alert("배치된 타일이 없습니다."); return; }
        this.game.startTestMode(layout);
    }

    render(ctx) {
        if (this.game.gameState !== 'EDITOR') return;
        const ts = this.baseTileSize * this.zoom;
        const enemiesData = this.game.assetManager.getData('enemies') || [];
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        
        const startGX = Math.floor(-this.offsetX / ts), endGX = Math.ceil((this.game.canvas.width - this.offsetX) / ts);
        const startGY = Math.floor(-this.offsetY / ts), endGY = Math.ceil((this.game.canvas.height - this.offsetY) / ts);
        
        // 0. Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; ctx.beginPath();
        for (let x = startGX; x <= endGX; x++) { const vx = this.offsetX + x * ts; ctx.moveTo(vx, 0); ctx.lineTo(vx, this.game.canvas.height); }
        for (let y = startGY; y <= endGY; y++) { const vy = this.offsetY + y * ts; ctx.moveTo(0, vy); ctx.lineTo(this.game.canvas.width, vy); }
        ctx.stroke();

        // 0.1 Origin Axes (0,0 Lines)
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)'; // Soft red for axis
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y-axis (Vertical line at X=0)
        if (0 >= startGX && 0 <= endGX) {
            const vx = this.offsetX + 0 * ts;
            ctx.moveTo(vx, 0); ctx.lineTo(vx, this.game.canvas.height);
        }
        // X-axis (Horizontal line at Y=0)
        if (0 >= startGY && 0 <= endGY) {
            const vy = this.offsetY + 0 * ts;
            ctx.moveTo(0, vy); ctx.lineTo(this.game.canvas.width, vy);
        }
        ctx.stroke();
        ctx.lineWidth = 1;

        // 1. Render Floor Layer
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.floor && cell.floor !== 'occupied_space') {
                const img = this.game.assetManager.get(cell.floor);
                const rot = (cell.metadata?.floorRotation || 0) * (Math.PI / 180);
                ctx.save();
                ctx.translate(tx + ts/2, ty + ts/2);
                ctx.rotate(rot);
                if (img) ctx.drawImage(img, -ts/2, -ts/2, ts, ts);
                else { ctx.fillStyle = '#333'; ctx.fillRect(-ts/2, -ts/2, ts, ts); }
                ctx.restore();
            }
        });

        // 2. Render Block Layer (including Rails)
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.block && cell.block !== 'occupied_space') {
                const img = this.game.assetManager.get(cell.block);
                const baseSize = this.getTileSize(cell.block);
                const rot = (cell.metadata?.blockRotation || 0);
                const isRotated = (rot === 90 || rot === 270);
                const ew = isRotated ? baseSize.h : baseSize.w;
                const eh = isRotated ? baseSize.w : baseSize.h;
                ctx.save();
                ctx.translate(tx + (ts * ew)/2, ty + (ts * eh)/2);
                ctx.rotate(rot * Math.PI / 180);
                if (img) ctx.drawImage(img, -(ts * baseSize.w)/2, -(ts * baseSize.h)/2, ts * baseSize.w, ts * baseSize.h);
                else { ctx.fillStyle = '#555'; ctx.fillRect(-(ts * baseSize.w)/2, -(ts * baseSize.h)/2, ts * baseSize.w, ts * baseSize.h); }
                ctx.restore();
            }
        });

        // 3. Render Item Layer
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.item) {
                const itemId = (cell.item && typeof cell.item === 'object') ? cell.item.id : cell.item;
                const itemCount = (cell.item && typeof cell.item === 'object') ? (cell.item.count || 1) : 1;
                const img = this.game.assetManager.get(itemId);
                if (img) ctx.drawImage(img, tx+ts*0.2, ty+ts*0.2, ts*0.6, ts*0.6);
                else { 
                    const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === itemId);
                    ctx.fillStyle = itemDef?.color || '#f1c40f';
                    ctx.fillRect(tx+ts*0.25, ty+ts*0.25, ts*0.5, ts*0.5);
                }
                if (itemCount > 1) {
                    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, ts * 0.25)}px Arial`; ctx.textAlign = 'right';
                    ctx.fillText(itemCount, tx + ts - 5, ty + ts - 5); ctx.textAlign = 'left';
                }
            }
        });

        // 4. Render Location Areas (Blue semi-transparent rects)
        this.locations.forEach(loc => {
            const lx = this.offsetX + loc.x * ts;
            const ly = this.offsetY + loc.y * ts;
            const lw = loc.w * ts;
            const lh = loc.h * ts;
            
            ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
            ctx.fillRect(lx, ly, lw, lh);
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.strokeRect(lx, ly, lw, lh);
            
            // Draw Name Tag
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(loc.name, lx + 5, ly + 15);
        });

        // 5. Render Unit/Vehicle Layer
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts, ty = this.offsetY + gy * ts;
            if (cell.unit && cell.unit.id !== 'occupied_space') {
                const uid = cell.unit.id;
                const size = this.getUnitSize(uid);
                const angle = cell.unit.angle || 0;
                // Simplified editor preview
                ctx.save();
                ctx.translate(tx + (size.w * ts) / 2, ty + (size.h * ts) / 2);
                ctx.rotate(angle);
                
                const vehicleColors = { 'v_tank': '#1e8449', 'v_apc': '#34495e', 'v_truck': '#4b5320', 'v_train': '#2c3e50', 'v_transport_ship': '#2c3e50', 'v_transport_plane': '#7f8c8d' };
                ctx.fillStyle = vehicleColors[uid] || '#e74c3c';
                ctx.fillRect(-(size.w * ts) / 2 + 2, -(size.h * ts) / 2 + 2, size.w * ts - 4, size.h * ts - 4);
                
                // Direction indicator
                ctx.fillStyle = '#fff';
                ctx.fillRect((size.w * ts) / 2 - 8, -2, 8, 4);
                
                ctx.restore();
                ctx.fillStyle = '#fff'; ctx.font = `10px Arial`; ctx.textAlign = 'center';
                ctx.fillText(uid.replace('v_', ''), tx + (size.w * ts) / 2, ty + (size.h * ts) / 2 + 5);
            }
        });

        // 5. Mouse Preview & Drag Preview
        const input = this.game.input; const mx = input.mouse.x; const my = input.mouse.y;
        const gx = Math.floor((mx - this.offsetX) / ts); const gy = Math.floor((my - this.offsetY) / ts);

        // Display current tile coordinates in top-left
        if (mx < this.game.canvas.width - 300) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(10, 10, 120, 30);
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 1;
            ctx.strokeRect(10, 10, 120, 30);
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(`X: ${gx}, Y: ${gy}`, 25, 30);
            ctx.restore();
        }

        if (mx < this.game.canvas.width - 300) {
            const tx = this.offsetX + gx * ts; const ty = this.offsetY + gy * ts;
            ctx.save(); ctx.globalAlpha = 0.5;

            // --- LOCATION DRAG PREVIEW ---
            if (this.activeLayer === 'location' && this.isDrawing && this.rectStart) {
                const x1 = Math.min(this.rectStart.x, gx);
                const y1 = Math.min(this.rectStart.y, gy);
                const w = Math.abs(gx - this.rectStart.x) + 1;
                const h = Math.abs(gy - this.rectStart.y) + 1;
                
                const lx = this.offsetX + x1 * ts;
                const ly = this.offsetY + y1 * ts;
                const lw = w * ts;
                const lh = h * ts;

                ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
                ctx.fillRect(lx, ly, lw, lh);
                ctx.strokeStyle = '#3498db';
                ctx.setLineDash([5, 5]); // Dashed line for preview
                ctx.lineWidth = 2;
                ctx.strokeRect(lx, ly, lw, lh);
                ctx.restore();
                return; // Skip standard preview when dragging location
            }

            if (this.selectedTool === 'eraser') {
                ctx.fillStyle = 'rgba(231, 76, 60, 0.3)'; ctx.fillRect(tx, ty, ts, ts);
                ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 2; ctx.strokeRect(tx, ty, ts, ts);
            } else if (this.selectedTileId) {
                const baseSize = (this.activeLayer === 'units') ? this.getUnitSize(this.selectedTileId) : this.getTileSize(this.selectedTileId);
                const isRotated = (this.currentRotation === 90 || this.currentRotation === 270);
                const ew = isRotated ? baseSize.h : baseSize.w;
                const eh = isRotated ? baseSize.w : baseSize.h;
                const rot = this.currentRotation * (Math.PI / 180);
                ctx.translate(tx + (ew * ts)/2, ty + (eh * ts)/2);
                ctx.rotate(rot);
                if (this.activeLayer === 'units') {
                    ctx.fillStyle = '#fff'; 
                    ctx.fillRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts);
                    ctx.fillStyle = '#2ecc71'; 
                    ctx.fillRect((baseSize.w*ts)/4, -(baseSize.h*ts)/2, (baseSize.w*ts)/4, baseSize.h*ts);
                } else {
                    const img = this.game.assetManager.get(this.selectedTileId);
                    if (img) ctx.drawImage(img, -(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w * ts, baseSize.h * ts);
                    else { ctx.fillStyle = '#fff'; ctx.fillRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts); }
                }
                ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.strokeRect(-(baseSize.w*ts)/2, -(baseSize.h*ts)/2, baseSize.w*ts, baseSize.h*ts);
            }
            ctx.restore();
        }
    }
}