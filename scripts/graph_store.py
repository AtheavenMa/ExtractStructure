"""Purpose and main functions: Store project and graph data inside ExtractStructure and connect folders, files, and browsable folder views.

Scope: Internal saving and page access; results reside in this skill's results directory while target source remains read-only.
"""
from __future__ import annotations
import copy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
from urllib.parse import quote
from layout import square_layout, validate_display

SKILL = Path(__file__).resolve().parents[1]
PREFIX = '/extract-structure/'


def safe_relative(value):
    if not isinstance(value, str) or not value or '\\' in value or '\x00' in value:
        raise ValueError('Expected a relative path')
    parts = value.split('/')
    if PurePosixPath(value).is_absolute() or any(p in {'', '.', '..'} for p in parts):
        raise ValueError('Path must stay inside its selected directory')
    return value


def graph_id_for(source, *, folder=False):
    return ('folders/' if folder else 'files/') + safe_relative(source)


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent, delete=False) as stream:
            name = stream.name
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(name, path)
    finally:
        if name and Path(name).exists():
            Path(name).unlink()


def log_update(directory, path, content, source):
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'log_updates.jsonl').open('a', encoding='utf-8') as stream:
        stream.write(json.dumps({'time': datetime.now(timezone.utc).isoformat(),
            'path': path.relative_to(SKILL).as_posix(), 'content': content,
            'source': source}, ensure_ascii=False) + '\n')


class Store:
    def __init__(self, project, *, result_id=None):
        self.skill = SKILL
        self.project = Path(project).expanduser().resolve()
        self.root = self.project.parent
        slug = re.sub(r'[^a-zA-Z0-9_-]+', '-', self.project.name).strip('-') or 'project'
        self.id = result_id or (slug + '-' + hashlib.sha256(str(self.project).encode()).hexdigest()[:12])
        safe_relative(self.id)
        if '/' in self.id:
            raise ValueError('Project result identity must be one directory name')
        self.directory = (SKILL / 'results' / self.id).resolve()
        self.directory.relative_to(SKILL / 'results')
        self.graphs = self.directory / 'graphs'

    @classmethod
    def open(cls, result_id):
        safe_relative(result_id)
        if '/' in result_id:
            raise ValueError('Select one project result directory')
        path = (SKILL / 'results' / result_id / 'project.json').resolve()
        path.relative_to(SKILL / 'results')
        record = json.loads(path.read_text(encoding='utf-8'))
        return cls(record['source_root'], result_id=result_id)

    def source(self, value):
        path = Path(value).expanduser()
        path = (path if path.is_absolute() else self.project / path).resolve(strict=True)
        path.relative_to(self.project)
        if path.is_relative_to(SKILL):
            raise ValueError('The Skill and its generated results are outside the analysis scope')
        return path

    def register(self):
        path = self.directory / 'project.json'
        data = {'purpose': 'Identify the source project for these ExtractStructure results.',
                'scope': 'Graphs and navigation within this project result directory.',
                'id': self.id, 'name': self.project.name, 'source_root': str(self.project),
                'source_prefix': self.project.name, 'format_version': 1}
        if not path.exists() or json.loads(path.read_text(encoding='utf-8')) != data:
            atomic_json(path, data)
            log_update(self.directory, path, 'Save project identity and source locations', __file__)


def graph_path(store, graph_id):
    safe_relative(graph_id)
    if not graph_id.startswith(('files/', 'folders/')):
        raise ValueError('Graph identity must start with files/ or folders/')
    path = (store.graphs / (graph_id + '.json')).resolve()
    path.relative_to(store.graphs)
    return path


def write_graph(store, graph_id, data, summary):
    validate_display(data, data['display'])
    expected = graph_id_for(data['source'], folder=data.get('graph_kind') == 'folder')
    if graph_id != expected:
        raise ValueError('Graph identity must match its source and kind')
    source = (store.root / safe_relative(data['source'])).resolve()
    source.relative_to(store.project)
    store.register()
    path = graph_path(store, graph_id)
    atomic_json(path, data)
    log_update(store.directory, path, summary, __file__)
    return graph_id, path


