#!/usr/bin/env python
"""
Very simple HTTP server in python.
Usage::
    ./dummy-web-server.py [<port>]
Send a GET request::
    curl http://localhost
Send a HEAD request::
    curl -I http://localhost
Send a POST request::
    curl -d "foo=bar&bin=baz" http://localhost
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
import re

class S(BaseHTTPRequestHandler):
    def _set_headers(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Headers", "Content-Disposition")
        self.end_headers()

    def do_GET(self):
        self._set_headers()
        self.wfile.write("<html><body><h1>hi!</h1></body></html>")

    def do_HEAD(self):
        self._set_headers()
        
    def do_POST(self):
        # Doesn't do anything with posted data
        print(self.headers)
        length = self.headers['Content-Length']
        data = self.rfile.read(int(length))
        d = self.headers['Content-Disposition']
        fname = re.findall("filename=(.+)", d)[0]
        print(fname)
        with open("my-looms/"+ fname, 'wb') as fh:
            fh.write(data)
        self._set_headers()
        
def run(server_class=HTTPServer, handler_class=S, port=50051):
    server_address = ('', port)
    try:
        httpd = server_class(server_address, handler_class)
        print('Starting PServer on port '+ str(port) +'...')
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("^C entered, stopping web server....")
        httpd.socket.close()


if __name__ == "__main__":
    from sys import argv

    if len(argv) == 2:
        run(port=int(argv[1]))
    else:
        run()