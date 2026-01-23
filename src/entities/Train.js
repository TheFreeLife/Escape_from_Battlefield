import Vehicle from './Vehicle.js';
import { TILE_SIZE } from '../world/Chunk.js';

export default class Train extends Vehicle {
    constructor(game, x, y) {
        super(game, x, y);
        this.type = 'train';
        this.width = 60;
        this.height = 90;
        this.maxSpeed = 400;
        this.acceleration = 250;
        this.friction = 0.96;
        this.interactionRadius = 100;
        
        // moveVec always points to the TRAIN'S FRONT
        this.moveVec = { x: 1, y: 0 }; 
        this.lastTile = { x: -1, y: -1 };
        this.passedCenter = false;
        this.weight = 2000;
    }

    update(dt) {
        if (this.isDead) return;

        const input = this.game.input;
        const isPlayerDriving = this.game.player.currentVehicle === this;

        if (isPlayerDriving) {
            if (input.isKeyPressed('KeyW')) {
                this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);
            } else if (input.isKeyPressed('KeyS')) {
                this.speed = Math.max(-this.maxSpeed, this.speed - this.acceleration * dt);
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
            this.speed = 0;
            return;
        }

        const centerX = (tx + 0.5) * TILE_SIZE;
        const centerY = (ty + 0.5) * TILE_SIZE;
        
        // Detection for tile transition
        if (tx !== this.lastTile.x || ty !== this.lastTile.y) {
            this.lastTile = { x: tx, y: ty };
            this.passedCenter = false;
        }

        let moveDist = Math.abs(this.speed * dt);
        const velocitySign = this.speed > 0 ? 1 : -1;

        if (!this.passedCenter) {
            // Calculate distance to center ALONG the current movement vector
            const dx = centerX - this.x;
            const dy = centerY - this.y;
            const distToCenter = Math.sqrt(dx * dx + dy * dy);

            if (moveDist >= distToCenter) {
                // We will reach or pass the center in this frame
                const remainingDist = moveDist - distToCenter;
                
                // 1. Move exactly to center
                this.x = centerX;
                this.y = centerY;
                this.passedCenter = true;

                // 2. Decide new direction
                this.updateRailVector(railId);

                // 3. Move the remaining distance along the NEW vector
                if (remainingDist > 0) {
                    this.x += this.moveVec.x * remainingDist * velocitySign;
                    this.y += this.moveVec.y * remainingDist * velocitySign;
                }
            } else {
                // Just move towards center
                // We don't use moveVec here to ensure we are heading EXACTLY to center
                const angleToCenter = Math.atan2(dy, dx);
                this.x += Math.cos(angleToCenter) * moveDist;
                this.y += Math.sin(angleToCenter) * moveDist;
            }
        } else {
            // Already passed center, move straight along current moveVec
            this.x += this.moveVec.x * moveDist * velocitySign;
            this.y += this.moveVec.y * moveDist * velocitySign;

            // Check for tile exit
            const ntx = Math.floor(this.x / TILE_SIZE);
            const nty = Math.floor(this.y / TILE_SIZE);
            if (ntx !== tx || nty !== ty) {
                this.passedCenter = false; // Reset for the next tile
                
                // Pre-check derailment
                const nextRail = this.game.tileMap.getTile(ntx, nty, 'block');
                if (!nextRail || !nextRail.startsWith('rail')) {
                    this.x = centerX; this.y = centerY; this.speed = 0;
                }
            }
        }

        // Final visual angle update
        this.angle = Math.atan2(this.moveVec.y, this.moveVec.x);
    }

