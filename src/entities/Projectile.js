export default class Projectile {
    constructor(game, x, y, dx, dy, damage = 1) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 600;
        this.radius = 5;
        this.damage = damage;
        this.life = 2.0; // Seconds
        this.markedForDeletion = false;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.markedForDeletion = true;
            return;
        }

        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;

        // Collision with enemies
        if (this.game.enemies) {
            for (const enemy of this.game.enemies) {
                if (!enemy.isDead) {
                    const dx = enemy.x - this.x;
                    const dy = enemy.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < enemy.radius + this.radius) {
                        enemy.takeDamage(this.damage);
                        this.markedForDeletion = true;
                        break;
                    }
                }
            }
        }

        // Wall collision
        if (this.game.tileMap.isCollidable(this.x, this.y)) {
            this.markedForDeletion = true;
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f'; // Yellow
        ctx.fill();
        ctx.closePath();
    }
}
