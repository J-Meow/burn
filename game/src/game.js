const focalLength = 300

export class Game {
    camera = {
        translate: {
            x: 0,
            y: 0,
            z: -100,
        },
    }
    constructor(canvas) {
        this.canvas = canvas
        this.ctx = this.canvas.getContext("2d")
        this.resize()
        addEventListener("resize", this.resize.bind(this))
        this.draw()
        addEventListener("mousemove", this.mouseMove.bind(this))
    }
    mouseMove(ev) {
        this.camera.translate.x =
            (50 * (ev.clientX - this.width / 2)) / this.width
        this.camera.translate.y =
            (50 * (ev.clientY - this.height / 2)) / this.height
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
            x - this.camera.translate.x,
            y - this.camera.translate.y,
            z - this.camera.translate.z,
        ]
    }
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height)
        this.ctx.fillStyle = "#000000aa"
        this.ctx.strokeStyle = "#ffeecc"
        this.ctx.lineWidth = 2
        const p = function p(x, y, z) {
            return this.project(...this.camTransform(x, y, z))
        }.bind(this)
        const drawList = []
        const origin = p(0, 0, 0)
        drawList.push({
            z: -50,
            func: () => {
                this.ctx.beginPath()
                this.ctx.ellipse(
                    ...origin,
                    Math.abs(p(50, 0, 0)[0] - origin[0]),
                    Math.abs(p(0, 0, 50)[1] - origin[1]),
                    0,
                    p(0, 0, 50)[1] - origin[1] < 0 ? 0 : Math.PI,
                    p(0, 0, 50)[1] - origin[1] < 0 ? Math.PI : Math.PI * 2,
                )
                this.ctx.stroke()
            },
        })
        drawList.push({
            z: 50,
            func: () => {
                this.ctx.beginPath()
                this.ctx.ellipse(
                    ...origin,
                    Math.abs(p(50, 0, 0)[0] - origin[0]),
                    Math.abs(p(0, 0, 50)[1] - origin[1]),
                    0,
                    p(0, 0, 50)[1] - origin[1] > 0 ? 0 : Math.PI,
                    p(0, 0, 50)[1] - origin[1] > 0 ? Math.PI : Math.PI * 2,
                )
                this.ctx.stroke()
            },
        })
        drawList.push({
            z: -50,
            func: () => {
                this.ctx.beginPath()
                this.ctx.ellipse(
                    ...origin,
                    Math.abs(p(0, 0, 50)[0] - origin[0]),
                    Math.abs(p(0, 50, 0)[1] - origin[1]),
                    0,
                    p(0, 0, 50)[0] - origin[0] > 0
                        ? Math.PI / 2
                        : (Math.PI / 2) * 3,
                    p(0, 0, 50)[0] - origin[0] > 0
                        ? (Math.PI / 2) * 3
                        : (Math.PI / 2) * 5,
                )
                this.ctx.stroke()
            },
        })
        drawList.push({
            z: 50,
            func: () => {
                this.ctx.beginPath()
                this.ctx.ellipse(
                    ...origin,
                    Math.abs(p(0, 0, 50)[0] - origin[0]),
                    Math.abs(p(0, 50, 0)[1] - origin[1]),
                    0,
                    p(0, 0, 50)[0] - origin[0] > 0 ? -Math.PI / 2 : Math.PI / 2,
                    p(0, 0, 50)[0] - origin[0] > 0
                        ? Math.PI / 2
                        : (Math.PI / 2) * 3,
                )
                this.ctx.stroke()
            },
        })
        drawList.push({
            z: 0,
            func: () => {
                this.ctx.beginPath()
                this.ctx.ellipse(
                    ...origin,
                    Math.abs(p(50, 0, 0)[0] - origin[0]),
                    Math.abs(p(0, 50, 0)[1] - origin[1]),
                    0,
                    0,
                    Math.PI * 2,
                )
                this.ctx.fill()
                this.ctx.stroke()
            },
        })
        drawList
            .sort((a, b) => b.z - a.z)
            .forEach((item) => {
                item.func()
            })
        requestAnimationFrame(this.draw.bind(this))
    }
}
