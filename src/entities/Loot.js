export default class Loot {
    constructor(game, x, y, itemId, count = 1) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.itemId = itemId;
        this.count = count;
        this.radius = 20;
        this.markedForDeletion = false;
    }

    update(dt) {
        // Auto-pickup removed, now handled via F interaction in Game.js
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        if (screenX < -50 || screenX > camera.width + 50 || screenY < -50 || screenY > camera.height + 50) return;

        const itemDef = this.game.assetManager.getData('items')?.find(it => it.id === this.itemId);
        let color = itemDef ? itemDef.color : '#ffffff';

        // Ensure color is a 6-digit hex for alpha appending
        if (color.startsWith('#') && color.length === 4) {
            color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }

        // Draw smoother radial glow
        ctx.save();
        const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.radius + 10);
        grad.addColorStop(0, `${color}66`); // Semi-transparent center
        grad.addColorStop(1, `${color}00`); // Fully transparent edge
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius + 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw item representation
        const img = this.game.assetManager.get(this.itemId);
        if (img) {
            ctx.drawImage(img, screenX - 15, screenY - 15, 30, 30);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(screenX - 10, screenY - 10, 20, 20);
        }

        // Render Count (xN)
        if (this.count > 1) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(`x${this.count}`, screenX + 10, screenY + 18);
            ctx.fillText(`x${this.count}`, screenX + 10, screenY + 18);
            ctx.restore();
        }
    }
}
