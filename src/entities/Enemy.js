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

        // --- AI System ---
        this.spawnX = x;
        this.spawnY = y;

        // Randomly assign initial command
        const commands = ['PATROL', 'GUARD', 'SURRENDER'];
        const weights = [0.45, 0.45, 0.1]; // 45% Patrol, 45% Guard, 10% Surrender
        const rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < commands.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                this.command = commands[i];
                break;
            }
        }

        this.aiState = this.command === 'SURRENDER' ? 'SURRENDER' : 'IDLE';
        this.detectRadius = 400; // Radius to spot player
        this.patrolRadius = 250; // Radius to wander around spawn
        this.patrolTarget = null;
        this.patrolPauseTimer = 0;

        this.isCollidable = true;
        this.weight = 100;
        console.log(`Enemy spawned with command: ${this.command}`);
    }

    update(dt) {
        if (this.isDead) return;

        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        const player = this.game.player;
        if (player && this.aiState !== 'SURRENDER') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 1. Detection Logic
            if (this.aiState !== 'CHASE' && dist < this.detectRadius) {
                this.aiState = 'CHASE';
                console.log("Enemy spotted player! Chasing...");
            }

            // 2. Behavior based on State
            if (this.aiState === 'CHASE') {
                this.handleChase(dt, player, dist);
            } else if (this.command === 'PATROL') {
                this.handlePatrol(dt);
            } else if (this.command === 'GUARD') {
                this.handleGuard(dt);
            }
        }

        // Separation is still useful for smooth sliding between entities, 
        // but it will also respect the unified collision check
        this.handleSeparation(dt);
    }

    handleChase(dt, player, dist) {
        const attackRange = this.radius + player.radius + 10;

        // Attack
        if (dist < attackRange && this.attackTimer <= 0) {
            player.health -= this.attackDamage;
            this.attackTimer = this.attackCooldown;
            // console.log(`Enemy attacked player! Player health: ${player.health}`);
        }

        // Move towards player
        if (dist > this.radius + player.radius) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            this.moveTowards(this.x + (dx / dist) * this.speed * dt, this.y + (dy / dist) * this.speed * dt);
        }
    }

    handlePatrol(dt) {
        if (this.patrolPauseTimer > 0) {
            this.patrolPauseTimer -= dt;
            return;
        }

        if (!this.patrolTarget) {
            // Pick a random point in patrol radius
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * this.patrolRadius;
            this.patrolTarget = {
                x: this.spawnX + Math.cos(angle) * r,
                y: this.spawnY + Math.sin(angle) * r
            };
        }

        const dx = this.patrolTarget.x - this.x;
        const dy = this.patrolTarget.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.patrolTarget = null;
            this.patrolPauseTimer = 1 + Math.random() * 2; // Pause for 1-3s
        } else {
            this.moveTowards(this.x + (dx / dist) * (this.speed * 0.5) * dt, this.y + (dy / dist) * (this.speed * 0.5) * dt);
        }
    }

    handleGuard(dt) {
        const dx = this.spawnX - this.x;
        const dy = this.spawnY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 10) {
            this.moveTowards(this.x + (dx / dist) * (this.speed * 0.3) * dt, this.y + (dy / dist) * (this.speed * 0.3) * dt);
        }
    }

    moveTowards(tx, ty) {
        const vdx = tx - this.x;
        const vdy = ty - this.y;

        if (!this.game.checkCollision(this.x + vdx, this.y, this.radius, this)) {
            this.x += vdx;
        }
        if (!this.game.checkCollision(this.x, this.y + vdy, this.radius, this)) {
            this.y += vdy;
        }
    }

    handleSeparation(dt) {
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

                // Important: Only check tiles when separating overlapped units
                if (!this.game.checkTileCollision(this.x + pushX, this.y + pushY, this.radius)) {
                    this.x += pushX;
                    this.y += pushY;
                }
            }
        }

        // 2. Resolve with player
        const p = this.game.player;
        if (p && !p.isInVehicle) {
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
                if (!this.game.checkTileCollision(this.x + pushX, this.y + pushY, this.radius)) {
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
        this.renderCommandStatus(ctx, screenX, screenY);
    }

    renderCommandStatus(ctx, x, y) {
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';

        let label = this.command;
        let color = '#fff';

        if (this.aiState === 'CHASE') {
            label = '!! CHASE !!';
            color = '#e74c3c'; // Bright red for chase
        } else {
            switch (this.command) {
                case 'PATROL': color = '#3498db'; break; // Blue
                case 'GUARD': color = '#f1c40f'; break;  // Yellow
                case 'SURRENDER': color = '#95a5a6'; break; // Grey
            }
        }

        // Draw shadow for text readability
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(label, x + 1, y - this.radius - 14);

        ctx.fillStyle = color;
        ctx.fillText(label, x, y - this.radius - 15);

        ctx.textAlign = 'left';
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
