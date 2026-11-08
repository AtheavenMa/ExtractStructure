"""Purpose and main functions: Resolve article evidence and assemble Markdown, TeX and PDF graphs.

Scope: Agent-authored article drafts inside an explicitly selected source directory; originals stay read-only.
"""
from __future__ import annotations
import copy
import hashlib
from pathlib import Path

from graph_builder import build as assemble
from graph_store import safe_relative


def build(recipe, root):
    root = Path(root).resolve()
    recipe = copy.deepcopy(recipe)
    primary = safe_relative(recipe['source'])
    source_path = (root / primary).resolve(strict=True)
    project = (root / primary.split('/')[0]).resolve(strict=True)
    source_path.relative_to(project)
    fingerprints, line_counts = {}, {}

    def resolve(items):
        if not isinstance(items, list) or not items:
            raise ValueError('Article evidence requires a nonempty source list')
        result = []
        for item in items:
            if not isinstance(item, dict):
                raise ValueError('Each source entry must contain a path and page or line range')
            name = safe_relative(item['path'])
            path = (root / name).resolve(strict=True)
            path.relative_to(project)
            suffix = path.suffix.lower()
            if suffix not in {'.md', '.tex', '.pdf'} or not path.is_file():
                raise ValueError('Article sources must be Markdown, TeX or PDF files')
            ref = {'path': name}
            field = 'pages' if suffix == '.pdf' else 'lines'
            bounds = item.get(field)
            if (not isinstance(bounds, list) or len(bounds) != 2
                    or any(type(n) is not int or n < 1 for n in bounds) or bounds[1] < bounds[0]):
                raise ValueError(name + ': provide an inclusive positive ' + field + ' range')
            if suffix != '.pdf':
                if name not in line_counts:
                    line_counts[name] = max(1, len(path.read_text(encoding='utf-8').splitlines()))
                if bounds[1] > line_counts[name]:
                    raise ValueError(name + ': line range exceeds the source length')
            ref[field] = bounds
            for key in ('section', 'label', 'paragraph'):
                if key in item:
                    if not isinstance(item[key], str) or not item[key].strip():
                        raise ValueError(key + ' must be nonempty text')
                    ref[key] = item[key]
            fingerprints[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            result.append(ref)
        return result

    # The common builder calls this resolver for nodes, groups and relationships.
    # Explicit group evidence is optional: member evidence is the default.
    for group in recipe['groups']:
        for node in group['nodes']:
            node['symbols'] = node['source']
        group['symbols'] = group.get('source') or [ref for node in group['nodes'] for ref in node['source']]
    for edge in recipe.get('edges', []):
        edge['symbols'] = edge['source']
    for edge in recipe.get('upper_edges', []):
        edge['symbols'] = edge['source']
    recipe.setdefault('edges', [])
    if not isinstance(recipe.get('coverage'), str) or not recipe['coverage'].strip():
        raise ValueError('Describe the selected article coverage in coverage')
    # Include the primary file even when all quoted evidence is in included files.
    if source_path.suffix.lower() not in {'.md', '.tex', '.pdf'}:
        raise ValueError('Select a Markdown, TeX or PDF article')
    fingerprints[primary] = hashlib.sha256(source_path.read_bytes()).hexdigest()
    data = assemble(recipe, source_path, resolve, {}, {})
    data['graph_kind'] = 'article'
    data['scope'] = {'target': primary, 'coverage': recipe['coverage']}
    data['context'] = {'interpretation': recipe['purpose'], 'basis': 'Agent reading of selected article passages and recorded evidence.'}
    data['analysis'] = {'method': 'Agent-authored article structure with original page or line locations',
                        'source_sha256': fingerprints[primary], 'source_files': fingerprints}
    data['source_index'] = [{'path': name, 'sha256': digest} for name, digest in sorted(fingerprints.items())]
    data['graphs']['L1']['name'] = 'Topics'
    data['graphs']['L2']['name'] = 'Article details'
    data['display']['purpose'] = 'Present article topics, details and their supported relationships.'
    data['display']['scope'] = recipe['coverage']
    return data