def read_graph(store, graph_id):
    if not graph_id.startswith(('files/', 'folders/')):
        source = safe_relative(graph_id.rstrip('/'))
        file_id = graph_id_for(source)
        graph_id = file_id if graph_path(store, file_id).is_file() else graph_id_for(source, folder=True)
    path = graph_path(store, graph_id)
    if not path.exists() and graph_id.startswith('folders/'):
        return inherited_folder(store, graph_id)
    raw = path.read_bytes()
    data = json.loads(raw)
    validate_display(data, data['display'])
    if graph_id != graph_id_for(data['source'], folder=data.get('graph_kind') == 'folder'):
        raise ValueError('Graph source does not match the stored identity')
    return data, hashlib.sha256(raw).hexdigest()


def inherited_folder(store, graph_id):
    """Derive a subfolder view from a saved parent graph's actual file scope, retaining parent node and relationship identities."""
    source = graph_id.removeprefix('folders/')
    for ancestor in PurePosixPath(source).parents:
        if str(ancestor) == '.' or not (str(ancestor) == store.project.name or str(ancestor).startswith(store.project.name + '/')):
            break
        parent_id = graph_id_for(ancestor.as_posix(), folder=True)
        if not graph_path(store, parent_id).is_file():
            continue
        parent, _ = read_graph(store, parent_id)
        if parent.get('graph_kind') != 'folder':
            continue
        members = {n['id'] for n in parent['graphs']['L2']['nodes'] if n.get('file', '').startswith(source + '/')}
        if not members:
            continue
        data = copy.deepcopy(parent)
        data['source'] = source
        data['scope'] = {'recursive': True, 'derived': True, 'files': [n['file'] for n in parent['graphs']['L2']['nodes'] if n['id'] in members]}
        data['context'] = {**data.get('context', {}), 'inherited_from': {'id': parent_id, 'source': parent['source'], 'note': 'This view retains the parent graph\'s files, relationships, and function assignments within the current path.'}}
        data['context']['boundary_relations'] = [e for e in parent['graphs']['L2']['edges'] if (e['from'] in members) != (e['to'] in members)]
        data['graphs']['L2']['nodes'] = [n for n in data['graphs']['L2']['nodes'] if n['id'] in members]
        lower_edges = [e for e in data['graphs']['L2']['edges'] if e['from'] in members and e['to'] in members]
        data['graphs']['L2']['edges'] = lower_edges
        mappings = []
        for item in data['mappings']['L1_L2']:
            item['to'] = [n for n in item['to'] if n in members]
            if item['to']:
                mappings.append(item)
        owners = {data['display']['presentation']['layout']['stable_positions']['nodes'][n]['owner'] for n in members}
        mappings = [m for m in mappings if m['from'] in owners]
        data['mappings']['L1_L2'] = mappings
        data['graphs']['L1']['nodes'] = [n for n in data['graphs']['L1']['nodes'] if n['id'] in owners]
        relations = [r for r in data['mappings'].get('relations', []) if r['upper']['from'] in owners and r['upper']['to'] in owners
                     and any(all(n in members for n in path) for path in r['lower_paths'])]
        for r in relations:
            r['lower_paths'] = [p for p in r['lower_paths'] if all(n in members for n in p)]
        data['mappings']['relations'] = relations
        pairs = {(r['upper']['from'], r['upper']['to']) for r in relations}
        data['graphs']['L1']['edges'] = [e for e in data['graphs']['L1']['edges'] if (e['from'], e['to']) in pairs]
        for level, kept in [('L1', owners), ('L2', members)]:
            data['display'][level]['nodes'] = {k: v for k, v in data['display'][level]['nodes'].items() if k in kept}
            data['display'][level]['main_edges'] = []
        p = data['display']['presentation']
        old_feedback = p['layout'].get('feedback_edges', [])
        p['layout']['feedback_edges'] = []
        for f in old_feedback:
            edge = parent['graphs'][f['level']]['edges'][f['index']]
            if edge in data['graphs'][f['level']]['edges']:
                p['layout']['feedback_edges'].append({**f, 'index': data['graphs'][f['level']]['edges'].index(edge)})
        for key in ['shared_targets', 'shared_sources']:
            p[key] = {k: v for k, v in p.get(key, {}).items() if k in members}
        p['connection_pairs'] = {}
        p['layout']['shape'] = 'square'
        p['relationship_summaries'] = [{'level': level, 'index': i, 'from': e['from'], 'to': e['to'], 'text': e['label']}
                                       for level in ['L1', 'L2'] for i, e in enumerate(data['graphs'][level]['edges'])]
        data['source_index'] = [s for s in data['source_index'] if s.get('path', '').startswith(source + '/')]
        data['display']['title'] = source
        square_layout(data); validate_display(data, data['display'])
        return data, hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    raise FileNotFoundError('No saved folder graph covers this directory')


