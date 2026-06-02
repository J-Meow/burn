const { createCanvas } = require("canvas")
const canvas = createCanvas(5000, 5000)
const ctx = canvas.getContext("2d")
const fs = require("fs")

const report = fs.readFileSync("./lunar-transfer-report.txt", {
    encoding: "utf-8",
})
const reportData = report
    .split("\n")
    .slice(0, -1)
    .map((x) => x.split(","))
const valueNames = reportData[0]
const values = reportData.slice(1)
let minX = 0
let maxX = 0
let minY = 0
let maxY = 0
let minZ = 0
let maxZ = 0
values.forEach((line) => {
    const x = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.X")])
    if (minX > x) minX = x
    if (maxX < x) maxX = x
    const y = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.Y")])
    if (minY > y) minY = y
    if (maxY < y) maxY = y
    const z = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.Z")])
    if (minZ > z) minZ = z
    if (maxZ < z) maxZ = z
})
const maxDifference = Math.max(
    Math.abs(maxX - minX),
    Math.abs(maxY - minY),
    Math.abs(maxZ - minZ),
)

ctx.fillStyle = "black"
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.lineWidth = 10
ctx.shadowBlur = 50
ctx.shadowOffsetX = 0
ctx.shadowOffsetY = 0
ctx.lineCap = "round"
ctx.beginPath()
values.forEach((line) => {
    const x = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.X")])
    const y = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.Y")])
    const z = parseFloat(line[valueNames.indexOf("Sat.EarthMJ2000Eq.Z")])
    const elapsedSecs = parseFloat(line[valueNames.indexOf("Sat.ElapsedSecs")])
    const time =
        elapsedSecs /
        parseFloat(
            values[values.length - 1][valueNames.indexOf("Sat.ElapsedSecs")],
        )
    ctx.shadowColor = `hsl(${time * 360} 100% 50%)`
    ctx.strokeStyle = `hsl(${time * 360} 50% 80%)`
    ctx.lineTo(
        (x / maxDifference) * (canvas.width / 2) + canvas.width / 2,
        (y / maxDifference) * (canvas.height / 2) + canvas.height / 2,
    )
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(
        (x / maxDifference) * (canvas.width / 2) + canvas.width / 2,
        (y / maxDifference) * (canvas.height / 2) + canvas.height / 2,
    )
})

const out = fs.createWriteStream(__dirname + "/visualization.png")
const stream = canvas.createPNGStream()
stream.pipe(out)
out.on("finish", () => console.log("Saved image"))
