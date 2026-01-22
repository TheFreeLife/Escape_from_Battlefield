import Vehicle from './Vehicle.js';

export default class TransportPlane extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y);
        this.type = 'transport_plane';
        this.width = 192; // 3 tiles wide
        this.height = 192; // 3 tiles high
        this.radius = 80;
        this.color = '#7f8c8d';
        this.maxSpeed = 120; // Slow taxi speed on ground
        this.acceleration = 40;
        this.friction = 0.92;
        this.weight = 50000;
        this.moveType = 'air';
        this.isLanded = true; // State for being on ground
        
        // Storage capacity (1 row = 8 slots)
        this.hasExternalStorage = true;
        this.storageSlots = 8;
        this.storage = new Array(this.storageSlots).fill(null);
        this.interactionRadius = 180; // Large enough for the plane
    }

    update(dt) {
        if (this.isLanded) {
            // Can taxi slowly on ground if occupied
            if (!this.isOccupied) {
                this.speed *= this.friction;
            }
        }
        super.update(dt);
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        // Render Shadow (offset when landed, further when flying)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const shadowOff = 10;
        this.drawPlaneShape(ctx, shadowOff, shadowOff);

        // Render Plane Body
        ctx.fillStyle = this.color;
        this.drawPlaneShape(ctx, 0, 0);

        // Windows / Cockpit
        ctx.fillStyle = '#3498db';
        ctx.fillRect(this.width/4, -10, 20, 20);

        ctx.restore();
        
        this.renderHealthBar(ctx, screenX, screenY);
    }

    drawPlaneShape(ctx, ox, oy) {
        const w = this.width;
        const h = this.height;

        // Fuselage (몸체)
        ctx.beginPath();
        ctx.ellipse(ox, oy, w/2, h/6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main Wings (주 날개)
        ctx.beginPath();
        ctx.moveTo(ox - w/10, oy - h/2);
        ctx.lineTo(ox + w/10, oy - h/2);
        ctx.lineTo(ox + w/4, oy);
        ctx.lineTo(ox + w/10, oy + h/2);
        ctx.lineTo(ox - w/10, oy + h/2);
        ctx.lineTo(ox - w/4, oy);
        ctx.closePath();
        ctx.fill();

        // Tail Wings (꼬리 날개)
        ctx.beginPath();
        ctx.moveTo(ox - w/2.2, oy - h/4);
        ctx.lineTo(ox - w/2.5, oy);
        ctx.lineTo(ox - w/2.2, oy + h/4);
        ctx.fill();
    }

    renderHealthBar(ctx, x, y) {
        const barW = this.radius * 2;
        const barH = 8;
        const barX = x - this.radius;
        const barY = y + this.radius + 15;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);

        // Fill
        const healthRatio = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = healthRatio > 0.3 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(barX, barY, barW * healthRatio, barH);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);
    }
}
