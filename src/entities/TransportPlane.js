import Vehicle from './Vehicle.js';
import Loot from './Loot.js';
import Grenade from './Grenade.js';

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
        this.moveType = 'land'; // Default to land for collision
        this.isLanded = true; 
        
        // Altitude & Takeoff State
        this.altitude = 0; // 0.0 to 1.0
        this.takeOffSequence = false;
        this.landingSequence = false;
        this.takeOffDistance = 0; // Track distance during takeoff roll
        this.landingRollDistance = 0; // Track distance after touchdown
        
        // Storage capacity (1 row = 8 slots)
        this.hasExternalStorage = true;
        this.storageSlots = 8;
        this.storage = new Array(this.storageSlots).fill(null);
        this.interactionRadius = 180; // Large enough for the plane
    }

    update(dt) {
        if (this.isDestroyed) {
            this.speed = 0;
            return;
        }

        if (this.isOccupied) {
            const input = this.game.input;
            
            if (input.isKeyPressed('KeyT')) {
                if (!this.lastTState) { this.toggleControlModal(); this.lastTState = true; }
            } else this.lastTState = false;

            if (this.takeOffSequence) {
                // Takeoff roll: Higher acceleration
                this.speed += 150 * dt; 
                if (this.speed > 600) this.speed = 600;
                this.takeOffDistance += this.speed * dt;
                
                if (this.takeOffDistance > 256) {
                    this.altitude += 0.4 * dt;
                    if (this.altitude >= 0.7 && this.moveType !== 'air') this.moveType = 'air';
                    if (this.altitude >= 1.0) { this.altitude = 1.0; this.takeOffSequence = false; this.isLanded = false; }
                }
                this.applyMovement(dt);
            } else if (this.landingSequence) {
                if (this.altitude > 0) {
                    this.speed = Math.max(150, this.speed - 100 * dt);
                    this.altitude -= 0.3 * dt;
                    if (this.altitude <= 0.3 && this.moveType !== 'land') this.moveType = 'land';
                    if (this.altitude <= 0) { this.altitude = 0; this.landingRollDistance = 0; }
                } else {
                    this.speed = Math.max(0, this.speed - 120 * dt);
                    this.landingRollDistance += this.speed * dt;
                    if (this.speed <= 5 || this.landingRollDistance > 256) {
                        this.speed = 0; this.landingSequence = false; this.isLanded = true;
                    }
                }
                this.applyMovement(dt);
            } else {
                // Standard flight/taxi
                if (this.isLanded) { 
                    this.maxSpeed = 150; 
                    this.acceleration = 100; // Increased ground acceleration
                } else { 
                    this.maxSpeed = 600; 
                    this.acceleration = 200; 
                }
                this.handleTerrainAndInput(dt);
                this.applyMovement(dt);
            }
        } else {
            this.speed *= this.friction;
            this.applyMovement(dt);
        }

        if (this.isOccupied) {
            this.game.player.x = this.x;
            this.game.player.y = this.y;
        }
    }

    applyMovement(dt) {
        const vx = Math.cos(this.angle) * this.speed * dt;
        const vy = Math.sin(this.angle) * this.speed * dt;

        let collidedX = false;
        let collidedY = false;

        // Helper to check for map boundary specifically
        const isOutOfBounds = (nx, ny) => {
            const worldW = this.game.mapW * 64;
            const worldH = this.game.mapH * 64;
            return nx < 0 || nx > worldW || ny < 0 || ny > worldH;
        };

        // Check X movement
        if (!this.game.checkCollision(this.x + vx, this.y, this.radius, this, this.moveType)) {
            this.x += vx;
        } else {
            collidedX = true;
        }

        // Check Y movement
        if (!this.game.checkCollision(this.x, this.y + vy, this.radius, this, this.moveType)) {
            this.y += vy;
        } else {
            collidedY = true;
        }

        if (collidedX || collidedY) {
            // Check if this was a boundary collision
            const boundaryHit = isOutOfBounds(this.x + vx, this.y + vy);
            
            if (boundaryHit) {
                // NEVER explode on map boundary, just stop
                this.speed = 0;
            } else {
                // Regular obstacle collision logic
                const isMovingFast = Math.abs(this.speed) > 150;
                const isLowAltitude = this.altitude < 0.7;
                const isSequencing = this.takeOffSequence || this.landingSequence;

                // Explosion conditions:
                // 1. High speed impact while on ground (Taxi/Roll)
                // 2. Any impact during takeoff/landing while below 70% altitude
                if ((isSequencing && isLowAltitude) || (!this.isLanded && isLowAltitude && isMovingFast)) {
                    console.log("CRASH! Low altitude impact during critical phase.");
                    this.takeDamage(this.maxHealth);
                    return;
                } else {
                    this.speed *= 0.5;
                }
            }
        }

        if (this.isOccupied) {
            this.game.player.x = this.x;
            this.game.player.y = this.y;
        }
    }

    render(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.angle);

        // --- 1. Render Shadow (Affected by altitude) ---
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const shadowOff = 10 + this.altitude * 40;
        const shadowScale = 1.0 - this.altitude * 0.2;
        
        ctx.save();
        ctx.translate(shadowOff, shadowOff);
        ctx.scale(shadowScale, shadowScale);
        this.drawPlaneShape(ctx, 0, 0);
        ctx.restore();

        // --- 2. Render Plane Body (Affected by altitude) ---
        const bodyScale = 1.0 + this.altitude * 0.1;
        ctx.scale(bodyScale, bodyScale);
        ctx.fillStyle = this.color;
        this.drawPlaneShape(ctx, 0, 0);

        // Cockpit
        ctx.fillStyle = '#3498db';
        ctx.fillRect(this.width/4, -10, 20, 20);

        ctx.restore();
        this.renderHealthBar(ctx, screenX, screenY);
        this.renderAltitudeUI(ctx, screenX, screenY);
    }

    renderAltitudeUI(ctx, x, y) {
        // Show altitude UI only when flying or during sequences
        if (this.altitude <= 0 && this.isLanded) return;

        const barW = 100;
        const barH = 6;
        const barX = x - barW / 2;
        const barY = y - this.radius - 30;

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        const altPercent = Math.round(this.altitude * 100);
        ctx.fillText(`고도: ${altPercent}%`, x, barY - 5);

        // Bar Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);

        // Bar Fill (Light Blue)
        ctx.fillStyle = '#3498db';
        ctx.fillRect(barX, barY, barW * this.altitude, barH);

        // Transition Threshold Marker (70%)
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(barX + barW * 0.7 - 1, barY, 2, barH);

        ctx.textAlign = 'left';
    }

    drawPlaneShape(ctx, ox, oy) {
        const w = this.width;
        const h = this.height;
        ctx.beginPath();
        ctx.ellipse(ox, oy, w/2, h/6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ox - w/10, oy - h/2);
        ctx.lineTo(ox + w/10, oy - h/2);
        ctx.lineTo(ox + w/4, oy);
        ctx.lineTo(ox + w/10, oy + h/2);
        ctx.lineTo(ox - w/10, oy + h/2);
        ctx.lineTo(ox - w/4, oy);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ox - w/2.2, oy - h/4);
        ctx.lineTo(ox - w/2.5, oy);
        ctx.lineTo(ox - w/2.2, oy + h/4);
        ctx.fill();
    }

    renderHealthBar(ctx, x, y) {
        if (this.health >= this.maxHealth && !this.isDestroyed) return;
        const barW = 100;
        const barH = 8;
        const barX = x - barW / 2;
        const barY = y + this.radius + 15;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        const healthRatio = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = this.isDestroyed ? '#555' : (healthRatio > 0.3 ? '#2ecc71' : '#e74c3c');
        ctx.fillRect(barX, barY, barW * healthRatio, barH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);
    }

    toggleControlModal() {
        const modal = document.getElementById('plane-control-modal');
        if (!modal) return;
        
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            
            const takeoffBtn = document.getElementById('plane-takeoff-btn');
            const landBtn = document.getElementById('plane-land-btn');

            // Set button states based on isLanded flag
            if (this.isLanded) {
                takeoffBtn.disabled = false;
                takeoffBtn.style.opacity = '1.0';
                takeoffBtn.style.cursor = 'pointer';
                
                landBtn.disabled = true;
                landBtn.style.opacity = '0.3';
                landBtn.style.cursor = 'not-allowed';
            } else {
                takeoffBtn.disabled = true;
                takeoffBtn.style.opacity = '0.3';
                takeoffBtn.style.cursor = 'not-allowed';
                
                landBtn.disabled = false;
                landBtn.style.opacity = '1.0';
                landBtn.style.cursor = 'pointer';
            }

            document.getElementById('plane-takeoff-btn').onclick = () => this.takeOff();
            document.getElementById('plane-land-btn').onclick = () => this.land();
            document.getElementById('plane-close-btn').onclick = () => this.closeModal();
        } else {
            this.closeModal();
        }
    }

    takeOff() {
        if (!this.isLanded || this.takeOffSequence) return;
        this.takeOffSequence = true;
        this.landingSequence = false;
        this.takeOffDistance = 0; // Reset roll distance
        this.closeModal();
    }

    land() {
        if (this.isLanded || this.landingSequence) return;
        const tx = Math.floor(this.x / 64);
        const ty = Math.floor(this.y / 64);
        const floor = this.game.tileMap.getTile(tx, ty, 'floor');
        if (floor === 'water') {
            alert("수상에는 착륙할 수 없습니다!");
            return;
        }
        this.landingSequence = true;
        this.takeOffSequence = false;
        this.closeModal();
    }

    closeModal() {
        document.getElementById('plane-control-modal').classList.add('hidden');
    }
}