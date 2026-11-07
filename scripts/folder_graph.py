"""Purpose and main functions: Find folder and file graphs, read file descriptions and function drafts, save folder graphs, and connect file details.

Scope: ExtractStructure folder analysis with an explicit directory and recursion choice; source remains read-only.
The agent supplies meanings; the program adds source locations, fixed presentation, and detail links. Reuse or regenerate graphs according to the user's choice.
"""
from __future__ import annotations
import ast
from collections import deque
import hashlib
import json
from pathlib import Path
import re

from graph_store import graph_path, read_graph, graph_id_for, write_graph
from layout import validate_display, square_layout

ROOT = None
STORE = None
INCLUDE = None
EXCLUDE = ()


def configure(store, include=None, exclude=()):
    global ROOT, STORE, INCLUDE, EXCLUDE
    ROOT, STORE = store.root, store
    INCLUDE, EXCLUDE = set(include) if include is not None else None, tuple(exclude)


def in_scope(path):
    relative = path.relative_to(STORE.project).as_posix()
    return (not any(path.is_relative_to(p) for p in (STORE.skill,))
            and not any(part in {'.git', '__pycache__', '.venv', 'venv'} for part in path.relative_to(STORE.project).parts)
            and (INCLUDE is None or relative in INCLUDE or any(relative.startswith(p.rstrip('/') + '/') for p in INCLUDE)
                 or path.is_dir() and any(p.startswith(relative.rstrip('/') + '/') for p in INCLUDE))
            and not any(relative == p or relative.startswith(p.rstrip('/') + '/') for p in EXCLUDE))


def inventory(folder, *, recursive=False, allow_empty=False):
    path = Path(folder)
    path = (path if path.is_absolute() else ROOT / path).resolve(strict=True)
    path.relative_to(STORE.project)
    if not path.is_dir():
        raise ValueError('Target must be a directory inside the selected project')
    items = {}
    for file in sorted(path.rglob('*.py') if recursive else path.glob('*.py')):
        if file.name == '__init__.py' or not file.is_file() or not in_scope(file):
            continue
        file.resolve().relative_to(path)
        text = file.read_text(encoding='utf-8')
        tree = ast.parse(text)
        doc = ast.get_docstring(tree) or ''
        def section(label):
            headings = {
                'purpose': r'(?:Purpose and main functions|\u76ee\u7684\u548c\u4e3b\u8981\u529f\u80fd)',
                'scope': r'(?:Scope|\u9002\u7528\u8303\u56f4)',
            }
            boundary = r'(?:' + '|'.join(headings.values()) + r')'
            match = re.search(r'(?:^|\n)' + headings[label] + r'\s*[:\uff1a]\s*(.*?)(?=\n\s*\n|\n' + boundary + r'\s*[:\uff1a]|\Z)', doc, re.S)
            return match.group(1).strip() if match else ''
        symbols = {}
        def visit(nodes, prefix=''):
            for node in nodes:
                if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                    name = prefix + node.name
                    symbols[name] = [node.lineno, node.end_lineno]
                    visit(node.body, name + '.')
                else:
                    visit(ast.iter_child_nodes(node), prefix)
        visit(tree.body)
        items[file.relative_to(path).as_posix()] = {
            'path': file.relative_to(ROOT).as_posix(), 'purpose': section('purpose'),
            'scope': section('scope'), 'module_docstring': doc,
            'sha256': hashlib.sha256(text.encode()).hexdigest(),
            'lines': len(text.splitlines()), 'symbols': symbols,
        }
    if not items and not allow_empty:
        raise ValueError('The selected scope contains no Python files')
    return path, items


def existing_graph(store_context, graph_id, source, *, folder=False):
    """Check actual file identity and loadability for initial inventory and final linking."""
    path = graph_path(store_context, graph_id)
    info = {'id': graph_id, 'path': str(path),
            'exists': path.is_file(), 'usable': False}
    if not info['exists']:
        return info
    try:
        graph, _ = read_graph(store_context, graph_id)
        if graph.get('source') != source:
            raise ValueError('Graph source does not match ' + source)
        if (graph.get('graph_kind') == 'folder') != folder:
            raise ValueError('Graph kind does not match the selected source')
        info['usable'] = True
        recorded = graph.get('analysis', {}).get('source_sha256')
        if recorded and (ROOT / source).is_file():
            info['source_sha_matches'] = recorded == hashlib.sha256((ROOT / source).read_bytes()).hexdigest()
        if folder:
            checked = []
            for item in graph.get('source_index', []):
                if item.get('entry_kind') == 'folder':
                    continue
                current = ROOT / item['path']
                checked.append(current.is_file() and item['sha256'] == hashlib.sha256(current.read_bytes()).hexdigest())
            info['recorded_files_match'] = all(checked) if checked else None
            info['recorded_file_count'] = len(checked)
    except (ValueError, OSError, KeyError, TypeError) as error:
        info['error'] = str(error)
    return info


