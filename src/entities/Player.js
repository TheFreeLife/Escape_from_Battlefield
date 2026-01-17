import Projectile from './Projectile.js';

export default class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.speed = 200; // Pixels per second
        this.radius = 32; // Half of TILE_SIZE (64)
        this.color = '#3498db';
        this.fireRate = 0.2; // Seconds between shots
        this.fireTimer = 0;

        // Health system
        this.maxHealth = 1000;
        this.health = 1000;
    }

    update(dt) {
        const input = this.game.input;
        let dx = 0;
        let dy = 0;

        if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp')) dy -= 1;
        if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown')) dy += 1;
        if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) dx -= 1;
        if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        const nextX = this.x + dx * this.speed * dt;
        const nextY = this.y + dy * this.speed * dt;

        // Simple Collision Detection
        // Check multiple points around the player radius for a more robust feel
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

        // Try moving X
        if (!checkCollision(nextX, this.y)) {
            this.x = nextX;
        }

        // Try moving Y
        if (!checkCollision(this.x, nextY)) {
            this.y = nextY;
        }

        // Shooting logic
        if (this.fireTimer > 0) {
            this.fireTimer -= dt;
        }

        if (input.mouse.leftDown && this.fireTimer <= 0) {
            this.shoot();
        }

        // --- Unit-to-Unit Collision (Separation) ---
        for (const enemy of this.game.enemies) {
            if (enemy.isDead) continue;

            const dx = this.x - enemy.x;
            const dy = this.y - enemy.y;
            const distSq = dx * dx + dy * dy;
            const minDist = this.radius + enemy.radius;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;

                const pushX = nx * overlap;
                const pushY = ny * overlap;

                // Push player away from enemy if not hitting a wall
                if (!checkCollision(this.x + pushX, this.y + pushY)) {
                    this.x += pushX;
                    this.y += pushY;
                }
            }
        }
    }

    shoot() {
        const input = this.game.input;
        const camera = this.game.camera;

        // Target position in world space - account for zoom
        const targetX = input.mouse.x / this.game.zoom + camera.x;
        const targetY = input.mouse.y / this.game.zoom + camera.y;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const prj = new Projectile(this.game, this.x, this.y, dx / dist, dy / dist);
            this.game.projectiles.push(prj);
            this.fireTimer = this.fireRate;
        }
    }

    render(ctx, camera) {
        // Render relative to camera
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Simple circle for player for now
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}
