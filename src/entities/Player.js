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

        // Combat Visuals
        this.punchVisualTimer = 0;
        this.punchAngle = 0;
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

        // Map Boundary Constrain removed for infinite map

        // Shooting & Item Usage logic
        if (this.fireTimer > 0) {
            this.fireTimer -= dt;
        }
        if (this.punchVisualTimer > 0) {
            this.punchVisualTimer -= dt;
        }

        if (input.mouse.leftDown && this.fireTimer <= 0) {
            const selectedItem = this.game.inventory.getSelectedItem();
            const itemDef = selectedItem ? this.game.inventory.getItemDef(selectedItem.id) : null;

            if (itemDef && itemDef.type === 'weapon') {
                this.shoot(itemDef);
            } else if (itemDef && itemDef.type === 'consumable') {
                if (this.game.inventory.useItem(this.game.inventory.selectedSlot)) {
                    this.fireTimer = 0.5; // Prevent spamming consumables
                }
            } else {
                // Default: Punch
                this.punch();
            }
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

    shoot(weaponDef) {
        const input = this.game.input;
        const camera = this.game.camera;

        // Target position in world space - account for zoom
        const targetX = input.mouse.x / this.game.zoom + camera.x;
        const targetY = input.mouse.y / this.game.zoom + camera.y;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const damage = weaponDef ? weaponDef.damage || 1 : 1;
            const fireRate = weaponDef ? weaponDef.fireRate || this.fireRate : this.fireRate;

            const prj = new Projectile(this.game, this.x, this.y, dx / dist, dy / dist, damage);
            this.game.projectiles.push(prj);
            this.fireTimer = fireRate;
        }
    }

    punch() {
        const input = this.game.input;
        const camera = this.game.camera;
        const targetX = input.mouse.x / this.game.zoom + camera.x;
        const targetY = input.mouse.y / this.game.zoom + camera.y;

        const punchAngle = Math.atan2(targetY - this.y, targetX - this.x);
        const punchRange = 100;
        const punchDamage = 1;
        const punchArc = Math.PI * 0.5; // 90 degrees

        // Set visual states
        this.punchAngle = punchAngle;
        this.punchVisualTimer = 0.15;
        this.fireTimer = 0.4; // Punch cooldown (global combat cooldown)

        console.log("PUNCH!");

        for (const enemy of this.game.enemies) {
            if (enemy.isDead) continue;

            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < punchRange) {
                const angleToEnemy = Math.atan2(dy, dx);
                let diff = angleToEnemy - punchAngle;

                // Keep diff in [-PI, PI]
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                if (Math.abs(diff) < punchArc / 2) {
                    enemy.takeDamage(punchDamage);
                    console.log(`Punched enemy! Health: ${enemy.health}`);
                }
            }
        }
    }

    render(ctx, camera) {
        // Render relative to camera
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Punch Visual (Arc)
        if (this.punchVisualTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.arc(screenX, screenY, 100, this.punchAngle - Math.PI * 0.25, this.punchAngle + Math.PI * 0.25);
            ctx.fill();
            ctx.closePath();
        }

        // Simple circle for player for now
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}
