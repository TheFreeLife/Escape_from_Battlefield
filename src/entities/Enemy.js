export default class Enemy {
    constructor(game, x, y, enemyId = 'soldier') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.enemyId = enemyId;

        const data = this.game.assetManager.getData('enemies')?.find(e => e.id === enemyId) || {
            speed: 100,
            health: 3,
            damage: 1,
            color: '#e74c3c',
            radius: 32
        };

        this.speed = data.speed;
        this.radius = data.radius;
        this.color = data.color;
        this.maxHealth = data.health;
        this.health = data.health;
        this.attackDamage = data.damage;

        this.isDead = false;
        this.attackCooldown = 1.0;
        this.attackTimer = 0;
    }

    update(dt) {
        if (this.isDead) return;

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        // Simple chase logic
        const player = this.game.player;
        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Attack logic
            const attackRange = this.radius + player.radius + 10;
            if (dist < attackRange && this.attackTimer <= 0) {
                player.health -= this.attackDamage;
                this.attackTimer = this.attackCooldown;
                console.log(`Enemy attacked player! Player health: ${player.health}`);
            }

            if (dist > this.radius + player.radius) { // Stop when touching
                const vdx = (dx / dist) * this.speed * dt;
                const vdy = (dy / dist) * this.speed * dt;

                const checkCollision = (tx, ty) => {
                    const buffer = this.radius * 0.8;
                    const points = [
                        { x: tx - buffer, y: ty - buffer },
                        { x: tx + buffer, y: ty - buffer },
                        { x: tx - buffer, y: ty + buffer },
                        { x: tx + buffer, y: ty + buffer }
                    ];
                    return points.some(p => this.game.tileMap.isCollidable(p.x, p.y));
                };

                // Try move X
                if (!checkCollision(this.x + vdx, this.y)) {
                    this.x += vdx;
                }
                // Try move Y
                if (!checkCollision(this.x, this.y + vdy)) {
                    this.y += vdy;
                }
            }
        }

        // Map Boundary Constrain removed for infinite map

        // --- Unit-to-Unit Collision (Separation) ---
        const checkTile = (tx, ty) => {
            const buffer = this.radius * 0.8;
            const points = [
                { x: tx - buffer, y: ty - buffer },
                { x: tx + buffer, y: ty - buffer },
                { x: tx - buffer, y: ty + buffer },
                { x: tx + buffer, y: ty + buffer }
            ];
            return points.some(p => this.game.tileMap.isCollidable(p.x, p.y));
        };

        // 1. Resolve with other enemies
        for (const other of this.game.enemies) {
            if (other === this || other.isDead) continue;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const distSq = dx * dx + dy * dy;
            const minDist = this.radius + other.radius;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = (minDist - dist) * 0.5;
                const nx = dx / dist;
                const ny = dy / dist;

                const pushX = nx * overlap;
                const pushY = ny * overlap;

                if (!checkTile(this.x + pushX, this.y + pushY)) {
                    this.x += pushX;
                    this.y += pushY;
                }
                if (!checkTile(other.x - pushX, other.y - pushY)) {
                    other.x -= pushX;
                    other.y -= pushY;
                }
            }
        }

        // 2. Resolve with player
        const p = this.game.player;
        if (p) {
            const dx = this.x - p.x;
            const dy = this.y - p.y;
            const distSq = dx * dx + dy * dy;
            const minDist = this.radius + p.radius;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;

                const pushX = nx * overlap;
                const pushY = ny * overlap;
                if (!checkTile(this.x + pushX, this.y + pushY)) {
                    this.x += pushX;
                    this.y += pushY;
                }
            }
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            // Drop loot logic could go here
        }
    }

    render(ctx, camera) {
        if (this.isDead) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Frustum cull (approximate)
        if (screenX < -50 || screenX > camera.width + 50 || screenY < -50 || screenY > camera.height + 50) return;

        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        this.renderHealthBar(ctx, screenX, screenY);
    }

    renderHealthBar(ctx, x, y) {
        const barW = this.radius * 2;
        const barH = 6;
        const barX = x - this.radius;
        const barY = y + this.radius + 8;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        const healthRatio = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = healthRatio > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(barX, barY, barW * healthRatio, barH);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }
}
