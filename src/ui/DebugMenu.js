import Loot from '../entities/Loot.js';
import Enemy from '../entities/Enemy.js';
import Vehicle from '../entities/Vehicle.js';
import Tank from '../entities/Tank.js';

export default class DebugMenu {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.width = 240;
        
        this.godMode = false;
        this.infStamina = false;
        
        this.categories = [
            { id: 'player', name: '플레이어', icons: '👤' },
            { id: 'spawn_weapon', name: '무기 소환', icons: '🔫' },
            { id: 'spawn_ammo', name: '탄약 소환', icons: '🔋' },
            { id: 'spawn_enemy', name: '적 소환', icons: '👿' },
            { id: 'spawn_vehicle', name: '차량 소환', icons: '🚜' },
            { id: 'world', name: '월드 설정', icons: '🌍' }
        ];
        this.activeCategory = 'player';
        this.scrollOffset = 0;
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.scrollOffset = 0;
    }

    update(dt) {
        if (!this.isVisible) return;

        const input = this.game.input;
        if (input.mouse.leftDown && !this.lastClick) {
            this.handleClicks(input.mouse.x, input.mouse.y);
            this.lastClick = true;
        } else if (!input.mouse.leftDown) {
            this.lastClick = false;
        }

        // Mouse wheel for scrolling long lists
        if (input.wheel !== 0) {
            this.scrollOffset = Math.max(0, this.scrollOffset + (input.wheel > 0 ? 40 : -40));
        }

        if (this.godMode && this.game.player) {
            this.game.player.health = this.game.player.maxHealth;
        }
        if (this.infStamina && this.game.player) {
            this.game.player.stamina = this.game.player.maxStamina;
            this.game.player.isExhausted = false;
        }
    }

    handleClicks(mx, my) {
        if (mx > this.width) return;

        // 1. Category selection
        const catYStart = 60;
        const catHeight = 35;
        this.categories.forEach((cat, i) => {
            const y = catYStart + i * catHeight;
            if (my >= y && my <= y + catHeight) {
                this.activeCategory = cat.id;
                this.scrollOffset = 0;
            }
        });

        // 2. Action buttons
        const actionYStart = 280;
        const btnH = 30;
        const btnW = this.width - 20;
        const adjustedY = my + this.scrollOffset;

        if (this.activeCategory === 'player') {
            if (this.checkBtn(mx, my, 10, actionYStart, btnW, btnH)) this.game.player.health = this.game.player.maxHealth;
            if (this.checkBtn(mx, my, 10, actionYStart + 35, btnW, btnH)) this.godMode = !this.godMode;
            if (this.checkBtn(mx, my, 10, actionYStart + 70, btnW, btnH)) this.infStamina = !this.infStamina;
            if (this.checkBtn(mx, my, 10, actionYStart + 105, btnW, btnH)) {
                const cam = this.game.camera;
                this.game.player.x = this.game.input.mouse.x / this.game.zoom + cam.x;
                this.game.player.y = this.game.input.mouse.y / this.game.zoom + cam.y;
            }
        } else if (this.activeCategory === 'spawn_weapon') {
            const weapons = this.game.assetManager.getData('items').filter(it => it.type === 'weapon');
            weapons.forEach((w, i) => {
                const btnY = actionYStart + i * 35 - this.scrollOffset;
                if (btnY > 270 && this.checkBtn(mx, my, 10, btnY, btnW, btnH)) this.spawnItem(w.id);
            });
        } else if (this.activeCategory === 'spawn_ammo') {
            const ammos = this.game.assetManager.getData('items').filter(it => it.type === 'magazine' || it.type === 'tank_shell' || it.type === 'apc_ammo');
            ammos.forEach((a, i) => {
                const btnY = actionYStart + i * 35 - this.scrollOffset;
                if (btnY > 270 && this.checkBtn(mx, my, 10, btnY, btnW, btnH)) this.spawnItem(a.id);
            });
        } else if (this.activeCategory === 'spawn_enemy') {
            const enemies = ['zombie', 'soldier', 'mutant'];
            enemies.forEach((id, i) => {
                if (this.checkBtn(mx, my, 10, actionYStart + i * 35, btnW, btnH)) this.spawnEnemy(id);
            });
        } else if (this.activeCategory === 'spawn_vehicle') {
            if (this.checkBtn(mx, my, 10, actionYStart, btnW, btnH)) this.spawnVehicle('truck');
            if (this.checkBtn(mx, my, 10, actionYStart + 35, btnW, btnH)) this.spawnVehicle('tank');
            if (this.checkBtn(mx, my, 10, actionYStart + 70, btnW, btnH)) this.spawnVehicle('apc');
        } else if (this.activeCategory === 'world') {
            if (this.checkBtn(mx, my, 10, actionYStart, btnW, btnH)) this.game.enemies = [];
            if (this.checkBtn(mx, my, 10, actionYStart + 35, btnW, btnH)) this.game.projectiles = [];
            
            // Time Controls
            const timeY = actionYStart + 80;
            if (this.checkBtn(mx, my, 10, timeY, btnW, btnH)) this.game.gameTime = 8 * 60; // Morning
            if (this.checkBtn(mx, my, 10, timeY + 35, btnW, btnH)) this.game.gameTime = 12 * 60; // Noon
            if (this.checkBtn(mx, my, 10, timeY + 70, btnW, btnH)) this.game.gameTime = 18 * 60; // Evening
            if (this.checkBtn(mx, my, 10, timeY + 105, btnW, btnH)) this.game.gameTime = 0; // Midnight
        }
    }

    checkBtn(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    spawnItem(id) {
        const itemDef = this.game.inventory.getItemDef(id);
        if (!itemDef) return;

        const p = this.game.player;
        const count = itemDef.type === 'weapon' ? 1 : 10; // Ammo 10ea, Weapon 1ea
        
        // Random offset to prevent overlapping on the ground
        const rx = (Math.random() - 0.5) * 100;
        const ry = (Math.random() - 0.5) * 100;
        
        this.game.loots.push(new Loot(this.game, p.x + rx, p.y + ry, id, count));
        console.log(`[Debug] 소환됨: ${itemDef.name} x${count}`);
    }

    spawnEnemy(id) {
        const p = this.game.player;
        this.game.enemies.push(new Enemy(this.game, p.x + 150, p.y, id));
    }

    spawnVehicle(type) {
        const p = this.game.player;
        let v;
        if (type === 'tank') v = new Tank(this.game, p.x + 120, p.y + 120);
        else if (type === 'apc') v = new APC(this.game, p.x + 120, p.y + 120);
        else v = new Vehicle(this.game, p.x + 120, p.y + 120);
        
        this.game.vehicles.push(v);
    }

    render(ctx) {
        if (!this.isVisible) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(10, this.game.canvas.height - 30, 180, 25);
            ctx.fillStyle = '#fff';
            ctx.font = '12px Arial';
            ctx.fillText("연습 도구: [F1] 또는 [~]", 20, this.game.canvas.height - 13);
            return;
        }

        ctx.fillStyle = 'rgba(15, 15, 15, 0.98)';
        ctx.fillRect(0, 0, this.width, this.game.canvas.height);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, this.width, this.game.canvas.height);

        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 16px Arial';
        ctx.fillText("🛠 연습 모드 (Debug)", 20, 35);

        // Categories
        const catYStart = 60;
        const catHeight = 35;
        this.categories.forEach((cat, i) => {
            const y = catYStart + i * catHeight;
            const isActive = this.activeCategory === cat.id;
            if (isActive) {
                ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
                ctx.fillRect(0, y, this.width, catHeight);
                ctx.fillStyle = '#f1c40f';
            } else {
                ctx.fillStyle = '#777';
            }
            ctx.font = isActive ? 'bold 13px Arial' : '13px Arial';
            ctx.fillText(`${cat.icons} ${cat.name}`, 20, y + 22);
        });

        // Action Buttons (with Clip for scrolling)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 270, this.width, this.game.canvas.height - 270);
        ctx.clip();

        const actionYStart = 280;
        const btnH = 30;
        const btnW = this.width - 20;

        if (this.activeCategory === 'player') {
            this.drawBtn(ctx, 10, actionYStart, btnW, btnH, "전체 회복");
            this.drawBtn(ctx, 10, actionYStart + 35, btnW, btnH, `무적: ${this.godMode ? 'ON' : 'OFF'}`, this.godMode);
            this.drawBtn(ctx, 10, actionYStart + 70, btnW, btnH, `무한 스테미나: ${this.infStamina ? 'ON' : 'OFF'}`, this.infStamina);
            this.drawBtn(ctx, 10, actionYStart + 105, btnW, btnH, "마우스 위치로 텔포");
        } else if (this.activeCategory === 'spawn_weapon') {
            const weapons = this.game.assetManager.getData('items').filter(it => it.type === 'weapon');
            weapons.forEach((w, i) => {
                this.drawBtn(ctx, 10, actionYStart + i * 35 - this.scrollOffset, btnW, btnH, w.name);
            });
        } else if (this.activeCategory === 'spawn_ammo') {
            const ammos = this.game.assetManager.getData('items').filter(it => it.type === 'magazine' || it.type === 'tank_shell' || it.type === 'apc_ammo');
            ammos.forEach((a, i) => {
                this.drawBtn(ctx, 10, actionYStart + i * 35 - this.scrollOffset, btnW, btnH, a.name);
            });
        } else if (this.activeCategory === 'spawn_enemy') {
            const enemies = ['좀비', '보병', '괴물'];
            enemies.forEach((name, i) => {
                this.drawBtn(ctx, 10, actionYStart + i * 35, btnW, btnH, `${name} 소환`);
            });
        } else if (this.activeCategory === 'spawn_vehicle') {
            this.drawBtn(ctx, 10, actionYStart, btnW, btnH, "트럭 소환");
            this.drawBtn(ctx, 10, actionYStart + 35, btnW, btnH, "전차 소환");
        } else if (this.activeCategory === 'world') {
            this.drawBtn(ctx, 10, actionYStart, btnW, btnH, "모든 적 제거");
            this.drawBtn(ctx, 10, actionYStart + 35, btnW, btnH, "모든 투사체 제거");
            
            const timeY = actionYStart + 80;
            this.drawBtn(ctx, 10, timeY, btnW, btnH, "시간: 아침 (08:00)");
            this.drawBtn(ctx, 10, timeY + 35, btnW, btnH, "시간: 낮 (12:00)");
            this.drawBtn(ctx, 10, timeY + 70, btnW, btnH, "시간: 저녁 (18:00)");
            this.drawBtn(ctx, 10, timeY + 105, btnW, btnH, "시간: 밤 (00:00)");
        }

        ctx.restore();
    }

    drawBtn(ctx, x, y, w, h, text, active = false) {
        if (y < 270 || y > this.game.canvas.height) return;
        ctx.fillStyle = active ? '#27ae60' : '#2c3e50';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#444';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + w/2, y + h/2 + 4);
        ctx.textAlign = 'left';
    }
}