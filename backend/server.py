import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class MyServer(BaseHTTPRequestHandler):
    def do_GET(req):
        if(req.path == "/health"):
            req.send_response(200)
            req.send_header("Access-Control-Allow-Origin", "*")
            req.send_header("Content-Type", "application/json")
            req.end_headers()
            req.wfile.write(bytes(json.dumps({"up": True}), "utf-8"))
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
