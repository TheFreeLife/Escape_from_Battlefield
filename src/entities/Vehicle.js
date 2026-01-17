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

        this.interactionRadius = 100;
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

        if (!this.checkCollision(this.x + vx, this.y + vy)) {
            this.x += vx;
            this.y += vy;
        } else {
            this.speed *= 0.5; // Bounce/Slam stop
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

        // Exit
        if (input.isKeyPressed('KeyT') && !this.game.lastTState) {
            this.exit();
            this.game.lastTState = true;
        }
    }

    checkCollision(tx, ty) {
        const buffer = 40;
        const corners = [
            { x: tx - buffer, y: ty - buffer },
            { x: tx + buffer, y: ty - buffer },
            { x: tx - buffer, y: ty + buffer },
            { x: tx + buffer, y: ty + buffer }
        ];
        return corners.some(p => this.game.tileMap.isCollidable(p.x, p.y));
    }

    enter() {
        this.isOccupied = true;
        this.game.player.isInVehicle = true;
        this.game.player.currentVehicle = this;
        console.log("Entered vehicle");
    }

    exit() {
        this.isOccupied = false;
        this.game.player.isInVehicle = false;
        this.game.player.currentVehicle = null;
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
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("[T] 탭승", screenX, screenY - 60);

                // Detection for T press in Game.js/Player.js
            }
        }
    }
}
