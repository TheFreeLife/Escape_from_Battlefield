export default class Noise {
    constructor(seed = Math.random()) {
        this.seed = seed;
    }

    // Simple pseudo-random function
    random(x, y) {
        const value = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453123;
        return value - Math.floor(value);
    }

    // Smooth noise (linear interpolation)
    smoothNoise(x, y) {
        const floorX = Math.floor(x);
        const floorY = Math.floor(y);
        const fracX = x - floorX;
        const fracY = y - floorY;

        // Corners
        const v1 = this.random(floorX, floorY);
        const v2 = this.random(floorX + 1, floorY);
        const v3 = this.random(floorX, floorY + 1);
        const v4 = this.random(floorX + 1, floorY + 1);

        // Interpolate
        const i1 = this.interpolate(v1, v2, fracX);
        const i2 = this.interpolate(v3, v4, fracX);

        return this.interpolate(i1, i2, fracY);
    }

    interpolate(a, b, t) {
        // Smoothstep interpolation
        const ft = t * Math.PI;
        const f = (1 - Math.cos(ft)) * 0.5;
        return a * (1 - f) + b * f;
    }

    // Fractal noise (multiple octaves)
    perlin2D(x, y, octaves = 4, persistence = 0.5) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.smoothNoise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
}
