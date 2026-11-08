"""Purpose and main functions: Provide folder inventory, Python and article graph saving, page serving and HTML export.

Scope: Use after selecting a project and analysis scope; read source and store generated data inside this skill.
"""
from __future__ import annotations
import argparse
import ast
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

import file_graph
import article_graph
import folder_graph
from graph_store import Store, graph_id_for, graph_path, write_graph
from server import serve


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, help='Target project root used to resolve relative target paths')
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ['inventory', 'discover', 'folder', 'link']:
        command = sub.add_parser(name)
        command.add_argument('target', nargs='?', default='.')
        scope = command.add_mutually_exclusive_group()
        scope.add_argument('--direct', dest='recursive', action='store_false')
        scope.add_argument('--recursive', dest='recursive', action='store_true')
        command.set_defaults(recursive=None)
        command.add_argument('--include', action='append', help='Include a project-relative file or directory; repeatable')
        command.add_argument('--exclude', action='append', default=[], help='Skip a project-relative file or directory; repeatable')
        if name == 'folder':
            command.add_argument('--recipe', default='-', help='Draft JSON; - reads standard input')
            command.add_argument('--regenerate', action='store_true')
    for name in ('file', 'article'):
        command = sub.add_parser(name)
        command.add_argument('target')
        command.add_argument('--recipe', default='-')
        command.add_argument('--regenerate', action='store_true')
        if name == 'file':
            command.add_argument('--format', choices=('python',), help='Explicit Python input, including code supplied as a text attachment')
    command = sub.add_parser('export')
    command.add_argument('--project', required=True)
    command.add_argument('--source', required=True)
    command.add_argument('--name', required=True, help='New named delivery directory inside this project result')
    command.add_argument('--language', choices=('en', 'zh'), default='en')
    command.add_argument('--theme', choices=('system', 'light', 'dark'), default='system')
    command = sub.add_parser('serve')
    command.add_argument('--project', help='Saved result directory name; open graphs when source is temporarily unavailable')
    command.add_argument('--port', type=int, default=0)
    command.add_argument('--source', help='Source path recorded in the graph and returned when saving')
    args = parser.parse_args()
    try:
        if args.command == 'export':
            from export_page import export
            result = export(Store.open(args.project), args.source, args.name, language=args.language, theme=args.theme)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return
        if args.command == 'serve':
            if args.project:
                store = Store.open(args.project)
            elif args.root:
                store = Store(args.root)
            else:
                parser.error('serve requires --project or --root')
            serve(store, port=args.port, source=args.source)
            return
        if not args.root or not args.root.expanduser().is_dir():
            parser.error('Select an existing project directory with --root')
        store = Store(args.root)
        target = store.source(args.target)
        if hasattr(args, 'include'):
            from graph_store import safe_relative
            for value in (args.include or []) + args.exclude:
                safe_relative(value)
            folder_graph.configure(store, args.include, args.exclude)
        recursive = getattr(args, 'recursive', None)
        if args.command == 'inventory':
            directory, items = folder_graph.inventory(target, recursive=recursive is not False, allow_empty=True)
            result = {'folder': directory.relative_to(store.root).as_posix(),
                      'file_count': len(items), 'files': items}
        elif args.command == 'discover':
            if target.is_file():
                source = target.relative_to(store.root).as_posix()
                result = folder_graph.existing_graph(store, graph_id_for(source), source)
            else:
                result = folder_graph.discover(target, recursive=recursive is not False)
                result['file_count'] = len(result['files'])
                result['cached_file_count'] = sum(i['usable'] for i in result['files'].values())
        elif args.command == 'link':
            graph_id, report = folder_graph.link_existing(target, recursive=recursive)
            result = {'graph_id': graph_id, 'report': report}
        else:
            if args.command == 'folder':
                identity = graph_id_for(target.relative_to(store.root).as_posix(), folder=True)
            elif args.command == 'article':
                if target.suffix.lower() not in {'.md', '.tex', '.pdf'} or not target.is_file():
                    raise ValueError('Select a Markdown, TeX or PDF article')
                identity = graph_id_for(target.relative_to(store.root).as_posix())
            else:
                if (target.suffix.lower() != '.py' and args.format != 'python') or not target.is_file():
                    raise ValueError('Select a Python file, or use --format python for a Python text attachment')
                tree = ast.parse(target.read_text(encoding='utf-8'))
                if target.name == '__init__.py' and all(isinstance(n, ast.Pass) or
                    isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str)
                    for n in tree.body):
                    raise ValueError('This file only declares a package; omit it from the functional graph')
                identity = graph_id_for(target.relative_to(store.root).as_posix())
            if graph_path(store, identity).exists() and not args.regenerate:
                raise ValueError('A cached graph exists. Ask whether to reuse or redraw it. Use --regenerate to redraw or link to reuse a folder graph.')
            recipe = json.load(sys.stdin) if args.recipe == '-' else json.loads(Path(args.recipe).read_text(encoding='utf-8'))
            if args.command == 'folder':
                graph_id, output = folder_graph.store(target, recipe, recursive=recursive is not False, regenerate=args.regenerate)
            else:
                recipe['source'] = target.relative_to(store.root).as_posix()
                builder = article_graph if args.command == 'article' else file_graph
                graph = builder.build(recipe, store.root)
                graph_id, output = write_graph(store, identity, graph, 'Save an article graph' if args.command == 'article' else 'Save a file graph of functions and concrete processes')
            result = {'graph_id': graph_id, 'path': str(output), 'source': target.relative_to(store.root).as_posix()}
        result['project_id'] = store.id
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, TypeError, SyntaxError) as error:
        parser.exit(2, 'ExtractStructure: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
