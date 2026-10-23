"""Serve a repository subpath so root-absolute URL mistakes fail during local QA."""
import argparse
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,unquote

ROOT=Path(__file__).resolve().parents[1]/'docs'
PREFIX='/agent-engineering-notes/'


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path=urlsplit(self.path).path
        if not path.startswith(PREFIX):
            self.send_error(404);return
        self.path=path[len(PREFIX)-1:]
        super().do_GET()

    def translate_path(self,path):
        relative=unquote(urlsplit(path).path).lstrip('/')
        resolved=(ROOT/relative).resolve()
        return str(resolved) if resolved.is_relative_to(ROOT) else str(ROOT/'missing')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--host',default='127.0.0.1');parser.add_argument('--port',type=int,default=8092);args=parser.parse_args()
    print(f'Preview: http://{args.host}:{args.port}{PREFIX}',flush=True)
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
