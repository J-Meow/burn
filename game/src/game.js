export class Game {
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = this.canvas.getContext("2d")
        this.resize()
        addEventListener("resize", this.resize.bind(this))
        this.draw()
    }
    resize() {
        this.canvas.width = innerWidth * devicePixelRatio
        this.canvas.height = innerHeight * devicePixelRatio
        this.width = innerWidth
        this.height = innerHeight
        this.ctx.resetTransform()
        this.ctx.scale(devicePixelRatio, devicePixelRatio)
    }
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height)
        this.ctx.fillStyle = "#ffeecc"
        this.ctx.fillRect(this.width / 2 - 100, this.height / 2 - 100, 200, 200)
        requestAnimationFrame(this.draw.bind(this))
    }
}
