import { mkdir, copyFile, rm, appendFile } from "node:fs/promises"

console.log("Starting server on port 7755")
const scripts = {
    test: {
        path: "../gmat-misc/backend-test.script",
    },
    "apoapsis-lower": {
        path: "./scripts/apoapsis-lower.script",
        sequenceActions: {
            startReport: () => `Toggle ReportFile1 On\n`,
            prop: ({ value }) => {
                if (isNaN(value)) {
                    return false
                }
                if (typeof value != "number") {
                    return false
                }
                if (value <= 0) {
                    return false
                }
                if (value > 100000) {
                    return false
                }
                return `Propagate DefaultProp(Sat) {Sat.ElapsedSecs = ${value}};\n`
            },
            burn: ({ value, front }) => {
                if (typeof front != "boolean") {
                    return false
                }
                if (isNaN(value)) {
                    return false
                }
                if (typeof value != "number") {
                    return false
                }
                if (value <= 0) {
                    return false
                }
                if (value > 100000) {
                    return false
                }
                return `BeginFiniteBurn FiniteBurn${front ? "Front" : "Back"}(Sat)
Propagate DefaultProp(Sat) {Sat.ElapsedSecs = ${value}};
EndFiniteBurn FiniteBurn${front ? "Front" : "Back"}(Sat)\n`
            },
        },
    },
}
const cache = new Map()
const cacheUseTimes = []
const ips = new Map()
setInterval(() => {
    for (const [key, value] of ips) {
        if (value.startTime < Date.now() - 30000) {
            ips.delete(key)
        }
    }
}, 120000)
Bun.serve({
    port: 7755,
    idleTimeout: 0,
    routes: {
        "/": new Response("why hello there"),
        "/calculate": {
            GET: async (req) => {
                const url = new URL(req.url)
                const script = scripts[url.searchParams.get("script")]
                if (!script) {
                    return new Response(null, { status: 400 })
                }
                let extraScriptContent = ""
                try {
                    const sequenceJson = JSON.parse(
                        url.searchParams.get("sequence"),
                    )
                    if (sequenceJson.length > 20) {
                        return new Response(null, { status: 400 })
                    }
                    for (let i = 0; i < sequenceJson.length; i++) {
                        const action = sequenceJson[i]
                        if (
                            Object.keys(script.sequenceActions).includes(
                                action.type,
                            )
                        ) {
                            const newContent =
                                script.sequenceActions[action.type](action)
                            if (newContent) {
                                extraScriptContent += newContent
                            } else {
                                return new Response(null, { status: 400 })
                            }
                        }
                    }
                } catch (_) {}
                if (cache.has(script.path + ";" + extraScriptContent)) {
                    if (
                        cacheUseTimes.includes(
                            script.path + ";" + extraScriptContent,
                        )
                    ) {
                        cacheUseTimes.splice(
                            cacheUseTimes.indexOf(
                                script.path + ";" + extraScriptContent,
                            ),
                            1,
                        )
                    }
                    cacheUseTimes.push(script.path + ";" + extraScriptContent)
                    let res = new Response(
                        cache.get(script.path + ";" + extraScriptContent),
                    )
                    res.headers.set("Access-Control-Allow-Origin", "*")
                    return res
                } else {
                    if (ips.has(req.headers.get("X-Real-IP"))) {
                        let old = ips.get(req.headers.get("X-Real-IP"))
                        if (old.startTime < Date.now() - 30000) {
                            ips.set(req.headers.get("X-Real-IP"), {
                                startTime: Date.now(),
                                requests: 1,
                            })
                        } else {
                            if (old.requests > 10) {
                                return new Response("please slow down", {
                                    status: 419,
                                })
                            }
                            old.requests++
                            ips.set(req.headers.get("X-Real-IP"), old)
                        }
                    }
                    const runId = crypto.randomUUID()
                    await mkdir("tmp/" + runId, { recursive: true })
                    await copyFile(
                        script.path,
                        "tmp/" + runId + "/script.script",
                    )
                    await appendFile(
                        "tmp/" + runId + "/script.script",
                        extraScriptContent,
                    )
                    let success = false
                    try {
                        await Bun.$`${process.env.GMAT_PATH} ${process.cwd() + "/tmp/" + runId + "/script.script"}`
                        success = true
                    } catch (err) {
                        console.error(err)
                    }
                    let res
                    if (success) {
                        try {
                            const outFile = Bun.file(
                                "tmp/" + runId + "/out.txt",
                            )
                            const outText = await outFile.text()
                            cache.set(
                                script.path + ";" + extraScriptContent,
                                outText,
                            )
                            cacheUseTimes.push(
                                script.path + ";" + extraScriptContent,
                            )
                            if (cacheUseTimes.length > 10) {
                                cache.delete(cacheUseTimes.shift())
                            }
                            res = new Response(outText)
                        } catch (err) {
                            console.error(err)
                            res = new Response(null, { status: 500 })
                        }
                    } else {
                        res = new Response(null, { status: 500 })
                    }
                    await rm("tmp/" + runId, { recursive: true })
                    res.headers.set("Access-Control-Allow-Origin", "*")
                    return res
                }
            },
        },
    },
})
