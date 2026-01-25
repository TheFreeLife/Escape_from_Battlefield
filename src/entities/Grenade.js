export default class Grenade {
    constructor(game, x, y, tx, ty, damage = 50) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.targetX = tx;
        this.targetY = ty;
        this.damage = damage;
        this.radius = 128; // ~2 tiles

        this.life = 1.0; // Time in air
        this.maxLife = 1.0;
        this.markedForDeletion = false;
        this.isExploded = false;
        this.explosionTimer = 0.5; // Visual duration
    }

    update(dt) {
        if (this.isExploded) {
            this.explosionTimer -= dt;
            if (this.explosionTimer <= 0) {
                this.markedForDeletion = true;
            }
            return;
        }

        this.life -= dt;
        const progress = 1 - (this.life / this.maxLife);

        if (progress >= 1.0) {
            this.explode();
        } else {
            // Lerp position
            this.x = this.startX + (this.targetX - this.startX) * progress;
            this.y = this.startY + (this.targetY - this.startY) * progress;
        }
    }

    explode() {
        this.isExploded = true;
        this.x = this.targetX;
        this.y = this.targetY;

        // Damage enemies in radius
        this.game.enemies.forEach(enemy => {
            if (enemy.isDead) return;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.radius) {
                const damageMult = 1 - (dist / this.radius);
                enemy.takeDamage(this.damage * (0.5 + 0.5 * damageMult));
            }
        });

        // Damage Player
        const p = this.game.player;
        const pdx = p.x - this.x;
        const pdy = p.y - this.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < this.radius) {
            const damageMult = 1 - (pdist / this.radius);
            p.health -= this.damage * (0.5 + 0.5 * damageMult);
        }

        // Damage Vehicles
        this.game.vehicles.forEach(vehicle => {
            if (vehicle.isDestroyed) return;
            const vdx = vehicle.x - this.x;
            const vdy = vehicle.y - this.y;
            const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
            if (vdist < this.radius + vehicle.radius) {
                const damageMult = 1 - (vdist / (this.radius + vehicle.radius));
                vehicle.takeDamage(this.damage * (0.5 + 0.5 * damageMult));
            }
        });

        // Damage Tiles
        if (this.game.tileMap) {
            const tileSize = 64;
            const checkRadius = Math.ceil(this.radius / tileSize);
            const tx = Math.floor(this.x / tileSize);
            const ty = Math.floor(this.y / tileSize);

            for (let oy = -checkRadius; oy <= checkRadius; oy++) {
                for (let ox = -checkRadius; ox <= checkRadius; ox++) {
                    const block = this.game.tileMap.getBlockAt(tx + ox, ty + oy);
                    if (block && block.def.destructible) {
                        const center = block.getCenterWorld();
                        const dx = center.x - this.x;
                        const dy = center.y - this.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < this.radius) {
                            const damageMult = 1 - (dist / this.radius);
                            this.game.tileMap.damageTile(center.x, center.y, this.damage * (0.5 + 0.5 * damageMult));
                        }
                    }
                }
            }
        }

        console.log("BOOM!");
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        if (this.isExploded) {
            // Explosion visual
            const alpha = this.explosionTimer / 0.5;
            ctx.beginPath();
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.radius);
            grad.addColorStop(0, `rgba(255, 100, 0, ${alpha})`);
            grad.addColorStop(0.5, `rgba(255, 50, 0, ${alpha * 0.5})`);
            grad.addColorStop(1, `rgba(200, 0, 0, 0)`);
            ctx.fillStyle = grad;
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
            return;
        }

        // Grenade visual (simple circle/arc to simulate height)
        const age = 1 - (this.life / this.maxLife);
        const height = Math.sin(age * Math.PI) * 50; // Arc

        ctx.fillStyle = '#4b5320';
        ctx.beginPath();
        ctx.arc(screenX, screenY - height, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }
}
