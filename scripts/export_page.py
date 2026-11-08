"""Purpose and main functions: Export saved graphs and shared viewer resources as one independent HTML page.

Scope: Selected saved graph and its available navigation within one result project; write a new named delivery inside the skill.
"""
from __future__ import annotations
import json
import re

from graph_store import SKILL, graph_catalog, log_update, safe_relative
from server import graph_payload


def export(store, source, name, *, language='en', theme='system'):
    safe_relative(name)
    if '/' in name:
        raise ValueError('Choose one delivery directory name')
    if language not in {'en', 'zh'}:
        raise ValueError('Choose en or zh')
    if theme not in {'system', 'light', 'dark'}:
        raise ValueError('Choose system, light or dark')
    catalog = graph_catalog(store)
    selected = next((item for item in catalog if source in {item['source'], item['id']}), None)
    if not selected or selected.get('available') is False:
        raise ValueError('Select a saved graph for export')
    source = selected['source']
    # Include navigation descendants plus ancestors for returning to containing graphs.
    included = [item for item in catalog if item['source'] == source
                or item['source'].startswith(source + '/') or source.startswith(item['source'] + '/')]
    graphs = {item['id']: graph_payload(store, item['id'], catalog) for item in included}
    included_sources = {item['source'] for item in included}
    for payload in graphs.values():
        graph = payload.get('graph')
        if not graph:
            continue
        for hint in graph['display']['L2']['nodes'].values():
            detail = hint.get('detail_graph')
            if detail and detail['source'] not in included_sources:
                hint.pop('detail_graph')
    assets = SKILL / 'assets' / 'viewer'
    worker = (assets / 'caption_worker.js').read_text(encoding='utf-8').replace("importScripts('./inline_labels.js');", (assets / 'inline_labels.js').read_text(encoding='utf-8'))
    bundle = {'source': source, 'language': language, 'theme': theme, 'catalog': included, 'graphs': graphs, 'worker': worker}
    encoded = json.dumps(bundle, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    html = (assets / 'index.html').read_text(encoding='utf-8')

    def style(match):
        css = (assets / match[1]).read_text(encoding='utf-8')
        if re.search(r'</style', css, re.I):
            raise ValueError('Stylesheet contains an HTML closing tag')
        return '<style>\n' + css + '\n</style>'

    def script(match):
        js = (assets / match[1]).read_text(encoding='utf-8')
        # These are trusted bundled resources; graph text is isolated as escaped JSON.
        if re.search(r'</script', js, re.I):
            raise ValueError('Script resource contains an HTML closing tag')
        return '<script>\n' + js + '\n</script>'

    html = re.sub(r'<link rel="stylesheet" href="/extract-structure/assets/([^"/]+)">', style, html)
    html = html.replace('<script src=', '<script id="extractStructureBundle" type="application/json">' + encoded + '</script>\n<script src=', 1)
    html = re.sub(r'<script src="/extract-structure/assets/([^"/]+)" defer></script>', script, html)
    directory = (store.directory / 'deliveries' / name).resolve()
    directory.relative_to(store.directory.resolve())
    directory.mkdir(parents=True, exist_ok=False)
    path = directory / 'index.html'
    path.write_text(html, encoding='utf-8')
    log_update(store.directory, path, 'Export independent interactive page', __file__)
    return {'project_id': store.id, 'source': source, 'path': str(path), 'graph_count': sum(bool(p.get('graph')) for p in graphs.values()), 'language': language}