def discover(folder, *, recursive=False):
    """List existing graphs for this folder, direct subfolders, and files without modifying them, to select reuse scope."""
    directory, items = inventory(folder, recursive=recursive, allow_empty=True)
    store_context = STORE
    relative = directory.relative_to(ROOT).as_posix()
    folder_id = graph_id_for(directory.relative_to(ROOT).as_posix(), folder=True)
    return {'folder': relative, 'recursive': recursive,
            'folder_graph': existing_graph(store_context, folder_id, relative, folder=True),
            'folders': {p.name: existing_graph(store_context, graph_id_for(p.relative_to(ROOT).as_posix(), folder=True),
                                               p.relative_to(ROOT).as_posix(), folder=True)
                        for p in sorted(directory.iterdir())
                        if p.is_dir() and not p.name.startswith('.') and in_scope(p)},
            'files': {name: existing_graph(store_context, graph_id_for(item['path']), item['path'])
                      for name, item in items.items()}}


def attach_detail_links(data, store_context):
    """Link file or subfolder graphs by actual node paths, adding navigation data."""
    if data.get('graph_kind') != 'folder':
        raise ValueError('Detail linking requires a folder graph')
    directory = (ROOT / data['source']).resolve(strict=True)
    directory.relative_to(STORE.project)
    linked, unavailable = [], []
    for node in data['graphs']['L2']['nodes']:
        source = node.get('file') or node['folder']
        is_folder = node.get('entry_kind') == 'folder'
        path = (ROOT / source).resolve()
        path.relative_to(directory)
        graph_id = graph_id_for(source, folder=is_folder)
        info = existing_graph(store_context, graph_id, source, folder=is_folder)
        hint = data['display']['L2']['nodes'][node['id']]
        hint.pop('detail_graph', None)
        if info['usable'] or is_folder:
            hint['detail_graph'] = {'id': graph_id, 'source': source,
                                    'json_path': info['path'], 'label': Path(source).name + ('/' if is_folder else ''),
                                    'kind': 'folder' if is_folder else 'file'}
            linked.append(info)
        else:
            unavailable.append(info)
    return {'linked': linked, 'unavailable': unavailable}


