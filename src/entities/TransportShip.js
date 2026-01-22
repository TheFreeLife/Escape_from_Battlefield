import Vehicle from './Vehicle.js';

export default class TransportShip extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y, 'transport_ship', 'sea');
        this.width = 180;
        this.height = 120;
        this.updateRadius();
        this.maxSpeed = 500; // Increased
        this.acceleration = 250; // Greatly increased
        this.friction = 0.98; // Slides more on water
        this.weight = 100000; // 100 tons
        
        // Large storage for transport
        this.storageSlots = 8; // Reduced to 1 row
        this.storage = new Array(this.storageSlots).fill(null);
        this.hasExternalStorage = true;
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        // Render Hull (Ship shape)
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -this.height / 2);
        ctx.lineTo(this.width / 2 - 30, -this.height / 2);
        ctx.lineTo(this.width / 2, 0);
        ctx.lineTo(this.width / 2 - 30, this.height / 2);
        ctx.lineTo(-this.width / 2, this.height / 2);
        ctx.closePath();
        ctx.fill();
        
        // Deck
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-this.width / 2 + 20, -this.height / 2 + 10, this.width - 60, this.height - 20);

        // Bridge / Cabin
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(-20, -this.height / 4, 40, this.height / 2);
        
        // Windows
        ctx.fillStyle = '#aaddff';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(10, -this.height / 4 + 5, 5, this.height / 2 - 10);
        ctx.globalAlpha = 1.0;

        // Details
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
        
        this.renderHealthBar(ctx, screenX, screenY);
    }
}