def graph_catalog(store):
    root = store.graphs
    graphs = {}
    for file in sorted(root.rglob('*.json')):
        graph_id = file.relative_to(root).with_suffix('').as_posix()
        try:
            graph, _ = read_graph(store, graph_id)
        except (OSError, ValueError, KeyError, TypeError):
            continue
        folder = graph.get('graph_kind') == 'folder'
        graphs[graph_id] = {'id': graph_id, 'title': graph['display'].get('title', graph_id),
                            'url': PREFIX + quote(graph['source'], safe='/'), 'kind': 'folder' if folder else 'file', 'source': graph['source'],
                            'files': [{'file': n['file'], 'node_id': n['id'],
                                       'owner_id': graph['display']['presentation']['layout']['stable_positions']['nodes'][n['id']]['owner'],
                                       'owner_name': next(u['name'] for u in graph['graphs']['L1']['nodes'] if u['id'] == graph['display']['presentation']['layout']['stable_positions']['nodes'][n['id']]['owner'])}
                                      for n in graph['graphs']['L2']['nodes'] if folder and n.get('file')]}
    # Folder nodes carry their real source paths, just like file nodes. Missing
    # child graphs remain browsable directories rather than fabricated graphs.
    for item in list(graphs.values()):
        graph, _ = read_graph(store, item['id'])
        if item['kind'] != 'folder':
            continue
        item['entries'] = [{'path': n.get('file') or n.get('folder'), 'kind': n.get('entry_kind', 'file'), 'node_id': n['id']}
                           for n in graph['graphs']['L2']['nodes'] if n.get('file') or n.get('folder')]
        for node in item['entries']:
            if node['kind'] != 'folder':
                continue
            child_id = graph_id_for(node['path'], folder=True)
            if child_id not in graphs:
                graphs[child_id] = {'id': child_id, 'source': node['path'], 'kind': 'folder', 'available': False,
                                    'title': node['path'], 'url': PREFIX + quote(node['path'], safe='/'), 'files': []}
    derived = {}
    for item in list(graphs.values()):
        if item['kind'] != 'folder':
            continue
        for node in item['files']:
            parent = PurePosixPath(node['file']).parent
            while str(parent).startswith(item['source'] + '/'):
                graph_id = graph_id_for(parent.as_posix(), folder=True)
                if graph_id not in graphs:
                    derived[graph_id] = {'id': graph_id, 'source': str(parent), 'kind': 'folder', 'inherited_from': item['id'],
                                         'title': str(parent), 'url': PREFIX + quote(str(parent), safe='/'),
                                         'files': [n for n in item['files'] if n['file'].startswith(str(parent) + '/')]}
                parent = parent.parent
    graphs.update(derived)
    # Browsing a source directory does not require an authored folder graph.
    # These entries offer navigation only, never inferred semantic relations.
    for item in list(graphs.values()):
        directory = PurePosixPath(item['source']).parent
        while str(directory) == store.project.name or str(directory).startswith(store.project.name + '/'):
            graph_id = graph_id_for(str(directory), folder=True)
            if graph_id not in graphs:
                graphs[graph_id] = {'id': graph_id, 'source': str(directory), 'kind': 'folder',
                                    'title': str(directory), 'url': PREFIX + quote(str(directory), safe='/'),
                                    'available': False, 'files': []}
            directory = directory.parent
    return sorted(graphs.values(), key=lambda g: (g['source'], g['kind']))

