import Grenade from './Grenade.js';

export default class Projectile {
    constructor(game, x, y, dx, dy, config = {}) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        
        // Handle both old (direct params) and new (config object) styles for safety
        if (typeof config === 'number') {
            this.damage = config;
            this.speed = arguments[6] || 600;
            this.life = arguments[7] || 2.0;
            this.owner = null;
            this.isExplosive = false;
        } else {
            this.damage = config.damage || 1;
            this.speed = config.speed || 600;
            this.life = config.life || 2.0;
            this.owner = config.owner || null;
            this.isExplosive = config.isExplosive || false;
            this.explodeRadius = config.explodeRadius || 128;
            this.color = config.color || '#f1c40f';
        }
        
        this.radius = this.isExplosive ? 8 : 5;
        this.markedForDeletion = false;
        this.spawnTime = Date.now();
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            if (this.isExplosive) this.explode();
            this.markedForDeletion = true;
            return;
        }

        const oldX = this.x;
        const oldY = this.y;
        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;

        // 1. Precise Wall collision (Raycasting between frames)
        if (this.game.tileMap) {
            const dist = this.speed * dt;
            const steps = Math.ceil(dist / 20); // Check every 20px
            let hitWall = false;
            let hitX = this.x;
            let hitY = this.y;

            for (let i = 1; i <= steps; i++) {
                const checkX = oldX + (this.dx * dist * (i / steps));
                const checkY = oldY + (this.dy * dist * (i / steps));
                if (this.game.tileMap.isCollidable(checkX, checkY)) {
                    hitWall = true;
                    hitX = checkX;
                    hitY = checkY;
                    break;
                }
            }

            if (hitWall) {
                this.x = hitX;
                this.y = hitY;
                if (this.isExplosive) {
                    this.explode();
                } else {
                    this.game.tileMap.damageTile(this.x, this.y, this.damage);
                }
                this.markedForDeletion = true;
                return;
            }
        }

        // 2. Collision with Player (if owner is not player)
        const player = this.game.player;
        if (player && this.owner !== player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < (player.radius || 20) + this.radius) {
                if (this.isExplosive) {
                    this.explode();
                } else {
                    player.health -= this.damage;
                    // console.log(`Player hit! Health: ${player.health}`);
                }
                this.markedForDeletion = true;
                return;
            }
        }

        // 2. Collision with Enemies (if owner is not an enemy)
        if (this.game.enemies) {
            const isOwnerEnemy = this.owner && this.game.enemies.includes(this.owner);
            
            for (const enemy of this.game.enemies) {
                if (!enemy.isDead && enemy !== this.owner) {
                    // Prevent friendly fire between enemies
                    if (isOwnerEnemy) continue;

                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const distSq = dx * dx + dy * dy;
                    const minDist = enemy.radius + this.radius;

                    if (distSq < minDist * minDist) {
                        if (this.isExplosive) {
                            this.explode();
                        } else {
                            enemy.takeDamage(this.damage);
                        }
                        this.markedForDeletion = true;
                        return;
                    }
                }
            }
        }

        // 4. Collision with vehicles
        if (this.game.vehicles) {
            for (const vehicle of this.game.vehicles) {
                if (vehicle === this.owner) continue;

                const dx = vehicle.x - this.x;
                const dy = vehicle.y - this.y;
                const distSq = dx * dx + dy * dy;
                const minDist = vehicle.radius + this.radius;

                // Don't collide with own vehicle immediately after spawn
                if (Date.now() - this.spawnTime < 50) continue;

                if (distSq < minDist * minDist) {
                    if (this.isExplosive) {
                        this.explode();
                    } else if (vehicle.takeDamage) {
                        vehicle.takeDamage(this.damage);
                    }
                    this.markedForDeletion = true;
                    return;
                }
            }
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
