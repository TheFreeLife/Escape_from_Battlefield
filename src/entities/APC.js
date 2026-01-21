import Vehicle from './Vehicle.js';
import Projectile from './Projectile.js';

export default class APC extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y, 'apc', 'land');
        this.width = 140;
        this.height = 90;
        this.updateRadius();
        this.maxSpeed = 450;
        this.acceleration = 180;
        this.weight = 20000; // 20 tons
        
        this.turretAngle = 0;
        this.fireTimer = 0;
        this.currentMagAmmo = 0; // Current ammo in the loaded magazine
        
        this.providesAmmoHUD = true;
        this.hasExternalStorage = false;
        this.storageSlots = 6;
        this.storage = new Array(this.storageSlots).fill(null);
        this.acceptedItemTypes = ['apc_ammo'];
    }

    update(dt) {
        super.update(dt);
        
        if (this.fireTimer > 0) this.fireTimer -= dt;

        if (this.isOccupied) {
            const input = this.game.input;
            const camera = this.game.camera;
            const targetX = input.mouse.x / this.game.zoom + camera.x;
            const targetY = input.mouse.y / this.game.zoom + camera.y;
            this.turretAngle = Math.atan2(targetY - this.y, targetX - this.x);

            // Automatic Fire (Hold Left Click)
            if (input.mouse.leftDown && this.fireTimer <= 0) {
                this.shoot();
            }

            if (input.isKeyPressed('KeyT')) {
                if (!this.lastTState) {
                    this.toggleStorage();
                    this.lastTState = true;
                }
            } else {
                this.lastTState = false;
            }
        }
    }

    shoot() {
        // If current magazine is empty, try to load a new one
        if (this.currentMagAmmo <= 0) {
            this.reload();
            return;
        }

        // Get ammo stats from the magazine in storage (we look at the first one for stats)
        let magDef = null;
        for(let i=0; i<this.storageSlots; i++) {
            if (this.storage[i]) {
                magDef = this.game.inventory.getItemDef(this.storage[i].id);
                break;
            }
        }
        if (!magDef) return;

        const dx = Math.cos(this.turretAngle);
        const dy = Math.sin(this.turretAngle);
        
        const prj = new Projectile(this.game, this.x + dx * 50, this.y + dy * 50, dx, dy, magDef.damage, magDef.bulletSpeed, 1.5);
        this.game.projectiles.push(prj);

        this.currentMagAmmo--;
        this.fireTimer = magDef.fireRate;
    }

    reload() {
        // Find first magazine in storage
        for (let i = 0; i < this.storageSlots; i++) {
            if (this.storage[i]) {
                const mag = this.storage[i];
                const magDef = this.game.inventory.getItemDef(mag.id);
                
                this.currentMagAmmo = magDef.magSize;
                mag.count--;
                if (mag.count <= 0) this.storage[i] = null;
                
                this.fireTimer = 1.0; // Reload delay
                console.log(`APC Reloaded with ${magDef.name}`);
                return;
            }
        }
        // console.log("APC Out of Ammo!");
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Render Chassis
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = '#2d3436'; // Grey-black urban camo
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Windows/Details
        ctx.fillStyle = '#34495e';
        ctx.fillRect(this.width/4, -this.height/2 + 10, 10, 20);
        ctx.fillRect(this.width/4, this.height/2 - 30, 10, 20);
        ctx.restore();

        // Render Turret
        ctx.save();
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(-25, -25, 50, 50); // Small turret
        ctx.fillStyle = '#000';
        ctx.fillRect(20, -4, 40, 8); // Machine gun barrel
        ctx.restore();

        ctx.restore();
    }
}