def build(folder, recipe, *, recursive=False):
    mixed = 'folders' in recipe
    directory, items = inventory(folder, recursive=False if mixed else recursive, allow_empty=mixed)
    evidence = dict(items)
    def load_evidence(name):
        if name in evidence:
            return evidence[name]
        path = (directory / name).resolve(strict=True)
        if not mixed or not path.is_relative_to(directory) or not path.is_file():
            raise ValueError('Evidence file outside scope: ' + name)
        text = path.read_text(encoding='utf-8'); symbols = {}
        if path.suffix == '.py':
            def visit(nodes, prefix=''):
                for node in nodes:
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                        symbols[prefix + node.name] = [node.lineno, node.end_lineno]
                        visit(node.body, prefix + node.name + '.')
                    else:
                        visit(ast.iter_child_nodes(node), prefix)
            visit(ast.parse(text).body)
        evidence[name] = {'path': path.relative_to(ROOT).as_posix(), 'lines': len(text.splitlines()),
                          'symbols': symbols, 'sha256': hashlib.sha256(text.encode()).hexdigest()}
        return evidence[name]
    if mixed:
        actual = {p.name for p in directory.iterdir() if p.is_dir() and not p.name.startswith('.') and in_scope(p)}
        if set(recipe['folders']) != actual:
            raise ValueError('folders must cover direct source directories exactly')
        for name, spec in recipe['folders'].items():
            records = spec.get('source', [])
            if not records:
                raise ValueError(name + ': folder responsibilities require source evidence')
            inputs = [load_evidence(record['file']) for record in records]
            items[name] = {'path': (directory / name).relative_to(ROOT).as_posix(),
                           'entry_kind': 'folder', 'purpose': spec.get('purpose', spec.get('meaning', '')),
                           'scope': spec.get('scope', ''), 'evidence': records,
                           'sha256': hashlib.sha256(json.dumps([(i['path'], i['sha256']) for i in inputs], sort_keys=True).encode()).hexdigest()}
    # Directory graphs omit package initialization files, including older draft entries.
    ignored = {name for name in recipe['files'] if Path(name).name == '__init__.py'}
    specs = {name: value for name, value in {**recipe['files'], **recipe.get('folders', {})}.items() if name not in ignored}
    if set(specs) != set(items):
        raise ValueError('files must cover the scope exactly; missing=' + repr(sorted(set(items)-set(specs)))
                         + '; extra=' + repr(sorted(set(specs)-set(items))))
    def file_id(name):
        if name not in items:
            raise ValueError('Unknown file: ' + name)
        return ('L2_FOLDER_' if items[name].get('entry_kind') == 'folder' else 'L2_FILE_') + hashlib.sha256(name.encode()).hexdigest()[:12]
    def refs(records):
        result = []
        for record in records:
            name = record['file']
            if name in items and items[name].get('entry_kind') == 'folder':
                result.extend(refs(items[name]['evidence']))
                continue
            item = load_evidence(name)
            symbol = record.get('symbol', '<module>')
            if symbol == '<module>':
                ref = {'path': item['path'], 'lines': [1, item['lines']]} if item['lines'] else {'path': item['path'], 'empty': True}
            else:
                if symbol not in item['symbols']:
                    raise ValueError(name + ': unknown symbol ' + symbol)
                ref = {'path': item['path'], 'symbol': symbol, 'lines': item['symbols'][symbol]}
            if ref not in result:
                result.append(ref)
        return result
    if not items:
        raise ValueError('The selected scope contains no functional entries')
    nodes = []
    source_index = []
    roles = {}
    for name, item in items.items():
        spec = specs[name]
        purpose, scope = item['purpose'] or spec.get('purpose'), item['scope'] or spec.get('scope')
        if not purpose or not scope:
            raise ValueError(name + ': provide missing purpose and scope before building the graph')
        is_folder = item.get('entry_kind') == 'folder'
        node = {'id': file_id(name), ('folder' if is_folder else 'file'): item['path'],
                'entry_kind': 'folder' if is_folder else 'file',
                'name': Path(name).name + ('/' if is_folder else '') + '\n' + spec['name'],
                'purpose': purpose, 'scope': scope,
                'meaning': spec.get('meaning', purpose + ' Scope: ' + scope),
                'source': refs([{'file': name}])}
        if 'implementation_details' in spec:
            node['implementation_details'] = spec['implementation_details']
        role = spec.get('role', 'operation')
        if role not in {'operation', 'object', 'result', 'failure'}:
            raise ValueError('Unknown node role: ' + role)
        if 'category' in spec:
            if spec['category'] not in {'input','process','output','independent'}: raise ValueError('Unknown node category')
            node['category'] = spec['category']
        roles[node['id']] = role
        nodes.append(node)
        source_index.append({k: item[k] for k in ['path', 'sha256']} | {
            'purpose': purpose, 'scope': scope, 'source': node['source'],
            'entry_kind': 'folder' if is_folder else 'file',
            'description_origin': 'existing_module_docstring' if not is_folder and item['purpose'] and item['scope'] else 'agent_explanation'})
    groups = [{**g, 'files': [name for name in g['files'] if name not in ignored],
               'shared_files': [name for name in g.get('shared_files', []) if name not in ignored]}
              for g in recipe['groups'] if any(name not in ignored for name in g['files'])]
    group_ids = {'L1_' + g['id'] for g in groups}
    if len(group_ids) != len(groups):
        raise ValueError('Duplicate group ID')
    owners, upper, mappings, slots, anchors, representatives = {}, [], [], {}, {}, {}
    plans = []
    for g in groups:
        uid = 'L1_' + g['id']
        members = g['files']
        if not members:
            raise ValueError('Each concept requires a primary file')
        for name in members:
            nid = file_id(name)
            if nid in owners:
                raise ValueError('File has multiple primary owners: ' + name)
            owners[nid] = uid
        all_members = list(dict.fromkeys(members + g.get('shared_files', [])))
        source = refs([{'file': name} for name in all_members])
        upper.append({'id': uid, 'name': g['name'], 'meaning': g['meaning'], 'source': source})
        if 'category' in g:
            if g['category'] not in {'input','process','output','independent'}: raise ValueError('Unknown group category')
            upper[-1]['category'] = g['category']
        mappings.append({'from': uid, 'to': [file_id(name) for name in all_members],
                         'description': g['meaning'], 'source': source})
        columns = min(g.get('columns', 2), len(members))
        if isinstance(columns, bool) or not isinstance(columns, int) or columns < 1:
            raise ValueError('columns must be a positive integer')
        plans.append((g, uid, columns, (columns-1)*340+230, ((len(members)-1)//columns)*170+72))
    if set(owners) != {n['id'] for n in nodes}:
        raise ValueError('Each file requires one primary group')
    y = 0
    for start in range(0, len(plans), 3):
        row = plans[start:start+3]
        x = 0
        for g, uid, columns, width, height in row:
            gx, gy = g.get('origin', [x, y])
            for i, name in enumerate(g['files']):
                slots[file_id(name)] = {'x': gx+(i % columns)*340, 'y': gy+(i//columns)*170, 'owner': uid}
            rep = file_id(g.get('representative', g['files'][0]))
            if owners[rep] != uid:
                raise ValueError('Representative must be a primary member')
            representatives[uid] = rep
            anchors[uid] = {axis: slots[rep][axis] for axis in ['x', 'y']}
            x += width + 200
        y += max(p[4] for p in row) + 230
    edges, feedback = [], []
    for spec in recipe['edges']:
        if spec['from'] in ignored or spec['to'] in ignored:
            continue
        edge = {'from': file_id(spec['from']), 'to': file_id(spec['to']),
                'label': spec['label'],
                'description': spec['description'], 'source': refs(spec['source'])}
        if not edge['source']:
            raise ValueError('File relationships require source evidence')
        for key in ['condition', 'implementation_details']:
            if key in spec:
                edge[key] = spec[key]
        if spec.get('feedback'):
            feedback.append({'level': 'L2', 'index': len(edges), 'from': edge['from'],
                             'to': edge['to'], 'reason': spec.get('reason', edge['description'])})
        edges.append(edge)
    upper_edges, relation_mappings = [], []
    adjacent = {}
    for edge in edges:
        adjacent.setdefault(edge['from'], []).append(edge['to'])
    def find_paths(start_group, end_group):
        found = []
        targets = next(set(m['to']) for m in mappings if m['from'] == end_group)
        starts = next(m['to'] for m in mappings if m['from'] == start_group)
        for nid in starts:
            queue, seen = deque([[nid]]), {nid}
            while queue:
                path = queue.popleft()
                if len(path) > 1 and path[-1] in targets:
                    found.append(path)
                    break
                for dest in adjacent.get(path[-1], []):
                    if dest not in seen:
                        seen.add(dest); queue.append(path+[dest])
        return found
    for spec in recipe.get('upper_edges', []):
        frm, to = 'L1_' + spec['from'], 'L1_' + spec['to']
        if frm in {'L1_' + g['id'] for g in recipe['groups'] if all(n in ignored for n in g['files'])} or to in {'L1_' + g['id'] for g in recipe['groups'] if all(n in ignored for n in g['files'])}:
            continue
        if frm not in group_ids or to not in group_ids:
            raise ValueError('Upper edge refers to an unknown concept')
        paths = find_paths(frm, to)
        if not paths:
            raise ValueError('Upper relationship has no lower path: ' + frm + ' -> ' + to)
        edge = {'from': frm, 'to': to, 'label': spec['label'],
                'description': spec['description'], 'source': refs(spec['source'])}
        if spec.get('feedback'):
            feedback.append({'level': 'L1', 'index': len(upper_edges), 'from': frm, 'to': to,
                             'reason': spec.get('reason', spec['description'])})
        upper_edges.append(edge)
        relation_mappings.append({'upper': {'from': frm, 'to': to}, 'lower_paths': paths, 'source': edge['source']})
    presentation = {'relationship_summaries': [
        {'level': level, 'index': i, 'from': e['from'], 'to': e['to'], 'text': e['label']}
        for level, es in [('L1', upper_edges), ('L2', edges)] for i, e in enumerate(es)],
        'connection_pairs': {},
        'shared_targets': {file_id(name): text for name, text in recipe.get('shared_targets', {}).items()},
        'shared_sources': {file_id(name): text for name, text in recipe.get('shared_sources', {}).items()},
        'layout': {'shape': recipe.get('layout_shape', 'square'), 'exclusive_groups': True, 'feedback_edges': feedback,
                   'stable_positions': {'nodes': slots, 'anchors': anchors, 'representatives': representatives, 'docks': {}}}}
    display = {'title': directory.relative_to(ROOT).as_posix(),
               'L1': {'nodes': {n['id']: {'column': 0, 'lane': 0, 'role': 'operation'} for n in upper}, 'main_edges': []},
               'L2': {'nodes': {n['id']: {'column': 0, 'lane': 0, 'role': roles[n['id']]} for n in nodes}, 'main_edges': []},
               'presentation': presentation}
    data = {'graph_kind': 'folder', 'source': directory.relative_to(ROOT).as_posix(),
            'purpose': recipe['purpose'], 'scope': {'recursive': False if mixed else recursive, 'entry_mode': 'direct' if mixed else 'files',
                      'files': [item['path'] for item in items.values() if item.get('entry_kind') != 'folder'],
                      'folders': [item['path'] for item in items.values() if item.get('entry_kind') == 'folder'],
                      'selection': sorted(INCLUDE) if INCLUDE is not None else None, 'exclude': list(EXCLUDE)},
            'context': recipe.get('context', {}), 'source_index': source_index,
            'analysis': {'method': 'Agent-authored folder cooperation; AST used only for source locations'},
            'graphs': {'L1': {'nodes': upper, 'edges': upper_edges}, 'L2': {'nodes': nodes, 'edges': edges}},
            'mappings': {'L1_L2': mappings, 'relations': relation_mappings}, 'display': display}
    if recipe.get('i18n'):
        data['i18n'] = recipe['i18n']
    attach_detail_links(data, STORE)
    square_layout(data)
    validate_display(data, display)
    return data


def link_existing(folder, *, recursive=None):
    """Reuse the selected folder graph and update file detail links; report changes in the current file listing separately."""
    directory = Path(folder)
    directory = (directory if directory.is_absolute() else ROOT / directory).resolve(strict=True)
    store_context = STORE
    graph_id = graph_id_for(directory.relative_to(ROOT).as_posix(), folder=True)
    data, _ = read_graph(store_context, graph_id)
    if INCLUDE is None and not EXCLUDE:
        configure(STORE, data.get('scope', {}).get('selection'), data.get('scope', {}).get('exclude', []))
    if recursive is None:
        recursive = data.get('scope', {}).get('recursive', False)
    directory, items = inventory(folder, recursive=recursive, allow_empty=True)
    if data.get('source') != directory.relative_to(ROOT).as_posix():
        raise ValueError('The existing overall graph belongs to another source')
    report = attach_detail_links(data, store_context)
    represented = {n.get('file') or n['folder'] for n in data['graphs']['L2']['nodes']}
    actual = {item['path'] for item in items.values()}
    if data.get('scope', {}).get('entry_mode') == 'direct':
        actual.update(p.relative_to(ROOT).as_posix() for p in directory.iterdir() if p.is_dir() and not p.name.startswith('.') and in_scope(p))
    report['files_missing_from_folder_graph'] = sorted(actual - represented)
    report['files_no_longer_in_scope'] = sorted(represented - actual)
    validate_display(data, data['display'])
    write_graph(store_context, graph_id, data, 'Reuse the folder graph and update detail links to existing file graphs')
    return graph_id, report


def store(folder, recipe, *, recursive=False, regenerate=False):
    data = build(folder, recipe, recursive=recursive)
    store_context = STORE
    graph_id = graph_id_for(data['source'], folder=True)
    output = graph_path(store_context, graph_id)
    if output.exists():
        old = json.loads(output.read_text())
        if old.get('graph_kind') != 'folder' or old.get('source') != data['source']:
            raise ValueError('The overall name is already used by a different source')
        if not regenerate:
            raise ValueError('Existing folder graph: ask whether to regenerate; use link_existing to reuse it')
    return write_graph(store_context, graph_id, data, 'Save the two-level folder collaboration graph and individual file detail links')

