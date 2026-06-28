const focalLength = 300

export class Game {
    camera = {
        translate: {
            x: 0,
            y: 0,
            z: -10000,
        },
    }
    loading = true
    sliderDragging = false
    sliderPos = 0
    currentTimeIndex = 0
    playing = false
    elapsedSecsPlaying = 0
    lastTick = Date.now()
    constructor(canvas, timeControl) {
        this.canvas = canvas
        this.timeControl = timeControl
        this.timeControl
            .querySelector(".slider")
            .addEventListener("mousedown", this.sliderStart.bind(this))
        this.timeControl
            .querySelector(".playpause")
            .addEventListener("click", this.playPause.bind(this))
        addEventListener("mouseup", this.sliderStop.bind(this))
        this.ctx = this.canvas.getContext("2d")
        this.resize()
        addEventListener("resize", this.resize.bind(this))
        this.tick()
        this.draw()
        addEventListener("mousemove", this.mouseMove.bind(this))
        fetch(
            import.meta.env.VITE_GMAT_API_URL +
                "/calculate?script=apoapsis-lower",
        )
            .then((response) => response.text())
            .then((text) => {
                const lines = text.split("\n")
                const data = {}
                const keys = lines[0].split(",")
                keys.forEach((key) => {
                    data[key] = []
                })
                lines.slice(1, -1).forEach((line) => {
                    const values = line.split(",")
                    for (let i = 0; i < values.length; i++) {
                        data[keys[i]].push(
                            keys[i] == "Sat.A1Gregorian"
                                ? values[i]
                                : parseFloat(values[i]),
                        )
                    }
                })
                this.data = data
                this.moveSlider(1)
                this.loading = false
            })
    }
    playPause() {
        this.playing = !this.playing
        this.timeControl
            .querySelector(".playpause")
            .setAttribute("data-state", this.playing ? "pause" : "play")
        if (this.playing) {
            if (this.sliderPos == 1) {
                this.elapsedSecsPlaying = 0
            } else {
                this.elapsedSecsPlaying =
                    this.data["Sat.ElapsedSecs"][this.currentTimeIndex]
            }
        }
    }
    sliderStart(ev) {
        this.sliderDragging = true
        if (this.playing) this.playPause()
        this.sliderUpdate(ev.clientX)
    }
    sliderStop(ev) {
        this.sliderUpdate(ev.clientX)
        this.sliderDragging = false
    }
    moveSlider(pos) {
        this.sliderPos = pos
        this.timeControl
            .querySelector(".slider")
            .style.setProperty("--pos", this.sliderPos * 100 + "%")
        const seconds =
            this.sliderPos *
            this.data["Sat.ElapsedSecs"][
                this.data["Sat.ElapsedSecs"].length - 1
            ]
        this.currentTimeIndex =
            [...this.data["Sat.ElapsedSecs"], Infinity].findIndex(
                (x) => x > seconds,
            ) - 1
        this.timeControl.querySelector("span").innerText = this.data[
            "Sat.A1Gregorian"
        ][this.currentTimeIndex].slice(0, -4)
    }
    sliderUpdate(clientX) {
        if (this.sliderDragging) {
            const sliderBounds = this.timeControl
                .querySelector(".slider")
                .getBoundingClientRect()
            this.moveSlider(
                Math.max(
                    0,
                    Math.min(
                        (clientX - sliderBounds.left) / sliderBounds.width,
                        1,
                    ),
                ),
            )
        }
    }
    mouseMove(ev) {
        this.camera.translate.x =
            (5000 * (ev.clientX - this.width / 2)) / this.width
        this.camera.translate.y =
            (5000 * (ev.clientY - this.height / 2)) / this.height
        this.sliderUpdate(ev.clientX)
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
    tick() {
        setTimeout(this.tick.bind(this), 1000 / 60)
        const delta = Date.now() - this.lastTick
        this.lastTick = Date.now()
        if (this.playing) {
            this.elapsedSecsPlaying += delta * 10
            if (
                this.elapsedSecsPlaying >=
                this.data["Sat.ElapsedSecs"][
                    this.data["Sat.ElapsedSecs"].length - 1
                ]
            ) {
                this.moveSlider(1)
                this.playPause()
            } else {
                this.moveSlider(
                    this.elapsedSecsPlaying /
                        this.data["Sat.ElapsedSecs"][
                            this.data["Sat.ElapsedSecs"].length - 1
                        ],
                )
            }
        }
    }
    draw() {
        requestAnimationFrame(this.draw.bind(this))
        this.ctx.clearRect(0, 0, this.width, this.height)
        if (this.loading) {
            this.ctx.fillStyle = "#ffeecc"
            this.ctx.beginPath()
            this.ctx.ellipse(
                this.width / 2 +
                    40 * Math.cos(Date.now() / 300) +
                    (20 * Math.sin(Date.now() / 100) + 40) *
                        Math.sin(Date.now() / 200 + Math.PI / 2),
                this.height / 2 +
                    40 * Math.sin(Date.now() / 300) +
                    (20 * Math.sin(Date.now() / 100) + 40) *
                        Math.cos(Date.now() / 200 + Math.PI / 2),
                5,
                5,
                0,
                0,
                Math.PI * 2,
            )
            this.ctx.fill()
            this.ctx.beginPath()
            this.ctx.ellipse(
                this.width / 2 +
                    40 * Math.cos(Date.now() / 300) +
                    (20 * Math.sin(Date.now() / 100 + Math.PI / 2) + 40) *
                        Math.sin(Date.now() / 200 + Math.PI),
                this.height / 2 +
                    40 * Math.sin(Date.now() / 300) +
                    (20 * Math.sin(Date.now() / 100 + Math.PI / 2) + 40) *
                        Math.cos(Date.now() / 200 + Math.PI),
                5,
                5,
                0,
                0,
                Math.PI * 2,
            )
            this.ctx.fill()
            this.ctx.beginPath()
            this.ctx.ellipse(
                this.width / 2 +
                    40 * Math.cos(Date.now() / 300) +
                    (20 * Math.cos(Date.now() / 100) + 40) *
                        Math.sin(Date.now() / 200 + Math.PI * 1.5),
                this.height / 2 +
                    40 * Math.sin(Date.now() / 300) +
                    (20 * Math.cos(Date.now() / 100) + 40) *
                        Math.cos(Date.now() / 200 + Math.PI * 1.5),
                5,
                5,
                0,
                0,
                Math.PI * 2,
            )
            this.ctx.fill()
            this.ctx.beginPath()
            this.ctx.ellipse(
                this.width / 2 +
                    40 * Math.cos(Date.now() / 300) +
                    (20 * Math.cos(Date.now() / 100 + Math.PI / 2) + 40) *
                        Math.sin(Date.now() / 200),
                this.height / 2 +
                    40 * Math.sin(Date.now() / 300) +
                    (20 * Math.cos(Date.now() / 100 + Math.PI / 2) + 40) *
                        Math.cos(Date.now() / 200),
                5,
                5,
                0,
                0,
                Math.PI * 2,
            )
            this.ctx.fill()
            this.ctx.beginPath()
            this.ctx.ellipse(
                this.width / 2 + 40 * Math.cos(Date.now() / 300),
                this.height / 2 + 40 * Math.sin(Date.now() / 300),
                10,
                10,
                0,
                0,
                Math.PI * 2,
            )
            this.ctx.fill()
            return
        }
        const p = function p(x, y, z) {
            return this.project(...this.camTransform(x, y, z))
        }.bind(this)
        const drawList = []
        const sphere = function sphere(x, y, z, r) {
            const center = p(x, y, z)
            drawList.push({
                z: z - r,
                func: () => {
                    this.ctx.strokeStyle = "#ffeecc"
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.ellipse(
                        ...center,
                        Math.abs(p(x + r, y, z)[0] - center[0]),
                        Math.abs(p(x, y, z + r)[1] - center[1]),
                        0,
                        p(x, y, z + r)[1] - center[1] < 0 ? 0 : Math.PI,
                        p(x, y, z + r)[1] - center[1] < 0
                            ? Math.PI
                            : Math.PI * 2,
                    )
                    this.ctx.stroke()
                },
            })
            drawList.push({
                z: z + r,
                func: () => {
                    this.ctx.strokeStyle = "#ffeecc"
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.ellipse(
                        ...center,
                        Math.abs(p(x + r, y, z)[0] - center[0]),
                        Math.abs(p(x, y, z + r)[1] - center[1]),
                        0,
                        p(x, y, z + r)[1] - center[1] > 0 ? 0 : Math.PI,
                        p(x, y, z + r)[1] - center[1] > 0
                            ? Math.PI
                            : Math.PI * 2,
                    )
                    this.ctx.stroke()
                },
            })
            drawList.push({
                z: z - r,
                func: () => {
                    this.ctx.strokeStyle = "#ffeecc"
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.ellipse(
                        ...center,
                        Math.abs(p(x, y, z + r)[0] - center[0]),
                        Math.abs(p(x, y + r, z)[1] - center[1]),
                        0,
                        p(x, y, z + r)[0] - center[0] > 0
                            ? Math.PI / 2
                            : (Math.PI / 2) * 3,
                        p(x, y, z + r)[0] - center[0] > 0
                            ? (Math.PI / 2) * 3
                            : (Math.PI / 2) * 5,
                    )
                    this.ctx.stroke()
                },
            })
            drawList.push({
                z: z + r,
                func: () => {
                    this.ctx.strokeStyle = "#ffeecc"
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.ellipse(
                        ...center,
                        Math.abs(p(x, y, z + r)[0] - center[0]),
                        Math.abs(p(x, y + r, z)[1] - center[1]),
                        0,
                        p(x, y, z + r)[0] - center[0] > 0
                            ? -Math.PI / 2
                            : Math.PI / 2,
                        p(x, y, z + r)[0] - center[0] > 0
                            ? Math.PI / 2
                            : (Math.PI / 2) * 3,
                    )
                    this.ctx.stroke()
                },
            })
            drawList.push({
                z: z,
                func: () => {
                    this.ctx.fillStyle = "#000000aa"
                    this.ctx.strokeStyle = "#ffeecc"
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.ellipse(
                        ...center,
                        Math.abs(p(x + r, y, z)[0] - center[0]),
                        Math.abs(p(x, y + r, z)[1] - center[1]),
                        0,
                        0,
                        Math.PI * 2,
                    )
                    this.ctx.fill()
                    this.ctx.stroke()
                },
            })
        }.bind(this)
        sphere(0, 0, 0, 6378) // 6378 km is radius of earth according to wikipedia idk
        for (
            let i =
                [...this.data["Sat.ElapsedSecs"], Infinity].findIndex(
                    (x) =>
                        x >
                        this.data["Sat.ElapsedSecs"][this.currentTimeIndex] -
                            6000,
                ) - 1;
            i < this.currentTimeIndex;
            i++
        ) {
            drawList.push({
                z: this.data["Sat.EarthMJ2000Eq.Z"][i],
                func: () => {
                    this.ctx.strokeStyle =
                        "#ffeecc" +
                        Math.floor(
                            (Math.max(
                                0,
                                6000 -
                                    (this.data["Sat.ElapsedSecs"][
                                        this.currentTimeIndex
                                    ] -
                                        this.data["Sat.ElapsedSecs"][i]),
                            ) /
                                6000) *
                                256,
                        )
                            .toString(16)
                            .padStart(2, "0")
                    this.ctx.lineWidth = 2
                    this.ctx.beginPath()
                    this.ctx.moveTo(
                        ...p(
                            this.data["Sat.EarthMJ2000Eq.X"][i],
                            this.data["Sat.EarthMJ2000Eq.Y"][i],
                            this.data["Sat.EarthMJ2000Eq.Z"][i],
                        ),
                    )
                    this.ctx.lineTo(
                        ...p(
                            this.data["Sat.EarthMJ2000Eq.X"][i + 1],
                            this.data["Sat.EarthMJ2000Eq.Y"][i + 1],
                            this.data["Sat.EarthMJ2000Eq.Z"][i + 1],
                        ),
                    )
                    this.ctx.stroke()
                },
            })
        }
        drawList
            .sort((a, b) => b.z - a.z)
            .forEach((item) => {
                item.func()
            })
    }
}
