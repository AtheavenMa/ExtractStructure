"""Purpose and main functions: Assemble agent-authored function nodes, relationships, and source symbols into Atlas graph JSON.

Scope: Rebuild a single file graph from agent-supplied function names, meanings, conditions, and relationships;
the program adds source locations, fixed presentation fields, and saving.
"""
from __future__ import annotations
import ast
import hashlib
from pathlib import Path

from graph_builder import build as assemble


def build(recipe, root):
    root = Path(root)
    source = recipe['source']
    path = root / source
    text = path.read_text(encoding='utf-8')
    tree = ast.parse(text)
    index = {}
    def visit(body, prefix=''):
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                name = prefix + node.name
                index[name] = {'symbol': name, 'source': [{'path': source, 'lines': [node.lineno, node.end_lineno]}], 'docstring': ast.get_docstring(node)}
                visit(node.body, name + '.')
            else:
                visit(ast.iter_child_nodes(node), prefix)
    visit(tree.body)
    def refs(symbols):
        found=[]
        for symbol in symbols:
            if symbol == '<module>': found.append({'path':source,'lines':[1,max(1,len(text.splitlines()))]})
            elif symbol in index: found.extend(index[symbol]['source'])
            else: raise ValueError(source + ': unknown source symbol ' + symbol)
        return found
    return assemble(recipe, path, refs, index, {'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
