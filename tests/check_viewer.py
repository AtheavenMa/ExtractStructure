"""Purpose and main functions: Check viewer interactions against any saved graph or independent page.

Scope: Explicit developer checks with optional Playwright and its Chromium browser installed;
exercise language restoration, explanations, expansion and worker fallback without changing graph data.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def check_viewer(target, *, worker_mode='auto', sandbox=False):
    from playwright.sync_api import sync_playwright

    local = Path(target).expanduser()
    is_file = local.is_file()
    if sandbox and not is_file:
        raise ValueError('Sandbox checks require an exported HTML file')
    errors, requests = [], []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=['--no-sandbox'])
        try:
            context = browser.new_context(viewport={'width': 1600, 'height': 1100})
            scripts = {
                'auto': '',
                'blocked': "window.Worker=class{constructor(){throw new DOMException('Blocked','SecurityError')}};",
                'load-error': "window.Worker=class{constructor(){setTimeout(()=>this.onerror?.({preventDefault(){}}),0)}postMessage(){}terminate(){}};",
            }
            injected = scripts[worker_mode]
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: requests.append(request.url))
            if sandbox:
                html = local.read_text(encoding='utf-8')
                if injected:
                    html = html.replace('<script>', '<script>' + injected + '</script><script>', 1)
                page.goto('about:blank')
                page.evaluate("html=>{const f=document.createElement('iframe');f.sandbox='allow-scripts';f.style='width:1600px;height:1100px';f.srcdoc=html;document.body.append(f)}", html)
                frame = page.frames[1]
            else:
                if injected:
                    page.add_init_script(injected)
                page.goto(local.resolve().as_uri() if is_file else target)
                frame = page

            def settled():
                frame.wait_for_function('window.SemanticPreview && !SemanticPreview.captionPending', timeout=60000)
                if frame.evaluate('SemanticPreview.captionError'):
                    raise AssertionError(frame.evaluate('SemanticPreview.captionError'))

            settled()
            assert frame.evaluate('SemanticPreview.expanded.size') == 0, 'Initial graph should be collapsed'
            expandable = frame.evaluate("[...SemanticPreview.model.upperBy.keys()].filter(id=>!SemanticPreview.model.layoutHints.exclusive_groups||SemanticPreview.model.displayChildren.get(id).size>1)")
            if expandable:
                frame.evaluate('id=>SemanticPreview.toggle(id)', expandable[-1])
                settled()
            first = frame.locator('.graph-node').first
            first.focus()
            assert frame.locator('#nodeExplanation').is_visible(), 'Focus should expose full explanation'
            first.press('Escape')
            assert frame.locator('#nodeExplanation').is_hidden(), 'Escape should dismiss explanation'
            before = frame.evaluate('SemanticPreview.snapshot()')
            original_language = frame.evaluate('GraphLocale.lang')
            for language in ['en' if original_language == 'zh' else 'zh', original_language]:
                frame.locator('[data-language="' + language + '"]').click()
                settled()
                after = frame.evaluate('SemanticPreview.snapshot()')
                assert after == before, 'Language change must preserve expansion, camera and search after labels settle'
                assert frame.locator('#diagram').count() == 1, 'Switching language should leave one viewer'
            if expandable:
                # Return to collapsed state before using the all-topics control.
                for identity in frame.evaluate('[...SemanticPreview.expanded]'):
                    frame.evaluate('id=>SemanticPreview.toggle(id)', identity)
                frame.locator('#expandAll').click()
                settled()
                assert frame.evaluate('SemanticPreview.scene.nodes.length===B.data.graphs.L2.nodes.length'), 'Expand all should show all concrete nodes'
                frame.locator('#expandAll').click()
                settled()
                assert frame.evaluate('SemanticPreview.expanded.size') == 0
            assert not errors, errors
            if is_file:
                assert not any(url.startswith(('http:', 'https:')) for url in requests), 'Independent page should read embedded resources'
            return {'result': 'passed', 'worker_mode': worker_mode, 'sandbox': sandbox,
                    'topics': frame.evaluate('B.data.graphs.L1.nodes.length'),
                    'nodes': frame.evaluate('B.data.graphs.L2.nodes.length'), 'browser_errors': errors}
        finally:
            browser.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', help='Accessible service URL or exported HTML path')
    parser.add_argument('--worker-mode', choices=('auto', 'blocked', 'load-error'), default='auto')
    parser.add_argument('--sandbox', action='store_true')
    args = parser.parse_args()
    print(json.dumps(check_viewer(args.target, worker_mode=args.worker_mode, sandbox=args.sandbox), indent=2))
