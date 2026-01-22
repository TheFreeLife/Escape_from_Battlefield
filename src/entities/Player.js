import Projectile from './Projectile.js';
import Grenade from './Grenade.js';

export default class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.speed = 250; // Pixels per second (Increased from 200)
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
        this.maxThrowCharge = 1.8; // 1.8 seconds to max

        // Vehicle state
        this.isInVehicle = false;
        this.currentVehicle = null;
        this.isUsingMountedWeapon = false;
        this.currentMountedWeapon = null;

        this.isStealth = false; // Stealth state
        this.isSwimming = false; // Swimming state
        this.isCollidable = true;
        this.weight = 100;
    }

    update(dt) {
        // ... (facingAngle calculation)
        const camera = this.game.camera;
        const targetX = this.game.input.mouse.x / this.game.zoom + camera.x;
        const targetY = this.game.input.mouse.y / this.game.zoom + camera.y;
        this.facingAngle = Math.atan2(targetY - this.y, targetX - this.x);

        // Check if swimming
        const tx = Math.floor(this.x / 64);
        const ty = Math.floor(this.y / 64);
        const floor = this.game.tileMap.getTile(tx, ty, 'floor');
        this.isSwimming = (floor === 'water');

        // Stealth Check (e.g. In Bush)
        this.checkStealth();

        if (this.isUsingMountedWeapon) {
            this.isCollidable = false;
            return;
        }

        if (this.isInVehicle) {
            this.isCollidable = false;
            if (this.currentVehicle) {
                this.x = this.currentVehicle.x;
                this.y = this.currentVehicle.y;
            }
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
            if (this.isExhausted && this.stamina > (this.maxStamina * 0.2)) {
                this.isExhausted = false;
            }
        }

        // Define items for use
        const selectedItem = this.game.inventory.getSelectedItem();
        const itemDef = selectedItem ? this.game.inventory.getItemDef(selectedItem.id) : null;

        // Apply weight penalty to speed
        let speedMultiplier = 1.0;
        if (itemDef && itemDef.weight) {
            speedMultiplier = Math.max(0.4, 1.0 - (itemDef.weight * 0.05));
        }
        if (this.game.inventory.isAiming) {
            speedMultiplier *= 0.6;
        }

        let currentSpeed = this.isSprinting ? this.speed * this.sprintSpeedMultiplier : this.speed;
        currentSpeed *= speedMultiplier;

        // --- Swimming Penalty ---
        if (this.isSwimming) {
            currentSpeed *= 0.4; // 60% speed reduction
            if (this.isSprinting) {
                this.stamina = Math.max(0, this.stamina - this.staminaDrainRate * 0.5 * dt); // Additional drain
            }
        }

        this.currentSpeed = currentSpeed;

        if (isMoving) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        const nextX = this.x + dx * currentSpeed * dt;
        const nextY = this.y + dy * currentSpeed * dt;

        if (!this.game.checkCollision(nextX, this.y, this.radius, this)) {
            this.x = nextX;
        }
        if (!this.game.checkCollision(this.x, nextY, this.radius, this)) {
            this.y = nextY;
        }

        // Combat Timers
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.punchVisualTimer > 0) this.punchVisualTimer -= dt;

        // Input Actions
        if (input.mouse.leftDown) {
            if (itemDef && itemDef.type === 'grenade') {
                this.throwCharge = Math.min(this.maxThrowCharge, this.throwCharge + dt);
            } else if (this.fireTimer <= 0) {
                if (itemDef && itemDef.type === 'weapon') {
                    this.shoot(selectedItem);
                } else if (itemDef && (itemDef.type === 'consumable' || itemDef.type === 'ammo')) {
                    if (this.game.inventory.useItem(this.game.inventory.selectedSlot)) {
                        this.fireTimer = 0.5;
                    }
                } else {
                    this.punch();
                }
            }
        } else {
            if (this.throwCharge > 0) {
                this.throwGrenade(selectedItem);
                this.throwCharge = 0;
            }
        }

        // --- Separation Logic ---
        for (const enemy of this.game.enemies) {
            if (enemy.isDead) continue;
            const edx = this.x - enemy.x;
            const edy = this.y - enemy.y;
            const distSq = edx * edx + edy * edy;
            const minDist = this.radius + enemy.radius;
            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = minDist - dist;
                const nx = edx / dist;
                const ny = edy / dist;
                const pushX = nx * overlap;
                const pushY = ny * overlap;
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

        // 1. Melee Weapon Logic
        if (itemDef.subType === 'melee') {
            const targetX = input.mouse.x / this.game.zoom + camera.x;
            const targetY = input.mouse.y / this.game.zoom + camera.y;

            const attackAngle = Math.atan2(targetY - this.y, targetX - this.x);
            const attackRange = itemDef.range || 80;
            const attackDamage = itemDef.damage || 1;
            const attackArc = Math.PI * 0.6; // 108 degrees

            // Set visual states
            this.punchAngle = attackAngle;
            this.punchVisualTimer = 0.15;
            this.fireTimer = itemDef.fireRate || 0.4;
            this.lastFireRate = this.fireTimer;

            for (const enemy of this.game.enemies) {
                if (enemy.isDead) continue;

                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < attackRange + enemy.radius) {
                    const angleToEnemy = Math.atan2(dy, dx);
                    let diff = angleToEnemy - attackAngle;

                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    if (Math.abs(diff) < attackArc / 2) {
                        enemy.takeDamage(attackDamage);
                        console.log(`Hit enemy with ${itemDef.name}! Damage: ${attackDamage}`);
                    }
                }
            }

            // Damage nearby tiles
            const tipX = this.x + Math.cos(attackAngle) * attackRange;
            const tipY = this.y + Math.sin(attackAngle) * attackRange;
            this.game.tileMap.damageTile(tipX, tipY, attackDamage);

            return;
        }

        // 2. Ranged Weapon Logic
        const ammo = item.ammo !== undefined ? item.ammo : (itemDef.magSize || 0);
        if (ammo <= 0) {
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
            const range = itemDef.range || 1200; 
            const life = range / bSpeed;
            const numPellets = itemDef.pellets || 1;
            const spread = itemDef.spread || 0;

            const baseAngle = Math.atan2(dy, dx);

            // --- Special Weapon Handling: Flamethrower ---
            if (itemDef.caliber === 'fuel') {
                for (let i = 0; i < 2; i++) {
                    const finalAngle = baseAngle + (Math.random() - 0.5) * 0.4;
                    const pdx = Math.cos(finalAngle);
                    const pdy = Math.sin(finalAngle);
                    
                    const prj = new Projectile(this.game, this.x + pdx * 40, this.y + pdy * 40, pdx, pdy, {
                        owner: this,
                        damage: damage,
                        speed: 400 + Math.random() * 200, // Slower but varying
                        life: 0.5 + Math.random() * 0.3,
                        isFlame: true
                    });
                    this.game.projectiles.push(prj);
                }
            } else {
                // Standard Ranged Weapon logic
                for (let i = 0; i < numPellets; i++) {
                    const finalAngle = baseAngle + (Math.random() - 0.5) * spread;
                    const pdx = Math.cos(finalAngle);
                    const pdy = Math.sin(finalAngle);

                    const prj = new Projectile(this.game, this.x, this.y, pdx, pdy, {
                        owner: this,
                        damage: damage,
                        speed: bSpeed,
                        life: life,
                        isExplosive: itemDef.isExplosive,
                        explodeRadius: itemDef.explodeRadius
                    });
                    this.game.projectiles.push(prj);
                }
            }

            this.fireTimer = fireRate;
            this.lastFireRate = fireRate;

            // Deduct Ammo - ensure ammo property exists
            if (item.ammo === undefined) item.ammo = ammo;
            item.ammo--;
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

        // Damage tiles with punch
        const punchX = this.x + Math.cos(punchAngle) * (punchRange * 0.7);
        const punchY = this.y + Math.sin(punchAngle) * (punchRange * 0.7);
        this.game.tileMap.damageTile(punchX, punchY, punchDamage);
    }

    throwGrenade(item) {
        const input = this.game.input;
        const camera = this.game.camera;

        // Target position in world space
        const mouseWorldX = input.mouse.x / this.game.zoom + camera.x;
        const mouseWorldY = input.mouse.y / this.game.zoom + camera.y;

        const dx = mouseWorldX - this.x;
        const dy = mouseWorldY - this.y;
        const angle = Math.atan2(dy, dx);

        // Calculate actual throw distance based ONLY on gauge
        const maxDist = 600;
        const minThrowDist = 50;
        const powerRatio = this.throwCharge / this.maxThrowCharge;
        
        // Throw distance is purely dictated by power ratio, not mouse proximity
        const targetDist = minThrowDist + (powerRatio * (maxDist - minThrowDist));

        const tx = this.x + Math.cos(angle) * targetDist;
        const ty = this.y + Math.sin(angle) * targetDist;

        // Create grenade with calculated target
        this.game.grenades.push(new Grenade(this.game, this.x, this.y, tx, ty, 100));

        // Consume item
        item.count--;
        if (item.count <= 0) {
            this.game.inventory.hotbar[this.game.inventory.selectedSlot] = null;
        }

        this.fireTimer = 1.0; // Cooldown
        console.log(`Threw Grenade! Power: ${Math.round(powerRatio * 100)}%`);
    }

    checkStealth() {
        if (this.isInVehicle) {
            this.isStealth = false;
            return;
        }

        const tx = Math.floor(this.x / 64);
        const ty = Math.floor(this.y / 64);
        const block = this.game.tileMap.getBlockAt(tx, ty);
        
        // Stealth if inside a bush or specifically marked overlay block
        this.isStealth = block && (block.id === 'bush' || block.def?.isOverlay);
    }

    render(ctx, camera) {
        if (this.isInVehicle) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Apply visual modifications
        ctx.save();
        ctx.translate(screenX, screenY); // Move origin to player center

        if (this.isStealth) {
            ctx.globalAlpha = 0.5; 
        }
        if (this.isSwimming) {
            ctx.globalAlpha = 0.7; 
            ctx.scale(0.85, 0.85); 
        }

        // Calculate angle towards mouse - adjusted for new local space
        const input = this.game.input;
        const targetX = input.mouse.x / this.game.zoom + camera.x;
        const targetY = input.mouse.y / this.game.zoom + camera.y;
        const angle = Math.atan2(targetY - this.y, targetX - this.x);

        const selectedItem = this.game.inventory.getSelectedItem();
        const itemDef = selectedItem ? this.game.inventory.getItemDef(selectedItem.id) : null;

        // 1. Weapon Rendering (In local space, center is 0,0)
        if (itemDef && itemDef.type === 'weapon' && !this.game.inventory.isOpen) {
            ctx.save();
            ctx.rotate(angle);

            const isMelee = itemDef.subType === 'melee';
            const weaponImg = this.game.assetManager.get(itemDef.id);
            
            let offX = 25;
            let offY = 15;
            let rotOffset = 0;

            if (this.fireTimer > 0) {
                const animRate = this.lastFireRate || itemDef.fireRate || 0.2;
                const p = Math.min(1.0, this.fireTimer / animRate);
                if (isMelee) {
                    rotOffset = Math.sin(p * Math.PI) * 1.5;
                    offX += Math.sin(p * Math.PI) * 20;
                } else {
                    offX -= p * 15;
                }
            }

            if (weaponImg) {
                const w = 40; const h = 40;
                ctx.rotate(rotOffset);
                ctx.drawImage(weaponImg, offX, -h/2 + offY, w, h);
            } else {
                ctx.fillStyle = itemDef.color || '#555';
                ctx.fillRect(offX, -5 + offY, 30, 10);
            }
            ctx.restore();
        }

        // 2. Laser Sight (From local center 0,0)
        if (selectedItem && selectedItem.attachments?.underbarrel?.id === 'laser_sight' && !this.game.inventory.isOpen) {
            const laserLen = 1500; 
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * laserLen, Math.sin(angle) * laserLen);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = 'red'; ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.restore();
        }

        // 3. Punch Visual
        if (this.punchVisualTimer > 0) {
            const alpha = this.punchVisualTimer / 0.15;
            const punchRange = 100;
            const punchArc = Math.PI * 0.6;
            ctx.save();
            ctx.beginPath();
            const grad = ctx.createRadialGradient(0, 0, this.radius, 0, 0, punchRange);
            grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            ctx.fillStyle = grad;
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, punchRange, this.punchAngle - punchArc / 2, this.punchAngle + punchArc / 2);
            ctx.fill();
            ctx.restore();
        }

        // 4. Character Body (at center 0,0)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        // 5. Grenade Landing Preview
        if (this.throwCharge > 0 && itemDef && itemDef.type === 'grenade') {
            const powerRatio = this.throwCharge / this.maxThrowCharge;
            const targetDist = 50 + (powerRatio * (600 - 50));
            const lx = Math.cos(angle) * targetDist;
            const ly = Math.sin(angle) * targetDist;

            ctx.save();
            ctx.beginPath();
            ctx.arc(lx, ly, 40, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
            ctx.fill();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
        
        // Face/Eye
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.5, -this.radius * 0.3, 5, 0, Math.PI * 2);
        ctx.arc(this.radius * 0.5, this.radius * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. UI Indicators (Reset translation for global UI elements if needed, or draw locally)
        this.renderStatusEffects(ctx, 0, 0);

        ctx.restore(); 
    }

    renderStatusEffects(ctx, screenX, screenY) {
        // Exhausted State Text
        if (this.isExhausted) {
            ctx.fillStyle = '#e74c3c';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("탈진 상태!", screenX, screenY - this.radius - 10);
            ctx.textAlign = 'left';
        }

        // Reload Visual
        if (this.game.inventory.isReloading) {
            const progress = 1 - (this.game.inventory.reloadTimer / (this.game.inventory.getSelectedItem()?.reloadTime || 1));
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("RELOADING...", screenX, screenY - this.radius - 20);
            ctx.textAlign = 'left';
        }

        // Grenade Charge Gauge
        if (this.throwCharge > 0) {
            const barW = 60; const barH = 6;
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
