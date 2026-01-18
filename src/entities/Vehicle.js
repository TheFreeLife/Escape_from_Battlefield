export default class Vehicle {
    constructor(game, x, y, type = 'truck') {
        this.game = game;
        this.x = x;
        this.y = y;
        this.type = type;
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

        this.interactionRadius = 100;
        this.isCollidable = true;
        this.radius = Math.max(this.width, this.height) * 0.5; // Circular radius for simplified collision
        this.weight = 2000;

        // Trunk Storage (10 slots)
        this.storageSlots = 10;
        this.storage = new Array(this.storageSlots).fill(null);
        this.isStorageOpen = false;
    }

    handleInteraction(playerX, playerY) {
        // Calculate relative position to vehicle
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        
        // Rotate the relative coordinates to match vehicle's local space
        const localX = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
        const localY = dx * Math.sin(-this.angle) + dy * Math.cos(-this.angle);

        // Vehicle width is 120. Cabin is at positive local X, Trunk is at negative local X.
        if (localX > 0) {
            // Front side -> Cabin
            if (!this.isOccupied) {
                this.enter();
                return 'ENTERED';
            }
        } else if (this.hasExternalStorage) {
            // Back side -> Trunk (Only if enabled)
            this.toggleStorage();
            return 'STORAGE';
        }
        return null;
    }

    toggleStorage() {
        this.isStorageOpen = !this.isStorageOpen;
        if (this.isStorageOpen) {
            this.game.inventory.openVehicleStorage(this);
        } else {
            this.game.inventory.closeVehicleStorage();
        }
    }

    update(dt) {
        if (this.isOccupied) {
            this.handleInput(dt);
        } else {
            this.speed *= this.friction;
        }

        // Move
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;

        // Try moving X
        if (!this.game.checkCollision(this.x + vx, this.y, this.radius, this)) {
            this.x += vx;
        } else {
            this.speed *= 0.3; // Hit something
        }

        // Try moving Y
        if (!this.game.checkCollision(this.x, this.y + vy, this.radius, this)) {
            this.y += vy;
        } else {
            this.speed *= 0.3; // Hit something
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
        console.log("Entered vehicle");
    }

    exit() {
        const player = this.game.player;
        const exitDist = this.radius + player.radius + 15; // Position outside collision radius
        const sideAngle = this.angle - Math.PI / 2; // Exit to the left side

        let targetX = this.x + Math.cos(sideAngle) * exitDist;
        let targetY = this.y + Math.sin(sideAngle) * exitDist;

        // Check if the left side is blocked by a wall or another object
        if (this.game.checkCollision(targetX, targetY, player.radius, this)) {
            // Try the right side instead
            const otherSide = this.angle + Math.PI / 2;
            targetX = this.x + Math.cos(otherSide) * exitDist;
            targetY = this.y + Math.sin(otherSide) * exitDist;
        }

        // Apply new position
        player.x = targetX;
        player.y = targetY;

        this.isOccupied = false;
        player.isInVehicle = false;
        player.currentVehicle = null;
        console.log("Exited vehicle");
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

        // Interaction Hint
        if (!this.isOccupied) {
            const player = this.game.player;
            const dist = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
            if (dist < this.interactionRadius) {
                // Determine label based on local position
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const localX = dx * Math.cos(-this.angle) - dy * Math.sin(-this.angle);
                
                let label = null;
                if (localX > 0) {
                    label = "[F] 탑승";
                } else if (this.hasExternalStorage) {
                    label = "[F] 적재함";
                }

                if (label) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(label, screenX, screenY - 60);
                }
            }
        }
    }
}
