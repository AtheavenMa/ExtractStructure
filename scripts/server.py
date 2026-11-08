"""Purpose and main functions: Independently serve ExtractStructure pages, project graph catalogs, and graph data.

Scope: Start when users view existing results within the skill; serve drawing resources and graph JSON for the lifetime of the process.
"""
from __future__ import annotations
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from urllib.parse import quote, unquote, urlsplit
from graph_store import SKILL, PREFIX, graph_catalog, read_graph, graph_id_for

ASSETS = frozenset({'index.html', 'bootstrap.js', 'i18n.js', 'viewer.js', 'viewer.css',
    'atlas-shell.css', 'runtime.js', 'orthogonal.js', 'inline_labels.js', 'caption_worker.js', 'concept_ranges.js', 'expansion_layout.js'})


def graph_payload(store, requested, catalog=None):
    """Read a graph and attach currently available navigation without changing saved data."""
    catalog = graph_catalog(store) if catalog is None else catalog
    navigation = next((g for g in catalog
        if g.get('available') is False and requested in {g['id'], g['source']}), None)
    if navigation:
        value = {'graph': None, 'source': navigation['source'], 'available': False}
    else:
        graph, digest = read_graph(store, requested)
        # Attach details from the current catalog without rewriting saved explanations.
        if graph.get('graph_kind') == 'folder':
            available = {g['source']: g for g in catalog if g.get('available') is not False}
            for node in graph['graphs']['L2']['nodes']:
                entry = node.get('file') or node.get('folder')
                hints = graph['display']['L2']['nodes'][node['id']]
                hints.pop('detail_graph', None)
                target = available.get(entry)
                if target or node.get('entry_kind') == 'folder':
                    hints['detail_graph'] = {'id': target['id'] if target else graph_id_for(entry, folder=True), 'source': entry}
        digest = hashlib.sha256(json.dumps(graph, sort_keys=True).encode()).hexdigest()
        value = {'graph': graph, 'sha256': digest}
    return value


def serve(store, *, port=0, source=None):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = unquote(urlsplit(self.path).path)
            try:
                if path == '/':
                    self.send_response(302)
                    self.send_header('Location', PREFIX)
                    self.end_headers()
                    return
                if not path.startswith(PREFIX):
                    raise FileNotFoundError('Unknown page')
                tail = path[len(PREFIX):]
                if tail.startswith('assets/'):
                    name = tail[len('assets/'):]
                    if name not in ASSETS:
                        raise FileNotFoundError('Unknown page resource')
                    raw = (SKILL / 'assets' / 'viewer' / name).read_bytes()
                    mime = mimetypes.guess_type(name)[0] or 'application/octet-stream'
                elif tail == 'data/':
                    raw = json.dumps({'graphs': graph_catalog(store)}, ensure_ascii=False).encode()
                    mime = 'application/json'
                elif tail.startswith('data/') and tail.endswith('.json'):
                    requested = tail[len('data/'):-len('.json')]
                    value = graph_payload(store, requested)
                    raw = json.dumps(value, ensure_ascii=False).encode()
                    mime = 'application/json'
                else:
                    if tail and not any(g['source'] == tail.rstrip('/') for g in graph_catalog(store)):
                        raise FileNotFoundError('No ExtractStructure result for this path')
                    raw = (SKILL / 'assets' / 'viewer' / 'index.html').read_bytes()
                    mime = 'text/html'
                self.send_response(200)
                self.send_header('Content-Type', mime + '; charset=utf-8')
                self.send_header('Content-Length', str(len(raw)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(raw)
            except (OSError, ValueError, KeyError, TypeError) as error:
                raw = json.dumps({'error': str(error)}, ensure_ascii=False).encode()
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

        def log_message(self, format, *args):
            pass

    if source and not any(g['source'] == source for g in graph_catalog(store)):
        raise ValueError('Requested graph has not been saved')
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    origin = 'http://127.0.0.1:' + str(server.server_address[1])
    print(origin + PREFIX + quote(source or '', safe='/') + '?lang=zh', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
