import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

import spiceypy as spice

spice.furnsh("./de430.bsp")
spice.furnsh("./latest_leapseconds.tls")


class MyServer(BaseHTTPRequestHandler):
    def do_GET(req):
        url = urlsplit(req.path)
        query = parse_qs(url.query)
        if(url.path == "/health"):
            req.send_response(200)
            req.send_header("Access-Control-Allow-Origin", "*")
            req.send_header("Content-Type", "application/json")
            req.end_headers()
            req.wfile.write(bytes(json.dumps({"up": True}), "utf-8"))
        elif(url.path == "/spkpos"):
            print(url)
            print(query)
            start_time = spice.str2et(query["time"][0])
            def calc(time):
                return spice.spkpos(query["targ"][0], time, "J2000", "NONE", query["obs"][0])
            if("interval" in query):
                results = []
                for x in range(int(query["intervalcount"][0])):
                    result = calc(start_time + x * int(query["interval"][0]))
                    results.append({"x": result[0][0], "y": result[0][1], "z": result[0][2]})
                req.send_response(200)
                req.send_header("Access-Control-Allow-Origin", "*")
                req.send_header("Content-Type", "application/json")
                req.end_headers()
                req.wfile.write(bytes(json.dumps({"ok": True, "result": results}), "utf-8"))
            else:
                result = calc(start_time)
                req.send_response(200)
                req.send_header("Access-Control-Allow-Origin", "*")
                req.send_header("Content-Type", "application/json")
                req.end_headers()
                req.wfile.write(bytes(json.dumps({"ok": True, "result": {"x": result[0][0], "y": result[0][1], "z": result[0][2]}}), "utf-8"))
        else:
            req.send_response(404)
            req.end_headers()
            req.wfile.write(bytes("404", "utf-8"))

if __name__ == "__main__":
    webServer = HTTPServer(("0.0.0.0", 7744), MyServer)
    print("Server started on port 7744")

    try:
        webServer.serve_forever()
    except KeyboardInterrupt:
        pass

    webServer.server_close()
