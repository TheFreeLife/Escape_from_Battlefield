export default class Input {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, leftDown: false, rightDown: false };
        this.wheel = 0;

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('wheel', (e) => this.onWheel(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable context menu
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
    }

    onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }

    onMouseDown(e) {
        if (e.button === 0) this.mouse.leftDown = true;
        if (e.button === 2) this.mouse.rightDown = true;
    }

    onMouseUp(e) {
        if (e.button === 0) this.mouse.leftDown = false;
        if (e.button === 2) this.mouse.rightDown = false;
    }

    onWheel(e) {
        this.wheel = e.deltaY;
    }

    isKeyPressed(code) {
        return !!this.keys[code];
    }

    // Check if key was pressed this frame (needs manual management usually, 
    // but for simple toggle we can use a set of "just pressed" keys if we track frames.
    // simpler: The consumer handles debounce effectively or we add a "down" timestamp.
    // Let's stick to Game.js clearing transient inputs or consumers handling unique presses.

    reset() {
        this.wheel = 0;
        // Advanced: clear "just pressed" map here if we had one
    }
}
