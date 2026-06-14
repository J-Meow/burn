import { mkdir, copyFile, rm } from "node:fs/promises"

console.log("Starting server on port 7755")
const scripts = {
    test: {
        path: "../gmat-misc/backend-test.script",
    },
}
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
                console.log(script)
                const runId = crypto.randomUUID()
                await mkdir("tmp/" + runId, { recursive: true })
                await copyFile(script.path, "tmp/" + runId + "/script.script")
                let success = false
                try {
                    await Bun.$`${process.env.GMAT_PATH} ${process.cwd() + "/tmp/" + runId + "/script.script"}`
                    success = true
                } catch (err) {
                    console.error(err)
                }
                let res
                if (success) {
                    const outFile = Bun.file("tmp/" + runId + "/out.txt")
                    const outText = await outFile.text()
                    res = new Response(outText)
                } else {
                    res = new Response(null, { status: 500 })
                }
                await rm("tmp/" + runId, { recursive: true })
                res.headers.set("Access-Control-Allow-Origin", "*")
                return res
            },
        },
    },
})

