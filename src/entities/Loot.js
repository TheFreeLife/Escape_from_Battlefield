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
        const color = itemDef ? itemDef.color : '#fff';

        // Draw glow
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
        ctx.closePath();

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

        // Interaction Hint
        const player = this.game.player;
        if (player && !player.isInVehicle) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const distSq = dx * dx + dy * dy;
            const interactDist = 60;
            if (distSq < interactDist * interactDist) {
                ctx.save();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`[F] ${itemDef?.name || 'Item'}`, screenX, screenY - 25);
                ctx.restore();
            }
        }
    }
}