    updateRailVector(railId) {
        const connections = {
            'rail_ns': ['N', 'S'], 'rail_we': ['W', 'E'],
            'rail_ne': ['N', 'E'], 'rail_nw': ['N', 'W'],
            'rail_se': ['S', 'E'], 'rail_sw': ['S', 'W'],
            'rail_new': ['N', 'E', 'W'], 'rail_sew': ['S', 'E', 'W'],
            'rail_nse': ['N', 'S', 'E'], 'rail_nsw': ['N', 'S', 'W'],
            'rail_nswe': ['N', 'S', 'W', 'E']
        };

        const available = connections[railId] || [];
        if (available.length === 0) return;

        // Where are we actually trying to go? (Actual velocity vector)
        const velX = this.moveVec.x * this.speed;
        const velY = this.moveVec.y * this.speed;

        // Map each exit to a unit vector
        const dirVectors = {
            'N': { x: 0, y: -1 }, 'S': { x: 0, y: 1 },
            'W': { x: -1, y: 0 }, 'E': { x: 1, y: 0 }
        };

        // Find the exit that best aligns with our current movement
        let bestScore = -Infinity;
        let targetExit = available[0];

        available.forEach(exit => {
            const vec = dirVectors[exit];
            // Dot product to see how well vel aligns with this exit
            const score = velX * vec.x + velY * vec.y;
            if (score > bestScore) {
                bestScore = score;
                targetExit = exit;
            }
        });

        // Update moveVec based on the chosen exit and movement intent
        if (this.speed > 0) {
            // Forward: Face the exit we are heading to
            this.moveVec.x = dirVectors[targetExit].x;
            this.moveVec.y = dirVectors[targetExit].y;
        } else {
            // Backward: Face the OPPOSITE of the exit we are heading to
            // This preserves the visual "front" of the train
            const oppExit = this.getOppositeDir(targetExit);
            this.moveVec.x = dirVectors[oppExit].x;
            this.moveVec.y = dirVectors[oppExit].y;
        }
    }

    checkDerailment(tx, ty, centerX, centerY) {
        // Look ahead based on current movement direction
        const checkDist = (this.speed > 0 ? 1 : -1) * 20;
        const ntx = Math.floor((this.x + this.moveVec.x * checkDist) / TILE_SIZE);
        const nty = Math.floor((this.y + this.moveVec.y * checkDist) / TILE_SIZE);
        
        if (ntx !== tx || nty !== ty) {
            const nextRail = this.game.tileMap.getTile(ntx, nty, 'block');
            if (!nextRail || !nextRail.startsWith('rail')) {
                // If moving into non-rail, snap to center and stop
                const distToCenter = Math.sqrt((this.x - centerX)**2 + (this.y - centerY)**2);
                if (distToCenter < 15) {
                    this.x = centerX;
                    this.y = centerY;
                    this.speed = 0;
                }
            }
        }
    }

    getDirectionFromVec(vec) {
        if (Math.abs(vec.x) > Math.abs(vec.y)) return vec.x > 0 ? 'E' : 'W';
        return vec.y > 0 ? 'S' : 'N';
    }

    getOppositeDir(dir) {
        const map = { 'N': 'S', 'S': 'N', 'W': 'E', 'E': 'W' };
        return map[dir];
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

        // 2. Main Chassis
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-h/2, -w/2, h, w);

        // 3. Front Cowcatcher
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

        // 4. Engine Body
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-h/2 + 10, -w/2 + 5, h * 0.6, w - 10);
        
        // 5. Driver's Cab
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-h/2 + 5, -w/2, h * 0.35, w);

        // 6. Windows
        ctx.fillStyle = '#5dade2';
        ctx.fillRect(-h/2 + 15, -w/2 + 2, 12, 6);
        ctx.fillRect(-h/2 + 15, w/2 - 8, 12, 6);
        ctx.fillRect(-h/2 + 35, -w/2 + 8, 4, w - 16);

        // 7. Chimney
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(h/4, 0, 8, 0, Math.PI * 2); ctx.fill();

        // 8. Warning Stripes
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0; i<4; i++) {
            ctx.moveTo(h/2 - 5, -w/2 + 10 + i*10);
            ctx.lineTo(h/2 + 5, -w/2 + i*10);
        }
        ctx.stroke();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-h/2, -w/2, h, w);

        ctx.restore();
    }
}