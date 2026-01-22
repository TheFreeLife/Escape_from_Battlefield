import Projectile from './Projectile.js';
import Loot from './Loot.js';

export default class MachineGun {
    constructor(game, x, y, angle = 0, itemData = null) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.baseAngle = angle;
        this.type = 'machine_gun';
        
        this.itemData = itemData || { id: 'm2hb', ammo: 0 };
        this.itemDef = game.inventory.getItemDef(this.itemData.id);
        
        this.radius = 40;
        this.isOccupied = false;
        this.fireTimer = 0;
        
        this.health = 500;
        this.maxHealth = 500;
        this.markedForDeletion = false;
    }

    update(dt) {
        if (this.fireTimer > 0) this.fireTimer -= dt;

        if (this.isOccupied) {
            const player = this.game.player;
            const input = this.game.input;
            const camera = this.game.camera;

            // Follow mouse
            const targetX = input.mouse.x / this.game.zoom + camera.x;
            const targetY = input.mouse.y / this.game.zoom + camera.y;
            this.angle = Math.atan2(targetY - this.y, targetX - this.x);

            // Sync player position
            player.x = this.x;
            player.y = this.y;

            // Firing logic
            if (input.mouse.leftDown && this.fireTimer <= 0) {
                this.shoot();
            }
        }
    }

    shoot() {
        if (this.itemData.ammo <= 0) {
            this.reload();
            return;
        }

        const dx = Math.cos(this.angle);
        const dy = Math.sin(this.angle);
        
        const prj = new Projectile(this.game, this.x + dx * 60, this.y + dy * 60, dx, dy, {
            owner: this.game.player,
            damage: this.itemDef.damage,
            speed: this.itemDef.bulletSpeed,
            life: 2.0,
            color: '#f1c40f'
        });
        this.game.projectiles.push(prj);

        this.itemData.ammo--;
        this.fireTimer = this.itemDef.fireRate;
        
        // Recoil effect (shake camera slightly)
        this.game.camera.x += (Math.random() - 0.5) * 5;
        this.game.camera.y += (Math.random() - 0.5) * 5;
    }

    reload() {
        const inv = this.game.inventory;
        const ammos = inv.findAmmo(this.itemDef.caliber);
        
        if (!ammos) {
            console.log("No ammo found in player inventory!");
            return;
        }

        let needed = this.itemDef.magSize - this.itemData.ammo;
        if (needed <= 0) return;

        for (const info of ammos) {
            const take = Math.min(needed, info.item.count);
            info.item.count -= take;
            this.itemData.ammo += take;
            needed -= take;

            if (info.item.count <= 0) {
                if (info.type === 'hotbar') inv.hotbar[info.index] = null;
                else inv.items[info.index] = null;
            }
            if (needed <= 0) break;
        }
        
        this.fireTimer = this.itemDef.reloadTime;
        console.log("Machine Gun Reloaded");
    }

    enter(player) {
        this.isOccupied = true;
        player.isUsingMountedWeapon = true;
        player.currentMountedWeapon = this;
        console.log("Using Machine Gun");
    }

    exit() {
        const player = this.game.player;
        this.isOccupied = false;
        player.isUsingMountedWeapon = false;
        player.currentMountedWeapon = null;
        
        // Push player back
        player.x -= Math.cos(this.angle) * 60;
        player.y -= Math.sin(this.angle) * 60;
        console.log("Exited Machine Gun");
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            if (this.isOccupied) this.exit();
            this.markedForDeletion = true;
            // Drop item
            this.game.loots.push(new Loot(this.game, this.x, this.y, this.itemData.id, 1));
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Render Tripod (3 legs)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        for (let i = 0; i < 3; i++) {
            const a = this.baseAngle + (i * Math.PI * 2 / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 35, Math.sin(a) * 35);
            ctx.stroke();
        }

        // Render Gun Body
        ctx.rotate(this.angle);
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-20, -10, 70, 20); // Main receiver
        ctx.fillStyle = '#1a2533';
        ctx.fillRect(40, -4, 50, 8); // Long barrel
        
        // Ammo Box
        ctx.fillStyle = '#1e8449';
        ctx.fillRect(-15, 10, 20, 15);

        ctx.restore();
    }
}