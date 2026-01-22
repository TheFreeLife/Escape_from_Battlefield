import Vehicle from './Vehicle.js';
import Projectile from './Projectile.js';

export default class Tank extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y, 'tank', 'land');
        this.width = 160;
        this.height = 100;
        this.updateRadius();
        this.maxSpeed = 250;
        this.acceleration = 100;
        this.weight = 50000; // 50 tons
        this.hasExternalStorage = false; // Disable opening trunk from outside
        this.providesAmmoHUD = true; // Show shell info in bottom-left HUD
        this.acceptedItemTypes = ['tank_shell']; // Only allow tank shells
        
        this.turretAngle = 0;
        this.fireCooldown = 2.0;
        this.fireTimer = 0;
        
        // Tank Storage (5 slots for shells)
        this.storageSlots = 5;
        this.storage = new Array(this.storageSlots).fill(null);
    }

    update(dt) {
        super.update(dt);
        
        if (this.fireTimer > 0) this.fireTimer -= dt;

        if (this.isOccupied) {
            // Turret follows mouse
            const input = this.game.input;
            const camera = this.game.camera;
            const targetX = input.mouse.x / this.game.zoom + camera.x;
            const targetY = input.mouse.y / this.game.zoom + camera.y;
            this.turretAngle = Math.atan2(targetY - this.y, targetX - this.x);

            // Handle Fire (Left Click)
            if (input.mouse.leftDown && this.fireTimer <= 0) {
                this.shoot();
            }

            // Handle T key to open storage while inside
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
        // Find first available shell in storage
        let shellIdx = -1;
        for (let i = 0; i < this.storageSlots; i++) {
            if (this.storage[i] && this.game.inventory.getItemDef(this.storage[i].id).type === 'tank_shell') {
                shellIdx = i;
                break;
            }
        }

        if (shellIdx === -1) {
            console.log("No shells loaded!");
            return;
        }

        const shell = this.storage[shellIdx];
        const shellDef = this.game.inventory.getItemDef(shell.id);

        // Spawn Projectile
        const dx = Math.cos(this.turretAngle);
        const dy = Math.sin(this.turretAngle);
        
        const prj = new Projectile(this.game, this.x + dx * 100, this.y + dy * 100, dx, dy, {
            damage: shellDef.damage,
            speed: 1500,
            life: 3.0,
            owner: this,
            isExplosive: true,
            explodeRadius: shellDef.explodeRadius || 150,
            color: '#f1c40f'
        });
        this.game.projectiles.push(prj);

        // Consume shell
        shell.count--;
        if (shell.count <= 0) {
            this.storage[shellIdx] = null;
        }

        this.fireTimer = this.fireCooldown;
        console.log(`Fired ${shellDef.name}!`);
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Render Chassis
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = '#3e441a'; // Dark military green
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        // Tracks
        ctx.fillStyle = '#222';
        ctx.fillRect(-this.width/2 - 5, -this.height/2, this.width + 10, 20);
        ctx.fillRect(-this.width/2 - 5, this.height/2 - 20, this.width + 10, 20);
        ctx.restore();

        // Render Turret
        ctx.save();
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-40, -35, 80, 70); // Turret base
        ctx.fillStyle = '#333';
        ctx.fillRect(30, -8, 70, 16); // Barrel
        ctx.restore();

        ctx.restore();
        
        this.renderHealthBar(ctx, screenX, screenY);
    }

    renderTankHUD(ctx) {
        let currentShell = null;
        for (let i = 0; i < this.storageSlots; i++) {
            if (this.storage[i]) {
                currentShell = this.storage[i];
                break;
            }
        }

        const margin = 20;
        const x = this.game.canvas.width / 2;
        const y = 80;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 150, y, 300, 40);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x - 150, y, 300, 40);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        if (currentShell) {
            const def = this.game.inventory.getItemDef(currentShell.id);
            ctx.fillText(`장전됨: ${def.name} (${currentShell.count})`, x, y + 25);
        } else {
            ctx.fillStyle = '#e74c3c';
            ctx.fillText("포탄 없음! [T]를 눌러 적재하세요", x, y + 25);
        }
        ctx.textAlign = 'left';
    }
}
