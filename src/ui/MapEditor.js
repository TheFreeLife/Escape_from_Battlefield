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
        this.rectStart = null;
        this.isDrawing = false;
        this.init();
    }

        init() {

            const palette = document.getElementById('tile-palette');

            const tiles = this.game.assetManager.getData('tiles') || [];

            

            // Tool selection (Basic)

            ['pen', 'eraser', 'fill'].forEach(tool => {

                const btn = document.getElementById(`tool-${tool}`);

                if (btn) btn.addEventListener('click', () => this.selectTool(tool));

            });

    

            // Shape Tool Logic

            const shapeMainBtn = document.getElementById('tool-shape-main');

            const shapeSubPalette = document.getElementById('shape-sub-palette');

            

            shapeMainBtn.addEventListener('click', () => {

                shapeSubPalette.classList.toggle('hidden');

            });

    

            ['rect', 'circle', 'triangle'].forEach(tool => {

                const btn = document.getElementById(`tool-${tool}`);

                if (btn) btn.addEventListener('click', () => {

                    this.selectTool(tool);

                    // Update main button icon to match selected shape

                    shapeMainBtn.innerText = btn.innerText;

                    shapeSubPalette.classList.add('hidden');

                });

            });

    

            document.getElementsByName('active-layer').forEach(input => {
            input.addEventListener('change', (e) => {
                this.activeLayer = e.target.value;
                this.updatePaletteFilter();
            });
        });
        this.updatePaletteFilter();
        document.getElementById('export-btn').addEventListener('click', () => this.exportArray());
        document.getElementById('clear-editor-btn').addEventListener('click', () => {
            if(confirm("정말 모든 타일을 삭제하시겠습니까?")) this.tiles.clear();
        });
    }

    selectTool(tool) {
        // Clear all selected states
        document.querySelectorAll('.tool-btn, .sub-tool-btn').forEach(el => el.classList.remove('selected'));
        
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) btn.classList.add('selected');
        
        // If it's a shape, also highlight the main shape button
        if (['rect', 'circle', 'triangle'].includes(tool)) {
            document.getElementById('tool-shape-main').classList.add('selected');
        }
        
        this.selectedTool = tool;
    }

    updatePaletteFilter() {
        const palette = document.getElementById('tile-palette');
        if (!palette) return;
        palette.innerHTML = '';
        const tiles = this.game.assetManager.getData('tiles') || [];
        const filtered = tiles.filter(t => t.layer === this.activeLayer);
        filtered.forEach(tile => {
            const div = document.createElement('div');
            div.className = 'palette-tile';
            if (tile.id === this.selectedTileId) div.classList.add('selected');
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 50; previewCanvas.height = 50;
            const pCtx = previewCanvas.getContext('2d');
            const tileImg = this.game.assetManager.get(tile.id);
            if (tileImg) pCtx.drawImage(tileImg, 0, 0, 50, 50);
            else { pCtx.fillStyle = tile.color || '#333'; pCtx.fillRect(0, 0, 50, 50); }
            div.appendChild(previewCanvas);
            div.title = tile.name;
            div.addEventListener('click', () => {
                document.querySelectorAll('.palette-tile').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                this.selectedTileId = tile.id;
                if (this.selectedTool === 'eraser') {
                    document.getElementById('tool-eraser').classList.remove('selected');
                    document.getElementById('tool-pen').classList.add('selected');
                    this.selectedTool = 'pen';
                }
            });
            palette.appendChild(div);
        });
        if (!filtered.find(t => t.id === this.selectedTileId) && filtered.length > 0) {
            this.selectedTileId = filtered[0].id;
            this.updatePaletteFilter();
        }
    }

    getTileAt(x, y) {
        return this.tiles.get(`${x},${y}`) || { floor: null, block: null };
    }

    setTileAt(x, y, tileId, layer) {
        const key = `${x},${y}`;
        const cell = this.tiles.get(key) || { floor: null, block: null };
        cell[layer] = tileId;
        if (cell.floor === null && cell.block === null) this.tiles.delete(key);
        else this.tiles.set(key, cell);
    }

    update(dt) {
        if (this.game.gameState !== 'EDITOR') return;
        const input = this.game.input;
        const mx = input.mouse.x; const my = input.mouse.y;

        const ts = this.baseTileSize * this.zoom;
        const gx = Math.floor((mx - this.offsetX) / ts);
        const gy = Math.floor((my - this.offsetY) / ts);
        const isOverUI = mx > this.game.canvas.width - 300;

        // Panning (Only if NOT over UI)
        if (input.mouse.rightDown && !isOverUI) {
            this.offsetX += mx - this.lastMousePos.x;
            this.offsetY += my - this.lastMousePos.y;
        }
        this.lastMousePos = { x: mx, y: my };

        // Zooming (Only if NOT over UI)
        if (input.wheel !== 0 && !isOverUI) {
            const zoomDelta = input.wheel > 0 ? -0.1 : 0.1;
            const oldZoom = this.zoom;
            this.zoom = Math.max(0.2, Math.min(5.0, this.zoom + zoomDelta));
            const zoomFactor = this.zoom / oldZoom;
            this.offsetX = mx - (mx - this.offsetX) * zoomFactor;
            this.offsetY = my - (my - this.offsetY) * zoomFactor;
        }

        if (input.mouse.leftDown && !isOverUI) {
            this.handleToolAction(gx, gy, 'start');
            this.isDrawing = true;
        } else {
            if (this.isDrawing) this.handleToolAction(gx, gy, 'end');
            this.isDrawing = false;
        }
    }

    handleToolAction(gx, gy, phase) {
        const tileId = this.selectedTool === 'eraser' ? null : this.selectedTileId;
        const layer = this.activeLayer;
        switch (this.selectedTool) {
            case 'pen':
            case 'eraser':
                this.setTileAt(gx, gy, tileId, layer);
                break;
            case 'fill':
                if (phase === 'start') {
                    const targetId = this.getTileAt(gx, gy)[layer];
                    this.floodFill(gx, gy, targetId, tileId, layer);
                }
                break;
            case 'rect':
            case 'circle':
            case 'triangle':
                if (phase === 'start') {
                    if (!this.rectStart) this.rectStart = { x: gx, y: gy };
                } else if (phase === 'end' && this.rectStart) {
                    const x1 = Math.min(this.rectStart.x, gx), x2 = Math.max(this.rectStart.x, gx);
                    const y1 = Math.min(this.rectStart.y, gy), y2 = Math.max(this.rectStart.y, gy);
                    
                    if (this.selectedTool === 'rect') {
                        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.setTileAt(x, y, tileId, layer);
                    } else if (this.selectedTool === 'circle') {
                        const centerX = (x1 + x2) / 2, centerY = (y1 + y2) / 2;
                        const radiusX = (x2 - x1) / 2, radiusY = (y2 - y1) / 2;
                        for (let y = y1; y <= y2; y++) {
                            for (let x = x1; x <= x2; x++) {
                                // Ellipse formula: (x-h)^2/a^2 + (y-k)^2/b^2 <= 1
                                const dx = x - centerX, dy = y - centerY;
                                if ((dx*dx)/(radiusX*radiusX || 1) + (dy*dy)/(radiusY*radiusY || 1) <= 1.1) {
                                    this.setTileAt(x, y, tileId, layer);
                                }
                            }
                        }
                    } else if (this.selectedTool === 'triangle') {
                        for (let y = y1; y <= y2; y++) {
                            for (let x = x1; x <= x2; x++) {
                                // Simple isosceles triangle logic: 
                                // Normalized Y from 0 to 1
                                const normY = (y - y1) / (y2 - y1 || 1);
                                const widthAtY = normY * (x2 - x1);
                                const centerX = (x1 + x2) / 2;
                                if (Math.abs(x - centerX) <= widthAtY / 2 + 0.5) {
                                    this.setTileAt(x, y, tileId, layer);
                                }
                            }
                        }
                    }
                    this.rectStart = null;
                }
                break;
        }
    }

    floodFill(startX, startY, targetId, replacementId, layer) {
        if (targetId === replacementId) return;
        const queue = [{ x: startX, y: startY }];
        const seen = new Set();
        const maxFill = 2500; let count = 0;
        while (queue.length > 0 && count < maxFill) {
            const { x, y } = queue.shift();
            const key = `${x},${y}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (this.getTileAt(x, y)[layer] === targetId) {
                this.setTileAt(x, y, replacementId, layer);
                count++;
                queue.push({ x: x + 1, y: y });
                queue.push({ x: x - 1, y: y });
                queue.push({ x: x, y: y + 1 });
                queue.push({ x: x, y: y - 1 });
            }
        }
    }

    exportArray() {
        if (this.tiles.size === 0) { alert("배치된 타일이 없습니다."); return; }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.tiles.forEach((_, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        });
        const cropped = [];
        for(let y = minY; y <= maxY; y++) {
            const row = [];
            for(let x = minX; x <= maxX; x++) row.push([this.getTileAt(x, y).floor, this.getTileAt(x, y).block]);
            cropped.push(row);
        }
        document.getElementById('export-output').value = JSON.stringify(cropped).replace(/]]\[\[/g, ']],\n    [[').replace('[[[', '[\n    [[').replace(']]]', ']]\n]');
    }

    render(ctx) {
        if (this.game.gameState !== 'EDITOR') return;
        const ts = this.baseTileSize * this.zoom;
        const tilesData = this.game.assetManager.getData('tiles') || [];
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        const startGX = Math.floor(-this.offsetX / ts);
        const endGX = Math.ceil((this.game.canvas.width - this.offsetX) / ts);
        const startGY = Math.floor(-this.offsetY / ts);
        const endGY = Math.ceil((this.game.canvas.height - this.offsetY) / ts);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        for (let x = startGX; x <= endGX; x++) { const vx = this.offsetX + x * ts; ctx.moveTo(vx, 0); ctx.lineTo(vx, this.game.canvas.height); }
        for (let y = startGY; y <= endGY; y++) { const vy = this.offsetY + y * ts; ctx.moveTo(0, vy); ctx.lineTo(this.game.canvas.width, vy); }
        ctx.stroke();
        this.tiles.forEach((cell, key) => {
            const [gx, gy] = key.split(',').map(Number);
            if (gx < startGX || gx > endGX || gy < startGY || gy > endGY) return;
            const tx = this.offsetX + gx * ts; const ty = this.offsetY + gy * ts;
            if (cell.floor) {
                const img = this.game.assetManager.get(cell.floor);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { const def = tilesData.find(t => t.id === cell.floor); ctx.fillStyle = def ? def.color : '#333'; ctx.fillRect(tx, ty, ts, ts); }
            }
            if (cell.block) {
                const img = this.game.assetManager.get(cell.block);
                if (img) ctx.drawImage(img, tx, ty, ts, ts);
                else { const def = tilesData.find(t => t.id === cell.block); ctx.fillStyle = def ? def.color : '#555'; ctx.fillRect(tx, ty, ts, ts); }
            }
        });

        // Instructions
        ctx.fillStyle = '#fff'; ctx.font = '14px Arial';
        ctx.fillText(`레이어: ${this.activeLayer.toUpperCase()} | 줌: ${Math.round(this.zoom * 100)}% | 우클릭 드래그: 화면 이동`, 20, 30);
        if (['rect', 'circle', 'triangle'].includes(this.selectedTool) && this.rectStart && this.isDrawing) {
            const input = this.game.input;
            const curGX = Math.floor((input.mouse.x - this.offsetX) / ts);
            const curGY = Math.floor((input.mouse.y - this.offsetY) / ts);
            const x1 = Math.min(this.rectStart.x, curGX), x2 = Math.max(this.rectStart.x, curGX);
            const y1 = Math.min(this.rectStart.y, curGY), y2 = Math.max(this.rectStart.y, curGY);
            
            ctx.strokeStyle = '#f1c40f'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2;
            
            if (this.selectedTool === 'rect') {
                ctx.strokeRect(this.offsetX + x1 * ts, this.offsetY + y1 * ts, (x2 - x1 + 1) * ts, (y2 - y1 + 1) * ts);
            } else if (this.selectedTool === 'circle') {
                ctx.beginPath();
                ctx.ellipse(this.offsetX + (x1 + x2 + 1) * ts / 2, this.offsetY + (y1 + y2 + 1) * ts / 2, (x2 - x1 + 1) * ts / 2, (y2 - y1 + 1) * ts / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.selectedTool === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(this.offsetX + (x1 + x2 + 1) * ts / 2, this.offsetY + y1 * ts);
                ctx.lineTo(this.offsetX + x1 * ts, this.offsetY + (y2 + 1) * ts);
                ctx.lineTo(this.offsetX + (x2 + 1) * ts, this.offsetY + (y2 + 1) * ts);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
    }
}