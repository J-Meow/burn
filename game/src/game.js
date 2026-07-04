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
    loadProgress = 0.5
    loadProgressShowing = 0
    loadTransparent = false
    sliderDragging = false
    sliderPos = 0
    currentSeconds = 0
    totalSeconds
    playing = false
    startedPlayBeforeNow = false
    lastTick = Date.now()
    consistentRandom = []
    missionSequence = [
        // { type: "prop", value: 71000 },
        // { type: "burn", value: 1500 },
        { type: "prop", value: 60 * 60 },
        { type: "prop", value: 60 * 60 * 8 },
    ]
    lookAheadTime = 60 * 60 * 8
    gapTime = 60 * 10
    explodeTime = Infinity
    constructor(canvas, timeControl) {
        for (let i = 0; i < 1000; i++) {
            this.consistentRandom.push(Math.random())
        }
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
        document
            .getElementById("burnstart")
            .addEventListener("click", this.startBurn.bind(this))
        this.updateData(() => {
            this.moveSlider(0)
            this.playPause()
            this.loading = false
            this.loadTransparent = true
            this.canvas.parentElement.classList.remove("loading")
        })
    }
    updateData(callback) {
        this.totalSeconds = this.missionSequence.reduce(
            (a, x) => (a += x.value),
            0,
        )
        this.loadProgress = 0
        this.loadProgressShowing = 0
        const xhr = new XMLHttpRequest()
        xhr.open(
            "GET",
            import.meta.env.VITE_GMAT_API_URL +
                "/calculate?script=apoapsis-lower&sequence=" +
                encodeURIComponent(JSON.stringify(this.missionSequence)),
            true,
        )
        xhr.onprogress = (ev) => {
            this.loadProgress = ev.loaded / 10000
        }
        xhr.onload = () => {
            const lines = xhr.responseText.split("\n")
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
            const crashTime =
                this.data["Sat.ElapsedSecs"][
                    this.data["Sat.Altitude"].findIndex((x) => x <= 0)
                ]
            if (crashTime) {
                this.explodeTime = crashTime
            }
            callback()
        }
        xhr.send()
    }
    startBurn() {
        if (this.playing) this.playPause()
        const startTime = this.currentSeconds
        const totalLength = this.missionSequence.reduce(
            (a, x) => (a += x.value),
            0,
        )
        const earliestAllowedTime = totalLength - this.lookAheadTime
        if (
            startTime < earliestAllowedTime ||
            parseInt(document.getElementById("burnduration").value) < 1
        ) {
            return
        }
        this.missionSequence.pop()
        if (startTime - earliestAllowedTime) {
            this.missionSequence.push({
                type: "prop",
                value: startTime - earliestAllowedTime,
            })
        }
        this.missionSequence.push({
            type: "burn",
            value: parseInt(document.getElementById("burnduration").value),
        })
        this.missionSequence.push({ type: "prop", value: this.gapTime })
        this.missionSequence.push({ type: "prop", value: this.lookAheadTime })
        this.loading = true
        this.updateData(() => {
            this.sliderPos = 0 // setting to 0 here so that this.elapsedSecsPlaying isn't set to 0 in playPause(). the actual value doesn't matter much here as long as it's not 1
            this.playPause()
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
                this.currentSeconds = 0
            }
            if (
                this.currentSeconds <
                this.missionSequence
                    .slice(0, -1)
                    .reduce((a, x) => (a += x.value), 0)
            ) {
                this.startedPlayBeforeNow = true
            } else {
                this.startedPlayBeforeNow = false
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
        const seconds = this.sliderPos * this.totalSeconds
        this.currentSeconds = seconds
        const secsDifference =
            seconds -
            this.missionSequence
                .slice(0, -1)
                .reduce((a, x) => (a += x.value), 0)
        this.timeControl.querySelector("span").innerText =
            Math.abs(secsDifference) < 1
                ? "NOW"
                : (secsDifference > 0 ? "+" : "-") +
                  `${Math.floor(Math.abs(secsDifference) / 3600)
                      .toString()
                      .padStart(
                          2,
                          "0",
                      )}:${(Math.floor(Math.abs(secsDifference) / 60) % 60).toString().padStart(2, "0")}:${Math.floor(
                      Math.abs(secsDifference) % 60,
                  )
                      .toString()
                      .padStart(2, "0")}`
    }
    sliderUpdate(clientX) {
        if (this.sliderDragging) {
            const sliderBounds = this.timeControl
                .querySelector(".slider")
                .getBoundingClientRect()
            const totalSecs = this.missionSequence.reduce(
                (a, x) => (a += x.value),
                0,
            )
            const nowTime = this.missionSequence
                .slice(0, -1)
                .reduce((a, x) => (a += x.value), 0)
            const nowPos = nowTime / this.totalSeconds
            let pos = Math.max(
                0,
                Math.min((clientX - sliderBounds.left) / sliderBounds.width, 1),
            )
            if (pos > nowPos - 0.005 && pos < nowPos + 0.005) {
                pos = nowPos
            }
            this.moveSlider(pos)
        }
    }
    mouseMove(ev) {
        this.camera.translate.x =
            (5000 * (ev.clientX - this.canvas.width / devicePixelRatio / 2)) /
            (this.canvas.width / devicePixelRatio)
        this.camera.translate.y =
            (5000 * (ev.clientY - this.canvas.height / devicePixelRatio / 2)) /
            (this.canvas.height / devicePixelRatio)
        this.sliderUpdate(ev.clientX)
    }
    resize() {
        this.canvas.width = innerWidth * devicePixelRatio
        this.canvas.height = innerHeight * devicePixelRatio
        const scale = innerWidth / 1400
        this.width = innerWidth / scale
        this.height = innerHeight / scale
        this.ctx.resetTransform()
        this.ctx.scale(devicePixelRatio * scale, devicePixelRatio * scale)
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
        if (this.loading)
            this.loadProgressShowing +=
                ((1 -
                    Math.pow(1.3, -this.loadProgress) / 2 -
                    this.loadProgressShowing) /
                    200) *
                delta
        if (this.playing) {
            this.currentSeconds += delta
            if (this.currentSeconds >= this.totalSeconds) {
                this.moveSlider(1)
                this.playPause()
            } else {
                this.moveSlider(this.currentSeconds / this.totalSeconds)
                if (
                    this.startedPlayBeforeNow &&
                    this.currentSeconds >
                        this.missionSequence
                            .slice(0, -1)
                            .reduce((a, x) => (a += x.value), 0)
                ) {
                    this.startedPlayBeforeNow = false
                    this.playPause()
                    this.moveSlider(
                        this.missionSequence
                            .slice(0, -1)
                            .reduce((a, x) => (a += x.value), 0) /
                            this.totalSeconds,
                    )
                }
            }
        }
    }
    draw() {
        requestAnimationFrame(this.draw.bind(this))
        this.ctx.clearRect(0, 0, this.width, this.height)
        const drawLoading = function drawLoading() {
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
            this.ctx.fillRect(
                this.width / 2 - 100,
                this.height / 2 + 120,
                200 * this.loadProgressShowing,
                10,
            )
            this.ctx.fillStyle = "#ffeecc33"
            this.ctx.fillRect(
                this.width / 2 - 100 + 200 * this.loadProgressShowing,
                this.height / 2 + 120,
                200 - 200 * this.loadProgressShowing,
                10,
            )
        }.bind(this)
        if (this.loading && !this.loadTransparent) {
            drawLoading()
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
        const currentTimeIndex =
            this.data["Sat.ElapsedSecs"]
                .concat([Infinity])
                .findIndex(
                    (x) => x > this.currentSeconds || x > this.explodeTime,
                ) - 1
        const startTimeIndex =
            this.data["Sat.ElapsedSecs"]
                .concat([Infinity])
                .findIndex((x) => x > this.currentSeconds - 6000) - 1
        for (let i = startTimeIndex; i < currentTimeIndex; i++) {
            drawList.push({
                z: this.data["Sat.EarthMJ2000Eq.Z"][i],
                func: () => {
                    this.ctx.strokeStyle =
                        "#ffeecc" +
                        Math.floor(
                            (Math.max(
                                0,
                                6000 -
                                    (this.currentSeconds -
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
        if (this.currentSeconds < this.explodeTime) {
            drawList.push({
                z: this.data["Sat.EarthMJ2000Eq.Z"][currentTimeIndex],
                func: () => {
                    this.ctx.fillStyle = "#ffeecc"
                    this.ctx.beginPath()
                    const point = p(
                        this.data["Sat.EarthMJ2000Eq.X"][currentTimeIndex],
                        this.data["Sat.EarthMJ2000Eq.Y"][currentTimeIndex],
                        this.data["Sat.EarthMJ2000Eq.Z"][currentTimeIndex],
                    )
                    const x = point[0],
                        y = point[1]
                    this.ctx.moveTo(x - 6, y)
                    this.ctx.lineTo(x, y - 6)
                    this.ctx.lineTo(x + 6, y)
                    this.ctx.lineTo(x, y + 6)
                    this.ctx.fill()
                },
            })
        }
        let randomNumId = 0
        const getRandom = function getRandom() {
            if (this.consistentRandom.length == randomNumId) {
                for (let i = 0; i < 1000; i++) {
                    this.consistentRandom.push(Math.random())
                }
            }
            return this.consistentRandom[randomNumId++]
        }.bind(this)
        let particles = []
        let timeIndex = 0
        let particleTick = 0
        let burnTimes = []
        let elapsedSecs = 0
        this.missionSequence.forEach((item) => {
            if (item.type == "prop") {
                elapsedSecs += item.value
            }
            if (item.type == "burn") {
                burnTimes.push([elapsedSecs, (elapsedSecs += item.value)])
            }
        })
        let explosionDone = false
        for (let i = 0; i < this.currentSeconds; i++) {
            particleTick++
            while (this.data["Sat.ElapsedSecs"][timeIndex] < i) {
                timeIndex++
            }
            if (!explosionDone && i > this.explodeTime) {
                explosionDone = true
                for (let j = 0; j < 40; j++) {
                    particles.push({
                        x: this.data["Sat.EarthMJ2000Eq.X"][timeIndex],
                        y: this.data["Sat.EarthMJ2000Eq.Y"][timeIndex],
                        z: this.data["Sat.EarthMJ2000Eq.Z"][timeIndex],
                        vx: (getRandom() - 0.5) * 5,
                        vy: (getRandom() - 0.5) * 5,
                        vz: (getRandom() - 0.5) * 5,
                        size: getRandom() * 2 + 2,
                        lifeLeft: 3000,
                        fullBrightLifeLeft: 8000,
                    })
                }
            }
            if (
                !explosionDone &&
                burnTimes.filter((x) => x[0] < i && i < x[1]).length &&
                particleTick >= 10
            ) {
                particleTick = 0
                particles.push({
                    x: this.data["Sat.EarthMJ2000Eq.X"][timeIndex],
                    y: this.data["Sat.EarthMJ2000Eq.Y"][timeIndex],
                    z: this.data["Sat.EarthMJ2000Eq.Z"][timeIndex],
                    vx:
                        this.data["Sat.EarthMJ2000Eq.VX"][timeIndex] * 2 +
                        (getRandom() - 0.5) * 6,
                    vy:
                        this.data["Sat.EarthMJ2000Eq.VY"][timeIndex] * 2 +
                        (getRandom() - 0.5) * 6,
                    vz:
                        this.data["Sat.EarthMJ2000Eq.VZ"][timeIndex] * 2 +
                        (getRandom() - 0.5) * 6,
                    size: getRandom() * 2 + 2,
                    lifeLeft: 300,
                    fullBrightLifeLeft: 800,
                })
            }
            particles.forEach((particle) => {
                particle.x += particle.vx
                particle.y += particle.vy
                particle.z += particle.vz
                particle.lifeLeft -= 1
            })
            particles = particles.filter((x) => x.lifeLeft > 0)
        }
        particles.forEach((particle) => {
            drawList.push({
                z: particle.z,
                func: () => {
                    this.ctx.fillStyle = "#ffeecc"
                    this.ctx.globalAlpha =
                        particle.lifeLeft / particle.fullBrightLifeLeft
                    this.ctx.beginPath()
                    const point = p(particle.x, particle.y, particle.z)
                    const x = point[0],
                        y = point[1]
                    this.ctx.ellipse(
                        x,
                        y,
                        particle.size,
                        particle.size,
                        0,
                        0,
                        Math.PI * 2,
                    )
                    this.ctx.fill()
                    this.ctx.globalAlpha = 1
                },
            })
        })
        drawList
            .sort((a, b) => b.z - a.z)
            .forEach((item) => {
                item.func()
            })
        if (this.loading) {
            this.ctx.fillStyle = "#0007"
            this.ctx.fillRect(0, 0, this.width, this.height)
            drawLoading()
        }
    }
}
