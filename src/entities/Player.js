import Projectile from './Projectile.js';
import Grenade from './Grenade.js';

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

        // Stamina system (Sprinting)
        this.maxStamina = 200;
        this.stamina = 200;
        this.isSprinting = false;
        this.isExhausted = false; // Cannot sprint until recovered some stamina
        this.staminaDrainRate = 30; // Per second
        this.staminaRegenRate = 7.5; // Per second
        this.sprintSpeedMultiplier = 1.6;

        // Combat Visuals
        this.punchVisualTimer = 0;
        this.punchAngle = 0;

        // Grenade system
        this.throwCharge = 0;
        this.maxThrowCharge = 1.0; // 1 second to max

        // Vehicle state
        this.isInVehicle = false;
        this.currentVehicle = null;

        this.isCollidable = true;
        this.weight = 100;
    }

    update(dt) {
        if (this.isInVehicle) {
            this.isCollidable = false;
            return;
        }
        this.isCollidable = true;

        const input = this.game.input;
        let dx = 0;
        let dy = 0;

        if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp')) dy -= 1;
        if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown')) dy += 1;
        if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) dx -= 1;
        if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) dx += 1;

        // Sprinting Logic
        const isMoving = dx !== 0 || dy !== 0;
        const shiftPressed = input.isKeyPressed('ShiftLeft') || input.isKeyPressed('ShiftRight');
        
        if (shiftPressed && isMoving && !this.isExhausted && this.stamina > 0) {
            this.isSprinting = true;
            this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * dt);
            if (this.stamina <= 0) {
                this.isExhausted = true;
                this.isSprinting = false;
            }
        } else {
            this.isSprinting = false;
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * dt);
            
            // Recover from exhausted state when stamina reaches 20%
            if (this.isExhausted && this.stamina > (this.maxStamina * 0.2)) {
                this.isExhausted = false;
            }
        }

        // Apply weight penalty to speed
        let speedMultiplier = 1.0;
        const selectedItem = this.game.inventory.getSelectedItem();
        const itemDef = selectedItem ? this.game.inventory.getItemDef(selectedItem.id) : null;
        
        if (itemDef && itemDef.weight) {
            // Each 1kg reduces speed by 3%. Max penalty 50%.
            speedMultiplier = Math.max(0.5, 1.0 - (itemDef.weight * 0.03));
        }

        let currentSpeed = this.isSprinting ? this.speed * this.sprintSpeedMultiplier : this.speed;
        currentSpeed *= speedMultiplier;
        this.currentSpeed = currentSpeed; // Store for UI display

        // Normalize diagonal movement
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        const nextX = this.x + dx * currentSpeed * dt;
        const nextY = this.y + dy * currentSpeed * dt;

        // Use unified collision check
        if (!this.game.checkCollision(nextX, this.y, this.radius, this)) {
            this.x = nextX;
        }
        if (!this.game.checkCollision(this.x, nextY, this.radius, this)) {
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

        if (input.mouse.leftDown) {
            if (itemDef && itemDef.type === 'grenade') {
                // Charging grenade
                this.throwCharge = Math.min(this.maxThrowCharge, this.throwCharge + dt);
            } else if (this.fireTimer <= 0) {
                if (itemDef && itemDef.type === 'weapon') {
                    this.shoot(selectedItem);
                } else if (itemDef && (itemDef.type === 'consumable' || itemDef.type === 'magazine')) {
                    if (this.game.inventory.useItem(this.game.inventory.selectedSlot)) {
                        this.fireTimer = 0.5; // Prevent spamming
                    }
                } else {
                    // Default: Punch
                    this.punch();
                }
            }
        } else {
            // Mouse released
            if (this.throwCharge > 0) {
                this.throwGrenade(selectedItem);
                this.throwCharge = 0;
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
                if (!this.game.checkCollision(this.x + pushX, this.y + pushY, this.radius, this)) {
                    this.x += pushX;
                    this.y += pushY;
                }
            }
        }
    }

    shoot(item) {
        const input = this.game.input;
        const camera = this.game.camera;
        const itemDef = this.game.inventory.getItemDef(item.id);

        if (!itemDef) return;

        // Check Ammo
        if (item.ammo !== undefined && item.ammo <= 0) {
            // Out of ammo sound or visual feedback TBD
            return;
        }

        // Target position in world space - account for zoom
        const targetX = input.mouse.x / this.game.zoom + camera.x;
        const targetY = input.mouse.y / this.game.zoom + camera.y;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            const damage = itemDef.damage || 1;
            const fireRate = itemDef.fireRate || this.fireRate;
            const bSpeed = itemDef.bulletSpeed || 1200;
            const range = itemDef.range || 1200; // Default range
            const life = range / bSpeed;
            const numPellets = itemDef.pellets || 1;
            const spread = itemDef.spread || 0;

            const baseAngle = Math.atan2(dy, dx);

            for (let i = 0; i < numPellets; i++) {
                const finalAngle = baseAngle + (Math.random() - 0.5) * spread;
                const pdx = Math.cos(finalAngle);
                const pdy = Math.sin(finalAngle);

                const prj = new Projectile(this.game, this.x, this.y, pdx, pdy, damage, bSpeed, life, {
                    isExplosive: itemDef.isExplosive,
                    explodeRadius: itemDef.explodeRadius
                });
                this.game.projectiles.push(prj);
            }

            this.fireTimer = fireRate;

            // Deduct Ammo
            if (item.ammo !== undefined) {
                item.ammo--;
            }
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

    throwGrenade(item) {
        const input = this.game.input;
        const camera = this.game.camera;

        // Target position in world space
        const mouseWorldX = input.mouse.x / this.game.zoom + camera.x;
        const mouseWorldY = input.mouse.y / this.game.zoom + camera.y;

        const dx = mouseWorldX - this.x;
        const dy = mouseWorldY - this.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const maxDist = 600;
        const throwDist = (this.throwCharge / this.maxThrowCharge) * Math.min(maxDist, distToMouse);

        const tx = this.x + Math.cos(angle) * throwDist;
        const ty = this.y + Math.sin(angle) * throwDist;

        this.game.grenades.push(new Grenade(this.game, this.x, this.y, tx, ty, 100));

        // Consume item
        item.count--;
        if (item.count <= 0) {
            this.game.inventory.hotbar[this.game.inventory.selectedSlot] = null;
        }

        this.fireTimer = 1.0; // Cooldown after throw
        console.log("Threw Grenade!");
    }

    render(ctx, camera) {
        if (this.isInVehicle) return;

        // Render relative to camera
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Laser Sight Visual
        const selectedItem = this.game.inventory.getSelectedItem();
        if (selectedItem && selectedItem.attachments?.underbarrel?.id === 'laser_sight' && !this.game.inventory.isOpen) {
            const input = this.game.input;
            const targetX = input.mouse.x / this.game.zoom + camera.x;
            const targetY = input.mouse.y / this.game.zoom + camera.y;

            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            const laserLen = 1500; // Long enough to go off screen

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(screenX + Math.cos(angle) * laserLen, screenY + Math.sin(angle) * laserLen);

            // Laser Style
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = 'red';
            ctx.shadowBlur = 8;
            ctx.stroke();

            // Bright center
            ctx.strokeStyle = 'rgba(255, 200, 200, 0.8)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            ctx.closePath();
            ctx.restore();
        }

        // Punch Visual (Arc)
        if (this.punchVisualTimer > 0) {
            const alpha = this.punchVisualTimer / 0.15;
            const punchRange = 100;
            const punchArc = Math.PI * 0.5;

            ctx.save();
            ctx.beginPath();
            // Create a gradient for the "swipe" look
            const grad = ctx.createRadialGradient(screenX, screenY, this.radius, screenX, screenY, punchRange);
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            ctx.fillStyle = grad;
            ctx.moveTo(screenX, screenY);
            ctx.arc(screenX, screenY, punchRange, this.punchAngle - punchArc / 2, this.punchAngle + punchArc / 2);
            ctx.fill();

            // Also draw a sharp edge for the swing
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenX, screenY, punchRange - 5, this.punchAngle - punchArc / 2, this.punchAngle + punchArc / 2);
            ctx.stroke();

            ctx.restore();
        }

        // Simple circle for player
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        // Exhausted State Text
        if (this.isExhausted) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("탈진 상태!", screenX, screenY - this.radius - 10);
            ctx.textAlign = 'left';
        }

        // Reload Visual (Progress ring around player)
        if (this.game.inventory.isReloading) {
            const progress = 1 - (this.game.inventory.reloadTimer / (this.game.inventory.getSelectedItem()?.reloadTime || 1));

            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.closePath();

            // Text
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("RELOADING...", screenX, screenY - this.radius - 20);
            ctx.textAlign = 'left';
        }

        // Grenade Charge Gauge
        if (this.throwCharge > 0) {
            const barW = 60;
            const barH = 6;
            const bx = screenX - barW / 2;
            const by = screenY - this.radius - 15;

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(bx, by, barW, barH);

            const progress = this.throwCharge / this.maxThrowCharge;
            ctx.fillStyle = `rgb(${255 * progress}, ${255 * (1 - progress)}, 0)`;
            ctx.fillRect(bx, by, barW * progress, barH);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, barW, barH);
        }
    }
}
