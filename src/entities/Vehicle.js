import Loot from './Loot.js';
import Grenade from './Grenade.js';

export default class Vehicle {
    constructor(game, x, y, type = 'truck', moveType = 'land') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.type = type;
        this.moveType = moveType;
        this.width = 120;
        this.height = 80;
        this.angle = 0;
        this.speed = 0;
        this.maxSpeed = 400;
        this.acceleration = 200;
        this.friction = 0.95;
        this.isOccupied = false;
        this.hasExternalStorage = true; // One-line toggle for external trunk access
        this.providesAmmoHUD = false; // Whether this vehicle shows ammo in the bottom-left HUD
        this.acceptedItemTypes = null; // null means any item is accepted

        this.interactionRadius = 150;
        this.isCollidable = true;
        this.weight = 2000;
        this.updateRadius();

        // Trunk Storage (10 slots)
        this.storageSlots = 10;
        this.storage = new Array(this.storageSlots).fill(null);
        this.isStorageOpen = false;

        // Health system
        this.maxHealth = 1000;
        this.health = 1000;
        this.isDestroyed = false;
        this.markedForDeletion = false;
    }

    takeDamage(amount) {
        if (this.isDestroyed || this.markedForDeletion) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.destroy();
        }
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        this.speed = 0;
        
        if (this.isOccupied) {
            this.exit(); // Force eject player
        }
        
        // Visual explosion effect
        const explosion = new Grenade(this.game, this.x, this.y, this.x, this.y, 0);
        explosion.radius = this.radius * 1.5;
        explosion.life = 0;
        this.game.grenades.push(explosion);

        console.log(`${this.type} destroyed!`);
        
        // Spawn loot from storage
        this.spawnWreckLoot();

        // Mark for deletion so it disappears from the world
        this.markedForDeletion = true;
    }

    spawnWreckLoot() {
        this.storage.forEach(item => {
            if (item) {
                this.game.loots.push(new Loot(this.game, this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40, item.id, item.count));
            }
        });
        this.storage.fill(null);
    }

    updateRadius() {
        this.radius = Math.max(this.width, this.height) * 0.5;
        // Require closer proximity for interaction (Radius + 40px)
        this.interactionRadius = this.radius + 40; 
    }

    handleInteraction(playerX, playerY) {
        // Calculate relative position to vehicle
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        
        // Rotate the relative coordinates to match vehicle's local space
        const localX = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
        const localY = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);

        // Vehicle entry logic: Front half for entry, back half for storage (if available)
        if (localX > -this.width / 2) {
            // Front side -> Cabin
            if (!this.isOccupied && !this.isDestroyed) {
                this.enter();
                return 'ENTERED';
            }
        } else if (this.hasExternalStorage) {
            // Back side -> Trunk
            this.toggleStorage();
            return 'STORAGE';
        } else if (!this.isOccupied && !this.isDestroyed) {
            // Fallback for vehicles without storage: allow entry from anywhere
            this.enter();
            return 'ENTERED';
        }
        return null;
    }

    toggleStorage() {
        this.isStorageOpen = !this.isStorageOpen;
        if (this.isStorageOpen) {
            this.game.inventory.openExternalStorage(this, 'vehicle');
        } else {
            this.game.inventory.closeExternalStorage();
        }
    }

    update(dt) {
        if (this.isDestroyed) {
            this.speed = 0;
            return;
        }

        // 1. Terrain Check
        const tx = Math.floor(this.x / 64);
        const ty = Math.floor(this.y / 64);
        const floorId = this.game.tileMap.getTile(tx, ty, 'floor');
        
        let terrainMaxSpeed = this.maxSpeed;
        let terrainFriction = this.friction;

        if (this.moveType === 'sea' && floorId !== 'water') {
            terrainMaxSpeed = 60; // Slightly faster taxi speed
            terrainFriction = 0.85;
        } else if (this.moveType === 'land' && floorId === 'water') {
            terrainMaxSpeed = 30;
            terrainFriction = 0.7;
        }

        // 2. Input Handling
        if (this.isOccupied) {
            const input = this.game.input;
            if (input.isKeyPressed('KeyW')) {
                this.speed = Math.min(terrainMaxSpeed, this.speed + this.acceleration * dt);
            } else if (input.isKeyPressed('KeyS')) {
                this.speed = Math.max(-terrainMaxSpeed * 0.5, this.speed - this.acceleration * dt);
            } else {
                this.speed *= terrainFriction;
            }

            // Steering (Allow steering even at very low speeds for ships on land)
            const minSteerSpeed = (this.moveType === 'sea' && floorId !== 'water') ? 5 : 10;
            if (Math.abs(this.speed) > minSteerSpeed) {
                const steerSpeed = 2.5 * (Math.abs(this.speed) / terrainMaxSpeed);
                if (input.isKeyPressed('KeyA')) this.angle -= steerSpeed * dt;
                if (input.isKeyPressed('KeyD')) this.angle += steerSpeed * dt;
            }
        } else {
            this.speed *= terrainFriction;
        }

        if (Math.abs(this.speed) < 1) this.speed = 0;

        // 3. Collision and Movement
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;

        // Skip ground collision for sea units on land to allow 'dragging'
        // But always check for BLOCKS (walls)
        const checkMove = (nx, ny) => {
            // 1. Check for entity collisions (players, other vehicles)
            // Using 'air' here is fine for entities as they are usually ground-based
            if (this.game.checkCollision(nx, ny, this.radius, this, 'air')) return false;
            
            // 2. CRITICAL: Check for physical block collisions (Walls, buildings)
            // Even if it's a ship on land, it should NEVER pass through a concrete wall.
            if (this.game.checkTileCollision(nx, ny, this.radius, 'land')) {
                // If 'land' collision is true, it might be a floor OR a block.
                // We need to know if it's specifically a BLOCK.
                const tx = Math.floor(nx / 64);
                const ty = Math.floor(ny / 64);
                if (this.game.tileMap.getBlockAt(tx, ty)) return false; // Hit a wall!
            }

            // 3. Sea unit ground logic
            if (this.moveType === 'sea') {
                return true; // Allow moving over any floor (water or land)
            }
            
            // 4. Land unit logic
            if (this.moveType === 'land') {
                const tx = Math.floor(nx / 64);
                const ty = Math.floor(ny / 64);
                const floor = this.game.tileMap.getTile(tx, ty, 'floor');
                if (floor === 'water') return false; // Block land vehicles from water
            }
            
            return !this.game.checkTileCollision(nx, ny, this.radius, this.moveType);
        };

        if (checkMove(this.x + vx, this.y)) {
            this.x += vx;
        } else {
            this.speed *= 0.5;
        }

        if (checkMove(this.x, this.y + vy)) {
            this.y += vy;
        } else {
            this.speed *= 0.5;
        }

        // Update Occupant Position
        if (this.isOccupied) {
            this.game.player.x = this.x;
            this.game.player.y = this.y;
        }
    }

    handleInput(dt) {
        const input = this.game.input;

        if (input.isKeyPressed('KeyW')) {
            this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);
        } else if (input.isKeyPressed('KeyS')) {
            this.speed = Math.max(-this.maxSpeed * 0.5, this.speed - this.acceleration * dt);
        } else {
            // Automatic deceleration when no keys are pressed
            this.speed *= this.friction;
            if (Math.abs(this.speed) < 5) this.speed = 0;
        }

        // Steering
        if (Math.abs(this.speed) > 10) {
            const steerSpeed = 2.5 * (this.speed / this.maxSpeed);
            if (input.isKeyPressed('KeyA')) this.angle -= steerSpeed * dt;
            if (input.isKeyPressed('KeyD')) this.angle += steerSpeed * dt;
        }
    }

    enter() {
        this.isOccupied = true;
        this.game.player.isInVehicle = true;
        this.game.player.currentVehicle = this;
        // Snap player to vehicle center immediately
        this.game.player.x = this.x;
        this.game.player.y = this.y;
        console.log("Entered vehicle");
    }

    exit() {
        const player = this.game.player;
        const exitDist = this.radius + player.radius + 20; 
        
        // 1. Define candidate exit angles (Left, Right, Back, Front, and diagonals)
        const angles = [
            -Math.PI / 2, // Left
            Math.PI / 2,  // Right
            Math.PI,      // Back
            0,            // Front
            -Math.PI * 0.75, // Back-Left
            Math.PI * 0.75,  // Back-Right
            -Math.PI * 0.25, // Front-Left
            Math.PI * 0.25   // Front-Right
        ];

        let foundSafeSpot = false;
        let finalX = this.x;
        let finalY = this.y;

        for (const relAngle of angles) {
            const checkAngle = this.angle + relAngle;
            const targetX = this.x + Math.cos(checkAngle) * exitDist;
            const targetY = this.y + Math.sin(checkAngle) * exitDist;

            // Check if this spot is safe (no tile collision and no other entity collision)
            if (!this.game.checkCollision(targetX, targetY, player.radius, this)) {
                finalX = targetX;
                finalY = targetY;
                foundSafeSpot = true;
                break;
            }
        }

        // 2. Emergency Fallback: If all directions blocked, try to find ANY non-colliding tile nearby
        if (!foundSafeSpot) {
            console.log("No immediate safe exit found, searching for nearest empty tile...");
            for (let r = exitDist; r < exitDist + 200; r += 32) {
                for (let a = 0; r < exitDist + 200 && a < Math.PI * 2; a += Math.PI / 4) {
                    const tx = this.x + Math.cos(a) * r;
                    const ty = this.y + Math.sin(a) * r;
                    if (!this.game.checkCollision(tx, ty, player.radius, this)) {
                        finalX = tx;
                        finalY = ty;
                        foundSafeSpot = true;
                        break;
                    }
                }
                if (foundSafeSpot) break;
            }
        }

        // 3. Final Placement
        player.x = finalX;
        player.y = finalY;

        this.isOccupied = false;
        player.isInVehicle = false;
        player.currentVehicle = null;
        console.log("Exited vehicle" + (foundSafeSpot ? "" : " (EMERGENCY)"));
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        // Simple Military Truck Design (SVG-like rendering)
        // Body (Dark Olive Green)
        ctx.fillStyle = '#4b5320';
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Cabin
        ctx.fillStyle = '#3d441a';
        ctx.fillRect(this.width / 6, -this.height / 2, this.width / 3, this.height);

        // Windows
        ctx.fillStyle = '#aaddff';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(this.width / 4, -this.height / 2 + 5, 20, 15);
        ctx.fillRect(this.width / 4, this.height / 2 - 20, 20, 15);
        ctx.globalAlpha = 1.0;

        // Details (Lines)
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Wheels
        ctx.fillStyle = '#111';
        const wheelW = 30;
        const wheelH = 15;
        ctx.fillRect(-this.width / 2 + 10, -this.height / 2 - 5, wheelW, wheelH);
        ctx.fillRect(-this.width / 2 + 10, this.height / 2 - 10, wheelW, wheelH);
        ctx.fillRect(this.width / 2 - 40, -this.height / 2 - 5, wheelW, wheelH);
        ctx.fillRect(this.width / 2 - 40, this.height / 2 - 10, wheelW, wheelH);

        ctx.restore();
        
        this.renderHealthBar(ctx, screenX, screenY);
    }

    renderHealthBar(ctx, x, y) {
        if (this.health >= this.maxHealth && !this.isDestroyed) return;

        const barW = 100;
        const barH = 8;
        const barX = x - barW / 2;
        const barY = y + this.radius + 15;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        const healthRatio = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = this.isDestroyed ? '#555' : (healthRatio > 0.3 ? '#2ecc71' : '#e74c3c');
        ctx.fillRect(barX, barY, barW * healthRatio, barH);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);
    }
}
