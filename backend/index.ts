console.log("Starting server on port 7755")
Bun.serve({
    port: 7755,
    routes: {
        "/": new Response("why hello there"),
    },
})

