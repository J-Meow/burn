const focalLength = 300

export class Game {
    camera = {
        translate: {
            x: 0,
            y: 0,
            z: 100,
        },
    }
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = this.canvas.getContext("2d")
        this.resize()
        addEventListener("resize", this.resize.bind(this))
        this.draw()
        this.canvas.addEventListener("mousemove", this.mouseMove.bind(this))
    }
    mouseMove(ev) {
        if (ev.buttons & 1) {
            this.camera.translate.x += ev.movementX
            this.camera.translate.y += ev.movementY
        }
    }
    resize() {
        this.canvas.width = innerWidth * devicePixelRatio
        this.canvas.height = innerHeight * devicePixelRatio
        this.width = innerWidth
        this.height = innerHeight
        this.ctx.resetTransform()
        this.ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    project(x, y, z) {
        return [
            x * (focalLength / z) + this.width / 2,
            y * (focalLength / z) + this.height / 2,
        ]
    }
    camTransform(x, y, z) {
        return [
            x + this.camera.translate.x,
            y + this.camera.translate.y,
            z + this.camera.translate.z,
        ]
    }
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height)
        this.ctx.fillStyle = "#ffeecc"
        this.ctx.strokeStyle = "#ffeecc"
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.moveTo(...this.project(...this.camTransform(-10, 10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, 10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, -10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, -10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, 10, 10)))
        this.ctx.moveTo(...this.project(...this.camTransform(-10, 10, -10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, 10, -10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, -10, -10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, -10, -10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, 10, -10)))
        this.ctx.moveTo(...this.project(...this.camTransform(-10, 10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, 10, -10)))
        this.ctx.moveTo(...this.project(...this.camTransform(10, 10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, 10, -10)))
        this.ctx.moveTo(...this.project(...this.camTransform(10, -10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(10, -10, -10)))
        this.ctx.moveTo(...this.project(...this.camTransform(-10, -10, 10)))
        this.ctx.lineTo(...this.project(...this.camTransform(-10, -10, -10)))
        this.ctx.stroke()
        requestAnimationFrame(this.draw.bind(this))
    }
}
