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
            this.isFlame = false;
        } else {
            this.damage = config.damage || 1;
            this.speed = config.speed || 600;
            this.life = config.life || 2.0;
            this.owner = config.owner || null;
            this.isExplosive = config.isExplosive || false;
            this.isFlame = config.isFlame || false;
            this.explodeRadius = config.explodeRadius || 128;
            this.altitude = config.altitude || 0;
            this.color = config.color || (this.isFlame ? '#ff4500' : '#f1c40f');
        }
        
        this.radius = this.isExplosive ? 8 : (this.isFlame ? 10 : 5);
        this.maxRadius = this.isFlame ? 40 : this.radius;
        this.markedForDeletion = false;
        this.spawnTime = Date.now();
        this.initialLife = this.life;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            if (this.isExplosive) this.explode();
            this.markedForDeletion = true;
            return;
        }

        // Flame effect: expand over time
        if (this.isFlame) {
            const progress = 1 - (this.life / this.initialLife);
            this.radius = 10 + (this.maxRadius - 10) * progress;
        }

        const oldX = this.x;
        const oldY = this.y;
        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;

        // 1. Precise Wall collision
        if (this.game.tileMap) {
            const dist = this.speed * dt;
            const steps = Math.ceil(dist / 20); 
            let hitWall = false;
            let hitX = this.x;
            let hitY = this.y;

            for (let i = 1; i <= steps; i++) {
                const checkX = oldX + (this.dx * dist * (i / steps));
                const checkY = oldY + (this.dy * dist * (i / steps));
                
                if (this.game.tileMap.isCollidable(checkX, checkY)) {
                    const floorId = this.game.tileMap.getTileAtWorldPos(checkX, checkY, 'floor');
                    const block = this.game.tileMap.getBlockAt(Math.floor(checkX/64), Math.floor(checkY/64));
                    
                    if (block || floorId !== 'water') {
                        hitWall = true;
                        hitX = checkX;
                        hitY = checkY;
                        break;
                    }
                }
            }

            if (hitWall) {
                this.x = hitX;
                this.y = hitY;
                if (this.isExplosive) {
                    this.explode();
                } else if (!this.isFlame) {
                    this.game.tileMap.damageTile(this.x, this.y, this.damage);
                }
                this.markedForDeletion = true;
                return;
            }
        }

        // 2. Collision with Player
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
                }
                this.markedForDeletion = true;
                return;
            }
        }

        // 3. Collision with Enemies
        if (this.game.enemies) {
            const isOwnerEnemy = this.owner && this.game.enemies.includes(this.owner);
            for (const enemy of this.game.enemies) {
                if (!enemy.isDead && enemy !== this.owner) {
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
        const g = new Grenade(this.game, this.x, this.y, this.x, this.y, this.damage);
        g.radius = this.explodeRadius;
        g.life = 0; 
        this.game.grenades.push(g);
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y - this.altitude;

        ctx.save();
        if (this.isFlame) {
            const alpha = this.life / this.initialLife;
            ctx.globalAlpha = alpha * 0.6;
            const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.radius);
            grad.addColorStop(0, '#ffcc00'); 
            grad.addColorStop(0.4, '#ff4500'); 
            grad.addColorStop(1, 'rgba(255, 0, 0, 0)'); 
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }
        ctx.restore();
    }
}