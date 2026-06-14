import { mkdir, copyFile, rm } from "node:fs/promises"

console.log("Starting server on port 7755")
const scripts = {
    test: {
        path: "../gmat-misc/backend-test.script",
    },
}
Bun.serve({
    port: 7755,
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
                await Bun.$`${process.env.GMAT_PATH} ${process.cwd() + "/tmp/" + runId + "/script.script"}`
                const outFile = Bun.file("tmp/" + runId + "/out.txt")
                const outText = await outFile.text()
                await rm("tmp/" + runId, { recursive: true })
                const res = new Response(outText)
                res.headers.set("Access-Control-Allow-Origin", "*")
                return res
            },
        },
    },
})

