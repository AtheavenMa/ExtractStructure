"""Purpose and main functions: Assemble agent-authored function nodes, relationships, and source symbols into Atlas graph JSON.

Scope: Rebuild a single file graph from agent-supplied function names, meanings, conditions, and relationships;
the program adds source locations, fixed presentation fields, and saving.
"""
from __future__ import annotations
import ast
import hashlib
import json
from pathlib import Path

from layout import square_layout


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
    if not recipe['groups']:
        raise ValueError('Provide at least one function group')
    groups=recipe['groups'];owners={};nodes=[];lookup={};upper=[];mappings=[];slots={};anchors={};representatives={};plans=[]
    for group in groups:
        uid='L1_'+group['id'];members=[]
        for spec in group['nodes']:
            id='L2_'+spec['id']
            if id in lookup: raise ValueError('Duplicate primary node '+id)
            role=spec.get('role','operation')
            if role not in {'operation','object','result','failure'}: raise ValueError('Unknown role '+role)
            node={'id':id,'name':spec['name'],'meaning':spec['meaning'],'source':refs(spec['symbols'])}
            if 'category' in spec:
                if spec['category'] not in {'input','process','output','independent'}: raise ValueError('Unknown node category')
                node['category'] = spec['category']
            if 'implementation_details' in spec:
                node['implementation_details']=spec['implementation_details']
            if role=='failure':node['kind']='exception'
            elif role=='object':node['kind']='state'
            lookup[id]=node;nodes.append(node);members.append(id);owners[id]=uid
        if any(n['id'] == uid for n in upper):
            raise ValueError('Duplicate function ID ' + uid)
        upper.append({'id':uid,'name':group['name'],'meaning':group.get('meaning',group['name']+': '+', '.join(lookup[id]['name']for id in members)),'source':refs(group.get('symbols',list(dict.fromkeys(s for n in group['nodes']for s in n['symbols']))))})
        if 'category' in group:
            if group['category'] not in {'input','process','output','independent'}: raise ValueError('Unknown group category')
            upper[-1]['category'] = group['category']
        mappings.append({'from':uid,'to':members,'description':group.get('meaning',group['name']),'source':upper[-1]['source']})
        if not members:
            raise ValueError('Each function requires at least one primary node')
        columns = group.get('columns', 2)
        if isinstance(columns, bool) or not isinstance(columns, int) or columns < 1:
            raise ValueError('columns must be a positive integer')
        columns = min(columns, len(members))
        plans.append({'group':group,'uid':uid,'members':members,'columns':columns,'w':(columns-1)*360+230,'h':((len(members)-1)//columns)*180+72})
    for group, mapping in zip(groups, mappings):
        shared = ['L2_' + name for name in group.get('shared_nodes', [])]
        if any(name not in lookup for name in shared):
            raise ValueError('Unknown shared node')
        mapping['to'] = list(dict.fromkeys(mapping['to'] + shared))
    edges=[];feedback=[]
    for spec in recipe['edges']:
        frm,to='L2_'+spec['from'],'L2_'+spec['to'];edge={'from':frm,'to':to,'label':spec['label'],'description':spec.get('description',spec['label']),'source':refs(spec['symbols'])if spec.get('symbols')else lookup[frm]['source']}
        if spec.get('condition'):edge['condition']=spec['condition']
        if spec.get('feedback'):feedback.append({'level':'L2','index':len(edges),'from':frm,'to':to,'reason':spec.get('condition',spec['label'])})
        edges.append(edge)
    # Topologically order each concept without turning source order into program semantics.
    for plan in plans:
        original=plan['members'];pending=set(original);ordered=[]
        links=[(e['from'],e['to'])for i,e in enumerate(edges)if not any(f['index']==i for f in feedback)and e['from']in pending and e['to']in pending and e['from']!=e['to']]
        while pending:
            ready=[id for id in original if id in pending and not any(b==id and a in pending for a,b in links)]
            if not ready: raise ValueError(source+': non-feedback cycle needs semantic review')
            id=ready[0];pending.remove(id);ordered.append(id)
        plan['members']=ordered
    y=0
    for start in range(0,len(plans),2):
        row=plans[start:start+2];x=0
        for plan in row:
            group=plan['group'];gx,gy=group.get('origin',[x,y])
            for i,id in enumerate(plan['members']):slots[id]={'x':gx+(i%plan['columns'])*360,'y':gy+(i//plan['columns'])*180,'owner':plan['uid']}
            rep='L2_'+group['representative']if group.get('representative')else plan['members'][0]
            representatives[plan['uid']]=rep;anchors[plan['uid']]={axis:slots[rep][axis]for axis in ['x','y']};x+=plan['w']+210
        y+=max(p['h']for p in row)+240
    upperedges=[]
    for spec in recipe.get('upper_edges',[]):
        frm,to='L1_'+spec['from'],'L1_'+spec['to'];edge={'from':frm,'to':to,'label':spec['label'],'description':spec.get('description',spec['label']),'source':refs(spec.get('symbols',['<module>']))}
        if spec.get('feedback'):
            feedback.append({'level':'L1','index':len(upperedges),'from':frm,'to':to,'reason':spec.get('reason',spec['label'])})
        upperedges.append(edge)
    relation_mappings=[]
    adjacency = {}
    for edge in edges:
        adjacency.setdefault(edge['from'], []).append(edge['to'])
    mapping_members = {m['from']: set(m['to']) for m in mappings}
    for edge in upperedges:
        if edge['from'] not in mapping_members or edge['to'] not in mapping_members:
            raise ValueError('Upper relation refers to an unknown function')
        paths = []
        for start in sorted(mapping_members[edge['from']]):
            queue, seen = [[start]], {start}
            for path_nodes in queue:
                if len(path_nodes) > 1 and path_nodes[-1] in mapping_members[edge['to']]:
                    paths.append(path_nodes)
                    break
                for dest in adjacency.get(path_nodes[-1], []):
                    if dest not in seen:
                        seen.add(dest)
                        queue.append(path_nodes + [dest])
        if not paths:
            raise ValueError(source+': upper relation requires a real lower path')
        relation_mappings.append({'upper':{'from':edge['from'],'to':edge['to']},
                                  'lower_paths':paths,'source':edge['source']})
    presentation={'relationship_summaries':[{'level':level,'index':i,'from':e['from'],'to':e['to'],'text':e['label']}for level,es in [('L1',upperedges),('L2',edges)]for i,e in enumerate(es)],'connection_pairs':{},'shared_targets':{'L2_'+id:label for id,label in recipe.get('shared_targets',{}).items()},'shared_sources':{'L2_'+id:label for id,label in recipe.get('shared_sources',{}).items()},'layout':{'shape':recipe.get('layout_shape','square'),'exclusive_groups':True,'feedback_edges':feedback,'stable_positions':{'purpose':'Store full L2 reference coordinates and unique primary ownership by reviewed function for compact arrangement by expansion state.','nodes':slots,'anchors':anchors,'representatives':representatives,'docks':{}}}}
    display={'title':path.name+' · '+recipe['purpose'],'purpose':'Store presentation data for this file\'s two-level function graph.','scope':'The single Atlas graph for the current file.','presentation':presentation}
    for level,ns in [('L1',upper),('L2',nodes)]:
        display[level]={'nodes':{n['id']:{'column':0,'lane':0,'role':next((s.get('role','operation')for g in groups for s in g['nodes']if 'L2_'+s['id']==n['id']),'operation')}for n in ns},'main_edges':[]}
    data = {'graph_kind':'file','purpose':recipe['purpose'],'scope':{'target':source,'coverage':'Organize source functions into two levels, retaining complete function locations in source_index.'},'source':source,'context':{'interpretation':recipe['purpose'],'basis':'The agent summarizes objects, actions, conditions, and results from source; AST provides source locations.','external_boundary':recipe.get('external_boundary','Describe neighboring module behavior through actual calls.')},'source_index':list(index.values()),'analysis':{'method':'Agent-authored functional graph; AST used only for source locations','source_sha256':hashlib.sha256(text.encode()).hexdigest()},'graphs':{'L1':{'name':'Functions','explanation':recipe['purpose'],'nodes':upper,'edges':upperedges},'L2':{'name':'Steps','explanation':recipe.get('explanation',recipe['purpose']),'nodes':nodes,'edges':edges}},'mappings':{'L1_L2':mappings,'relations':relation_mappings},'display':display}
    if recipe.get('i18n'):
        data['i18n'] = recipe['i18n']
    return square_layout(data)

