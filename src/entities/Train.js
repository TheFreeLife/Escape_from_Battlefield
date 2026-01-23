import Vehicle from './Vehicle.js';
import { TILE_SIZE } from '../world/Chunk.js';

export default class Train extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y);
        this.type = 'train';
        this.width = 60;
        this.height = 90;
        this.maxSpeed = 400;
        this.acceleration = 200;
        this.friction = 0.98;
        this.interactionRadius = 100;
        
        // Train specific
        this.direction = 1; // 1: Forward, -1: Backward
        this.currentRailId = null;
        this.weight = 2000;
    }

    update(dt) {
        if (this.isDead) return;

        // Note: We intentionally DO NOT call super.update(dt) because 
        // Vehicle's update logic handles free movement which conflicts with rail movement.

        const input = this.game.input;
        const isPlayerDriving = this.game.player.currentVehicle === this;

        if (isPlayerDriving) {
            // Forward/Backward only
            if (input.isKeyPressed('KeyW')) {
                this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);
                this.direction = 1;
            } else if (input.isKeyPressed('KeyS')) {
                this.speed = Math.max(-this.maxSpeed, this.speed - this.acceleration * dt);
                this.direction = -1;
            } else {
                this.speed *= this.friction;
            }
        } else {
            this.speed *= this.friction;
        }

        if (Math.abs(this.speed) > 1) {
            this.moveAlongRails(dt);
        } else {
            this.speed = 0;
        }
    }

    moveAlongRails(dt) {
        const tx = Math.floor(this.x / TILE_SIZE);
        const ty = Math.floor(this.y / TILE_SIZE);
        const railId = this.game.tileMap.getTile(tx, ty, 'block');

        if (!railId || !railId.startsWith('rail')) {
            this.speed = 0; // Stop if not on rail
            return;
        }

        // Determine movement vector based on rail type
        let moveX = 0;
        let moveY = 0;

        if (railId === 'rail_ns') {
            moveY = this.speed > 0 ? 1 : -1;
            this.angle = moveY > 0 ? Math.PI / 2 : -Math.PI / 2;
            // Snap X to center of rail
            this.x = (tx + 0.5) * TILE_SIZE;
        } else if (railId === 'rail_we') {
            moveX = this.speed > 0 ? 1 : -1;
            this.angle = moveX > 0 ? 0 : Math.PI;
            // Snap Y to center of rail
            this.y = (ty + 0.5) * TILE_SIZE;
        } else if (railId.startsWith('rail_')) {
            // For curves and junctions, let's use a simplified snapping logic
            // In a real system, we'd follow the Bezier path, but here we snap to center and 
            // move towards the next logical rail tile.
            this.handleCurveMovement(railId, tx, ty, dt);
            return;
        }

        const nextX = this.x + moveX * Math.abs(this.speed) * dt;
        const nextY = this.y + moveY * Math.abs(this.speed) * dt;

        // Check if next position still has rail
        const ntx = Math.floor(nextX / TILE_SIZE);
        const nty = Math.floor(nextY / TILE_SIZE);
        const nextRail = this.game.tileMap.getTile(ntx, nty, 'block');

        if (nextRail && nextRail.startsWith('rail')) {
            this.x = nextX;
            this.y = nextY;
        } else {
            this.speed = 0;
        }
    }

    handleCurveMovement(railId, tx, ty, dt) {
        // Simple snapping for curves: move towards the center of the current tile, 
        // then once close, redirect towards the available exits.
        const centerX = (tx + 0.5) * TILE_SIZE;
        const centerY = (ty + 0.5) * TILE_SIZE;
        
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distToCenter = Math.sqrt(dx*dx + dy*dy);

        if (distToCenter > 5) {
            // Move to center
            this.x += (dx / distToCenter) * Math.abs(this.speed) * dt;
            this.y += (dy / distToCenter) * Math.abs(this.speed) * dt;
            this.angle = Math.atan2(dy, dx);
        } else {
            // At center, decide next tile based on speed direction
            // This is a placeholder for more complex curve logic
            this.x = centerX;
            this.y = centerY;
            this.speed = 0; // Stop at complex junctions for now
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        const w = this.width;
        const h = this.height;

        // 1. Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-h/2 + 5, -w/2 + 5, h, w);

        // 2. Main Chassis (Lower part)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-h/2, -w/2, h, w);

        // 3. Front Cowcatcher (Pilot) - Slanted front
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(h/2, -w/2);
        ctx.lineTo(h/2 + 15, -w/2 + 10);
        ctx.lineTo(h/2 + 15, w/2 - 10);
        ctx.lineTo(h/2, w/2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4. Engine / Boiler Body
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-h/2 + 10, -w/2 + 5, h * 0.6, w - 10);
        // Boiler details (lines)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        for(let i=0; i<3; i++) {
            ctx.strokeRect(-h/2 + 20 + i*20, -w/2 + 5, 5, w - 10);
        }

        // 5. Driver's Cab (Raised back part)
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-h/2 + 5, -w/2, h * 0.35, w);
        ctx.strokeStyle = '#111';
        ctx.strokeRect(-h/2 + 5, -w/2, h * 0.35, w);

        // 6. Windows (Front and Sides)
        ctx.fillStyle = '#5dade2';
        // Side windows
        ctx.fillRect(-h/2 + 15, -w/2 + 2, 12, 6);
        ctx.fillRect(-h/2 + 15, w/2 - 8, 12, 6);
        // Front windows (facing forward)
        ctx.fillRect(-h/2 + 35, -w/2 + 8, 4, w - 16);

        // 7. Chimney / Exhaust
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(h/4, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(h/4, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // 8. Warning Stripes (Front)
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0; i<4; i++) {
            ctx.moveTo(h/2 - 5, -w/2 + 10 + i*10);
            ctx.lineTo(h/2 + 5, -w/2 + i*10);
        }
        ctx.stroke();

        // Final outline
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-h/2, -w/2, h, w);

        ctx.restore();
    }
}
