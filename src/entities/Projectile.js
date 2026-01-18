import Grenade from './Grenade.js';

export default class Projectile {
    constructor(game, x, y, dx, dy, damage = 1, speed = 600, life = 2.0, config = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.radius = config.isExplosive ? 8 : 5;
        this.damage = damage;
        this.life = life; // Seconds
        this.markedForDeletion = false;

        // Explosive properties
        this.isExplosive = config.isExplosive || false;
        this.explodeRadius = config.explodeRadius || 128;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            if (this.isExplosive) this.explode();
            this.markedForDeletion = true;
            return;
        }

        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;

        // Collision with enemies
        if (this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isDead) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < enemy.radius + this.radius) {
                        if (this.isExplosive) {
                            this.explode();
                        } else {
                            enemy.takeDamage(this.damage);
                        }
                        this.markedForDeletion = true;
                        break;
                    }
                }
            }
        }

        // Collision with vehicles
        if (this.game.vehicles) {
            for (const vehicle of this.game.vehicles) {
                // To prevent self-collision when shooting from a vehicle, 
                // we could check if this projectile was fired by this vehicle.
                // For now, a simple distance check.
                const dx = vehicle.x - this.x;
                const dy = vehicle.y - this.y;
                const distSq = dx * dx + dy * dy;
                const minDist = vehicle.radius + this.radius;

                // If bullet is not brand new (to avoid instant collision with firing vehicle)
                if (this.life < 1.95 && distSq < minDist * minDist) {
                    if (this.isExplosive) {
                        this.explode();
                    }
                    this.markedForDeletion = true;
                    break;
                }
            }
        }

        // Wall collision
        if (this.game.tileMap.isCollidable(this.x, this.y)) {
            if (this.isExplosive) this.explode();
            this.markedForDeletion = true;
        }
    }

    explode() {
        // Create a temporary grenade instance just to use its explosion logic and visuals
        // Or we can manually spawn a "BOOM" effect. 
        // For simplicity, let's create a Grenade that explodes instantly.
        const g = new Grenade(this.game, this.x, this.y, this.x, this.y, this.damage);
        g.radius = this.explodeRadius;
        g.life = 0; // Immediate explosion
        this.game.grenades.push(g);
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f'; // Yellow
        ctx.fill();
        ctx.closePath();
    }
}
