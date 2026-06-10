import os, http.server, socketserver
os.chdir('/Users/israel.lormendez/Documents/griep-mendes-website')
PORT = 8765
with socketserver.TCPServer(('', PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f'Serving at http://localhost:{PORT}')
    httpd.serve_forever()
