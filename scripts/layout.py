"""Purpose and main functions: Generate full L2 reference coordinates for ExtractStructure and check required drawing fields.

Scope: Internal folder and file graph assembly and loading; the agent supplies functional meanings.
"""
import math


def square_layout(data):
    """Generate near-square full L2 reference coordinates so the page can arrange visible function groups by expansion state."""
    layout = data['display']['presentation']['layout']
    if layout.get('shape') == 'authored':
        return data
    old = layout['stable_positions']
    upper = [n['id'] for n in data['graphs']['L1']['nodes']]
    lower = [n['id'] for n in data['graphs']['L2']['nodes']]
    def ordered(ids, edges):
        pending, result = set(ids), []
        while pending:
            ready = [n for n in ids if n in pending and not any(e['to'] == n and e['from'] in pending and e['from'] != n for e in edges)]
            node = ready[0] if ready else next(n for n in ids if n in pending)
            pending.remove(node); result.append(node)
        return result
    group_order = ordered(upper, data['graphs']['L1']['edges'])
    feedback = {(e['from'], e['to']) for e in layout.get('feedback_edges', []) if e['level'] == 'L2'}
    plans = []
    for owner in group_order:
        members = [n for n in lower if old['nodes'][n]['owner'] == owner]
        preferred = old.get('representatives', {}).get(owner)
        members.sort(key=lambda n: n != preferred)
        links = [e for e in data['graphs']['L2']['edges'] if e['from'] in members and e['to'] in members and (e['from'], e['to']) not in feedback]
        sequence = ordered(members, links)
        choices = []
        for columns in range(1, min(3, len(sequence)) + 1):
            width, height = (columns - 1) * 340 + 230, ((len(sequence) - 1) // columns) * 170 + 72
            choices.append((abs(math.log(width / height)) + columns * .02, columns, width, height))
        _, columns, width, height = min(choices)
        plans.append({'owner': owner, 'members': sequence, 'columns': columns, 'w': width, 'h': height})
    if not plans:
        return data
    min_width = max(p['w'] for p in plans)
    max_width = sum(p['w'] + 160 for p in plans)
    best = None
    for target in range(min_width, max_width + 81, 40):
        for stagger in [0, .5, 1, 2]:
            x = y = row_height = width = column = 0
            slots, anchors, representatives = {}, {}, {}
            for plan in plans:
                if x and x + plan['w'] > target:
                    y += row_height + 170; x = row_height = column = 0
                offset = column * 170 * stagger
                for i, node in enumerate(plan['members']):
                    slots[node] = {'x': x + i % plan['columns'] * 340, 'y': y + offset + i // plan['columns'] * 170, 'owner': plan['owner']}
                rep = old.get('representatives', {}).get(plan['owner'])
                if rep not in plan['members']:
                    rep = plan['members'][0]
                representatives[plan['owner']] = rep
                anchors[plan['owner']] = {a: slots[rep][a] for a in ['x', 'y']}
                width = max(width, x + plan['w']); row_height = max(row_height, offset + plan['h']); x += plan['w'] + 160; column += 1
            height = y + row_height
            aw = max(p['x'] + 230 for p in anchors.values()) - min(p['x'] for p in anchors.values())
            ah = max(p['y'] + 72 for p in anchors.values()) - min(p['y'] for p in anchors.values())
            score = 2 * abs(math.log(width / height)) + abs(math.log(aw / ah)) + .04 * width * height / sum(p['w'] * p['h'] for p in plans)
            if best is None or score < best[0]:
                best = (score, slots, anchors, representatives)
    _, slots, anchors, representatives = best
    layout['shape'] = 'square'
    layout['stable_positions'] = {'purpose': 'Store full L2 reference coordinates and primary ownership; mixed expansion retains within-group positions and arranges groups compactly.',
                                  'nodes': slots, 'anchors': anchors, 'representatives': representatives, 'docks': {}}
    return data


def validate_display(data, hints):
    """Check inputs for fixed ownership while preserving node identities, original directions, and actual mappings."""
    if not isinstance(data, dict) or not isinstance(hints, dict):
        raise ValueError('Code graph and display must be objects')
    layout = hints.get('presentation', {}).get('layout', {})
    fixed = layout.get('stable_positions', {})
    if layout.get('exclusive_groups') is not True or not fixed:
        raise ValueError('display.presentation.layout requires exclusive_groups=true and stable_positions')
    if set(data['graphs']) != {'L1', 'L2'}:
        raise ValueError('graphs requires L1 and L2')
    levels = {}
    for level in ['L1', 'L2']:
        nodes = data['graphs'][level]['nodes']
        ids = {n['id'] for n in nodes}
        if len(ids) != len(nodes):
            raise ValueError('Duplicate node ID in ' + level)
        if set(hints[level]['nodes']) != ids:
            raise ValueError('display.' + level + '.nodes must cover all nodes')
        for edge in data['graphs'][level]['edges']:
            if edge['from'] not in ids or edge['to'] not in ids:
                raise ValueError('Edge endpoint missing in ' + level)
        levels[level] = ids
    upper, lower = levels['L1'], levels['L2']
    nodes = fixed.get('nodes', {})
    mappings = {id: set() for id in upper}
    for item in data['mappings']['L1_L2']:
        if item['from'] not in upper or not set(item['to']) <= lower:
            raise ValueError('Invalid L1_L2 mapping')
        mappings[item['from']].update(item['to'])
    if set(nodes) != lower:
        raise ValueError('stable_positions.nodes must cover all L2 nodes')
    for id, node in nodes.items():
        owner = node.get('owner')
        if owner not in upper or id not in mappings[owner]:
            raise ValueError(id + ' requires an owner from its real L1_L2 mappings')
        for axis in ['x', 'y']:
            value = node.get(axis)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError(id + '.' + axis + ' requires a finite coordinate')
    for id in upper:
        representative = fixed.get('representatives', {}).get(id)
        anchor = fixed.get('anchors', {}).get(id, {})
        if representative not in nodes or nodes[representative]['owner'] != id:
            raise ValueError(id + ' requires a representative from its primary members')
        if any(anchor.get(axis) != nodes[representative][axis] for axis in ['x', 'y']):
            raise ValueError(id + ' anchor must match its representative')


