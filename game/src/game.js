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
    consistentRandom = {}
    missionSequence = [
        // { type: "prop", value: 71000 },
        // { type: "burn", value: 1500 },
        { type: "startReport", value: 0 },
        { type: "prop", value: 60 * 60 },
        { type: "prop", value: 60 * 60 * 8 },
    ]
    lookAheadTime = 60 * 60 * 8
    gapTime = 60 * 10
    explodeTime = Infinity
    unpausableEndTime = -1
    success = false
    endInfo = ""
    remainingBurns = 2
    burnDirTick = 1000
    burnPreviewDir = "front"
    burnPreviewMoving = false
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
        this.burnDirCtx = document
            .getElementById("burndirdisplay")
            .getContext("2d")
        this.burnPreviewDir = document.getElementById("burndirfront").checked
            ? "front"
            : "back"
        document.getElementById("burndirback").addEventListener("input", () => {
            this.burnPreviewDir = document.getElementById("burndirfront")
                .checked
                ? "front"
                : "back"
        })
        document
            .getElementById("burndirfront")
            .addEventListener("input", () => {
                this.burnPreviewDir = document.getElementById("burndirfront")
                    .checked
                    ? "front"
                    : "back"
            })
        document
            .getElementById("burncontrol")
            .addEventListener(
                "mouseenter",
                () => (this.burnPreviewMoving = true),
            )
        document
            .getElementById("burncontrol")
            .addEventListener(
                "mouseleave",
                () => (this.burnPreviewMoving = false),
            )
        document
            .getElementById("burnduration")
            .addEventListener("input", (ev) => {
                ev.target.style.setProperty(
                    "--slider-value",
                    parseInt(ev.target.value) / parseInt(ev.target.max),
                )
                document.querySelector('[for="burnduration"]').innerText =
                    ev.target.value + "s"
            })
        document.getElementById("burnduration").value = 1000
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
    gameEnd() {
        document.getElementById("ingame").classList.remove("show")
        document.getElementById("end-screen").classList.add("show")
        document.querySelector("#end-screen h1").innerText = this.success
            ? "Mission Complete"
            : "Mission Failed"
        document.getElementById("end-info").innerText = this.endInfo
        document
            .getElementById("end-screen--try-again")
            .addEventListener("click", () => {
                location.reload()
                // i will make this better later
            })
        document
            .getElementById("end-screen--replay")
            .addEventListener("click", () => {
                document.getElementById("end-screen").classList.remove("show")
                document.getElementById("ingame").classList.add("show")
                this.unpausableEndTime = -1
                this.currentSeconds = 0
                if (!this.playing) this.playPause()
            })
    }
    updateData(callback, reportStartTime = 0) {
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
            if (this.data) {
                const reportStartIndex = this.data["Sat.ElapsedSecs"].findIndex(
                    (x) => x >= reportStartTime,
                )
                for (let i = 0; i < Object.keys(this.data).length; i++) {
                    const key = Object.keys(this.data)[i]
                    this.data[key] = this.data[key]
                        .slice(0, reportStartIndex)
                        .concat(data[key])
                }
            } else {
                this.data = data
            }
            this.explodeTime = Infinity
            const crashTime =
                this.data["Sat.ElapsedSecs"][
                    this.data["Sat.Altitude"].findIndex((x) => x <= 0)
                ]
            const tooFarTime =
                this.data["Sat.ElapsedSecs"][
                    this.data["Sat.ECC"].findIndex((x) => x >= 1)
                ]
            if (crashTime && (!tooFarTime || crashTime < tooFarTime)) {
                this.explodeTime = crashTime
                if (crashTime < this.totalSeconds - this.lookAheadTime) {
                    this.unpausableEndTime = crashTime + 60 * 20
                    this.success = false
                    this.endInfo = "Crashed into Earth"
                }
            }
            if (tooFarTime && (!crashTime || tooFarTime < crashTime)) {
                if (tooFarTime < this.totalSeconds - this.lookAheadTime) {
                    this.unpausableEndTime = tooFarTime
                    this.success = false
                    this.endInfo = "Drifted into space"
                }
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
            parseInt(document.getElementById("burnduration").value) < 1 ||
            (!document.getElementById("burndirfront").checked &&
                !document.getElementById("burndirback").checked) ||
            this.remainingBurns <= 0
        ) {
            return
        }
        this.missionSequence.splice(
            this.missionSequence.findIndex((x) => x.type == "startReport"),
            1,
        )
        this.missionSequence.pop()
        this.missionSequence.push({ type: "startReport", value: 0 })
        if (startTime - earliestAllowedTime) {
            this.missionSequence.push({
                type: "prop",
                value: startTime - earliestAllowedTime,
            })
        }
        this.missionSequence.push({
            type: "burn",
            value: parseInt(document.getElementById("burnduration").value),
            front: document.getElementById("burndirfront").checked,
        })
        this.missionSequence.push({ type: "prop", value: this.gapTime })
        this.missionSequence.push({ type: "prop", value: this.lookAheadTime })
        this.loading = true
        this.remainingBurns--
        document.getElementById("remainingburns").innerText =
            `Remaining burns: ${this.remainingBurns}`
        this.updateData(() => {
            if (this.unpausableEndTime < 0 && this.remainingBurns == 0) {
                this.unpausableEndTime =
                    this.totalSeconds - this.lookAheadTime + 60 * 60
                const eccentricity =
                    this.data["Sat.ECC"][this.data["Sat.ECC"].length - 1]
                const score = Math.round(
                    -(eccentricity - 0.442) * (1000 / 0.442),
                )
                this.success = score > 10
                this.endInfo = this.success
                    ? `Score: ${score}`
                    : score >= 0
                      ? "Orbit did not change enough"
                      : "Orbit became less circular"
            }
            this.sliderPos = 0
            this.playPause()
            this.loading = false
        }, earliestAllowedTime)
    }
    playPause(ev = null) {
        if (ev && this.unpausableEndTime >= 0) {
            return
        }
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
        if (this.unpausableEndTime >= 0) {
            return
        }
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
        if (this.burnPreviewMoving) {
            this.burnDirTick += delta
            this.burnDirTick %= 60000
            if (this.burnDirTick < 1000) this.burnDirTick = 1000
        }
        if (this.loading)
            this.loadProgressShowing +=
                ((1 -
                    Math.pow(1.1, -this.loadProgress) / 2 -
                    this.loadProgressShowing) /
                    500) *
                delta
        if (this.playing) {
            this.currentSeconds += delta
            if (this.currentSeconds >= this.totalSeconds) {
                this.moveSlider(1)
                this.playPause()
            } else {
                this.moveSlider(this.currentSeconds / this.totalSeconds)
                if (
                    this.unpausableEndTime >= 0 &&
                    this.currentSeconds > this.unpausableEndTime
                ) {
                    setTimeout(() => (this.playing = false), 500)
                    this.gameEnd()
                }
                if (
                    this.startedPlayBeforeNow &&
                    this.currentSeconds >
                        this.missionSequence
                            .slice(0, -1)
                            .reduce((a, x) => (a += x.value), 0) &&
                    this.unpausableEndTime < 0
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
        let randomNumIds = {}
        Object.keys(this.consistentRandom).forEach((x) => (randomNumIds[x] = 0))
        const getRandom = function getRandom(key = "default") {
            if (!(key in this.consistentRandom)) {
                this.consistentRandom[key] = []
                randomNumIds[key] = 0
            }
            if (this.consistentRandom[key].length == randomNumIds[key]) {
                for (let i = 0; i < 1000; i++) {
                    this.consistentRandom[key].push(Math.random())
                }
            }
            const numId = randomNumIds[key]
            randomNumIds[key]++
            return this.consistentRandom[key][numId]
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
                burnTimes.push([
                    elapsedSecs,
                    (elapsedSecs += item.value),
                    item.front,
                ])
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
                const burnData = burnTimes.filter(
                    (x) => x[0] < i && i < x[1],
                )[0]
                particleTick = 0
                particles.push({
                    x: this.data["Sat.EarthMJ2000Eq.X"][timeIndex],
                    y: this.data["Sat.EarthMJ2000Eq.Y"][timeIndex],
                    z: this.data["Sat.EarthMJ2000Eq.Z"][timeIndex],
                    vx:
                        this.data["Sat.EarthMJ2000Eq.VX"][timeIndex] *
                            (burnData[2] ? 2 : -1) +
                        (getRandom() - 0.5) * 6,
                    vy:
                        this.data["Sat.EarthMJ2000Eq.VY"][timeIndex] *
                            (burnData[2] ? 2 : -1) +
                        (getRandom() - 0.5) * 6,
                    vz:
                        this.data["Sat.EarthMJ2000Eq.VZ"][timeIndex] *
                            (burnData[2] ? 2 : -1) +
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
        let furthestDist = 0
        for (let i = 0; i < currentTimeIndex; i++) {
            furthestDist = Math.max(
                furthestDist,
                Math.sqrt(
                    Math.pow(this.data["Sat.EarthMJ2000Eq.X"][i], 2) +
                        Math.pow(this.data["Sat.EarthMJ2000Eq.Y"][i], 2) +
                        Math.pow(this.data["Sat.EarthMJ2000Eq.Z"][i], 2),
                ),
            )
        }
        this.camera.translate.z = -(Math.max(furthestDist - 20000, 0) + 12000)
        drawList
            .sort((a, b) => b.z - a.z)
            .forEach((item) => {
                item.func()
            })
        this.burnDirCtx.clearRect(0, 0, 200, 200)
        const burnDirGradient = this.burnDirCtx.createLinearGradient(
            0,
            100,
            100,
            100,
        )
        burnDirGradient.addColorStop(0, "#ffeecc00")
        burnDirGradient.addColorStop(1, "#ffeeccff")
        this.burnDirCtx.strokeStyle = burnDirGradient
        this.burnDirCtx.lineWidth = 2
        this.burnDirCtx.beginPath()
        this.burnDirCtx.arc(100, 200, 100, -Math.PI, -Math.PI / 2)
        this.burnDirCtx.stroke()
        this.burnDirCtx.fillStyle = "#ffeecc"
        this.burnDirCtx.beginPath()
        this.burnDirCtx.moveTo(100 - 6, 100)
        this.burnDirCtx.lineTo(100, 100 - 6)
        this.burnDirCtx.lineTo(100 + 6, 100)
        this.burnDirCtx.lineTo(100, 100 + 6)
        this.burnDirCtx.fill()
        let burnDirParticles = []
        randomNumIds["burnDirPreview"] += Math.floor(
            Math.max(0, this.burnDirTick - 1000) / 30,
        )
        for (
            let i = Math.max(0, this.burnDirTick - 1000);
            i < this.burnDirTick;
            i++
        ) {
            if (i % 30 == 1) {
                burnDirParticles.push({
                    x: 100,
                    y: 100,
                    vx: this.burnPreviewDir == "front" ? 0.2 : -0.2,
                    vy: (getRandom("burnDirPreview") - 0.5) / 4,
                    opacity: 0.6,
                })
            }
            burnDirParticles.forEach((x) => {
                x.x += x.vx
                x.y += x.vy
                x.opacity -= 0.001
            })
            burnDirParticles = burnDirParticles.filter((x) => x.opacity > 0)
        }
        burnDirParticles.forEach((x) => {
            this.burnDirCtx.globalAlpha = x.opacity
            this.burnDirCtx.beginPath()
            this.burnDirCtx.ellipse(x.x, x.y, 4, 4, 0, 0, Math.PI * 2)
            this.burnDirCtx.fill()
        })
        this.burnDirCtx.globalAlpha = 1
        if (this.loading) {
            this.ctx.fillStyle = "#0007"
            this.ctx.fillRect(0, 0, this.width, this.height)
            drawLoading()
        }
    }
}
