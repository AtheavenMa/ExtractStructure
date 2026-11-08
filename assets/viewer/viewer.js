/* 目的和主要功能：在同一画布展开功能和具体内容，维护位置、连线及关系高亮。
 * 适用范围：ExtractStructure 的文章、目录和文件图；根据当前图资料在浏览器中绘图。
 */
'use strict';
window.ExtractViewerMount=function(){
  const lifetime=new AbortController();
  const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...(typeof options==='boolean'?{capture:options}:options),signal:lifetime.signal});

function createSemanticModel(data, layouts, presentation={}) {
  const layoutHints=presentation.layout||{};
  function isFeedback(ref){const edge=data.graphs[ref.level].edges[ref.index];return edge.from===edge.to||(layoutHints.feedback_edges||[]).some(h=>h.level===ref.level&&h.index===ref.index&&h.from===edge.from&&h.to===edge.to);}
  const upper = data.graphs.L1, lower = data.graphs.L2;
  const mappings = data.mappings.L1_L2 || [];
  const children = new Map(upper.nodes.map(n => [n.id, new Set()]));
  const owners = new Map(lower.nodes.map(n => [n.id, []]));
  for (const m of mappings) {
    if (!children.has(m.from)) continue;
    for (const id of m.to) if (owners.has(id)) {
      children.get(m.from).add(id);
      if (!owners.get(id).includes(m.from)) owners.get(id).push(m.from);
    }
  }
  const upperBy = new Map(upper.nodes.map(n => [n.id, n]));
  const lowerBy = new Map(lower.nodes.map(n => [n.id, n]));
  const displayChildren=layoutHints.exclusive_groups?new Map(upper.nodes.map(n=>[n.id,new Set(lower.nodes.filter(v=>layoutHints.stable_positions.nodes[v.id].owner===n.id).map(v=>v.id))])):children;
  const singleOwners=new Set(upper.nodes.filter(n=>displayChildren.get(n.id).size===1).map(n=>n.id));
  function exclusiveProject(expanded){
    const effective=new Set([...expanded,...singleOwners]),all=upper.nodes.every(n=>effective.has(n.id)),none=upper.nodes.every(n=>singleOwners.has(n.id)||!expanded.has(n.id));
    const primary=id=>layoutHints.stable_positions.nodes[id].owner;
    const visible=new Set(lower.nodes.filter(n=>effective.has(primary(n.id))).map(n=>n.id));
    const nodes=[...upper.nodes.filter(n=>!effective.has(n.id)).map(n=>({...n,level:'L1'})),...lower.nodes.filter(n=>visible.has(n.id)).map(n=>({...n,level:'L2',singleOwner:singleOwners.has(primary(n.id))?primary(n.id):null}))];
    const endpoint=id=>visible.has(id)?id:primary(id),upperEndpoint=id=>singleOwners.has(id)?[...displayChildren.get(id)][0]:id;
    const upperPairs=new Set(upper.edges.map(e=>JSON.stringify([upperEndpoint(e.from),upperEndpoint(e.to)].sort())));
    if(none&&!all){const links=upper.edges.map((e,index)=>({...e,from:upperEndpoint(e.from),to:upperEndpoint(e.to),refs:[{level:'L1',index}]}));
      lower.edges.forEach((e,index)=>{const from=upperEndpoint(primary(e.from)),to=upperEndpoint(primary(e.to));if(from!==to&&!upperPairs.has(JSON.stringify([from,to].sort())))links.push({...e,from,to,projected:true,refs:[{level:'L2',index}]});});
      return{nodes,edges:mergeConnections(links),all,none};}
    const edges=[];
    lower.edges.forEach((e,index)=>{const from=endpoint(e.from),to=endpoint(e.to);if(from===to&&!(visible.has(e.from)&&visible.has(e.to)))return;if(upperBy.has(from)&&upperBy.has(to)&&upperPairs.has(JSON.stringify([from,to].sort())))return;edges.push({...e,from,to,projected:from!==e.from||to!==e.to,refs:[{level:'L2',index}]});});
    upper.edges.forEach((e,index)=>{if(!effective.has(e.from)&&!effective.has(e.to))edges.push({...e,refs:[{level:'L1',index}]});});
    return{nodes,edges:mergeConnections(edges),all,none};
  }
  function mergeConnections(edges) {
    const bundles=new Map();
    for(const edge of edges){
      const key=JSON.stringify([edge.from,edge.to].sort());
      if(!bundles.has(key))bundles.set(key,{...edge,key,refs:[],members:[],projected:false,bidirectional:false});
      const bundle=bundles.get(key);bundle.projected ||= !!edge.projected;
      for(const ref of edge.refs){bundle.refs.push(ref);bundle.members.push({from:edge.from,to:edge.to,ref});}
      if(edge.from!==edge.to && edge.from!==bundle.from)bundle.bidirectional=true;
    }
    return [...bundles.values()].map(edge=>{
      if(edge.refs.length>1){
        edge.label=edge.members.map(m=>{
          const raw=data.graphs[m.ref.level].edges[m.ref.index];
          const prefix=edge.bidirectional?(m.from===edge.from?'→ ':'← '):'· ';
          return prefix+(raw.label||raw.description);
        }).join('\n');
        edge.description=edge.refs.map(ref=>data.graphs[ref.level].edges[ref.index].description).join('\n');
      }
      edge.feedback=edge.members.every(m=>isFeedback(m.ref));
      return edge;
    });
  }
  function project(expanded) {
    if(layoutHints.exclusive_groups)return exclusiveProject(expanded);
    const all = upper.nodes.every(n => expanded.has(n.id));
    const none = expanded.size === 0;
    const visibleLower = new Set(lower.nodes.filter(n => all || owners.get(n.id).some(id => expanded.has(id))).map(n => n.id));
    const nodes = [...upper.nodes.filter(n => !expanded.has(n.id)).map(n => ({...n, level:'L1'})),
      ...lower.nodes.filter(n => visibleLower.has(n.id)).map(n => ({...n, level:'L2'}))];
    const representatives = id => visibleLower.has(id) ? id : owners.get(id).find(owner => !expanded.has(owner));
    if (none) return {nodes, edges:mergeConnections(upper.edges.map((e,i) => ({...e,key:'upper:'+i,refs:[{level:'L1',index:i}]}))), all, none};
    if (all) return {nodes, edges:mergeConnections(lower.edges.map((e,i) => ({...e,key:'lower:'+i,refs:[{level:'L2',index:i}]}))), all, none};
    const edges=[];
    lower.edges.forEach((edge,index) => {
      const from=representatives(edge.from), to=representatives(edge.to);
      if (!from || !to) return;
      if (from === to && !(visibleLower.has(edge.from) && visibleLower.has(edge.to))) return;
      if (upperBy.has(from) && upperBy.has(to)) return;
      edges.push({...edge,from,to,projected:from!==edge.from||to!==edge.to,refs:[{level:'L2',index}]});
    });
    upper.edges.forEach((e,i) => {
      if(!expanded.has(e.from) && !expanded.has(e.to)) edges.push({...e,key:'upper:'+i,refs:[{level:'L1',index:i}]});
    });
    return {nodes,edges:mergeConnections(edges),all,none};
  }
  function place(scene,saved={},context={}) {return compactExpansionLayout(scene,{children,owners,upperBy,lowerBy,upperEdges:upper.edges,isFeedback,layoutHints},layouts,saved,context);}

  return {project,place,children,displayChildren,owners,upperBy,lowerBy,isFeedback,layoutHints};
}

function assignNodeCategories(graph){
  for(const level of ['L1','L2']){
    const nodes=graph.graphs[level].nodes,edges=graph.graphs[level].edges;
    const degrees=new Map(nodes.map(n=>[n.id,{incoming:0,outgoing:0}]));
    for(const edge of edges){
      if(degrees.has(edge.from))degrees.get(edge.from).outgoing++;
      if(degrees.has(edge.to))degrees.get(edge.to).incoming++;
    }
    for(const node of nodes){
      const {incoming,outgoing}=degrees.get(node.id);
      node.category=!incoming&&!outgoing?'independent':node.category||(!incoming?'input':!outgoing?'output':'process');
    }
  }
}
assignNodeCategories(B.data);
window.SemanticGraphModel = createSemanticModel;
const $=s=>document.querySelector(s), data=B.data, model=createSemanticModel(data,B.layouts,B.presentation);
const NS='http://www.w3.org/2000/svg', expanded=new Set(), cached=new Map();
const ioCategories=true;
const categoryColors={input:'var(--atlas-data)',process:'var(--atlas-operation)',output:'var(--atlas-copper)',independent:'var(--atlas-independent)'};
if(ioCategories){
  const legend=document.querySelector('.status-legend');legend.replaceChildren();
  for(const [category,label]of [['input','输入'],['process','过程'],['output','输出'],['independent','独立']]){
    const item=document.createElement('span');item.className='legend-item';
    const swatch=document.createElement('i');swatch.className='legend-swatch';swatch.style.background=categoryColors[category];
    item.append(swatch,document.createTextNode(GraphLocale.t(label)));legend.append(item);
  }
}

const stableSkeleton=model.layoutHints.stable_positions;
const compactCollapsed=!!stableSkeleton&&model.layoutHints.collapse_layout!=='fixed';
const expandableIds=[...model.upperBy.keys()].filter(id=>!model.layoutHints.exclusive_groups||model.displayChildren.get(id).size>1);
const storageKey=(stableSkeleton?'semantic-stable-v1:':'semantic-compact-v1:')+data.source+':'+B.input_sha256;
let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{}
let scene, positions={}, displayPositions={}, nodeElements=new Map(), edgeElements=new Map();
let ownerElements=new Map(), selected=[], selectionEdge=null, box,fitBox,drag=null;
let cameraAnimation=0,suppressClick=false,transitioning=false;
// A restored camera is an explicit user view; later label completion retains it.
let preserveRestoredView=!!B.restore;
const tr=window.GraphLocale?.t||((key,values={})=>key.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'{'+k+'}'));
const root=document.createElementNS(NS,'svg');
root.id='diagram';root.setAttribute('role','img');root.setAttribute('aria-label',tr('可逐节点展开的两层语义图'));
root.style.fontFamily='var(--atlas-font-sans)';
$('#canvas').append(root);
function svg(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
const defs=svg('defs');root.append(defs);
for(const[kind,color]of [['main','var(--atlas-edge)'],['aux','var(--atlas-edge)'],['failure','var(--atlas-edge)'],['selected','var(--atlas-accent)']]){
  const marker=svg('marker',{id:'arrow-'+kind,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});
  marker.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.append(marker);
}
const rangeLayer=svg('g',{'class':'concept-ranges'});let rangePlan={regions:[],headers:[]},hoverConcept=null;
const wireLayer=svg('g',{'class':'wire-layer'}),captionLayer=svg('g',{'class':'inline-captions'});let wireElements=new Map(),captionElements=new Map(),inlineCaptions=[],captionModel=null;
const guides=svg('g',{'class':'guides'}),edgeLayer=svg('g',{'class':'edges'}),nodeLayer=svg('g',{'class':'nodes'}),controls=svg('g',{'class':'owner-controls'});
root.append(rangeLayer,guides,wireLayer,edgeLayer,captionLayer,nodeLayer,controls);
function nodeBy(id){return model.upperBy.get(id)||model.lowerBy.get(id);}
function stateKey(){return [...expanded].sort().join('|');}
const wrap=wrapCaptionText;
function overview(){
  $('#sceneStatus').textContent=tr('{nodes} 个节点 · {lines} 条连线 · {relations} 项关系',{nodes:scene.nodes.length,lines:scene.edges.length,relations:scene.edges.reduce((n,e)=>n+e.refs.length,0)});
}
function highlight(ids=[],key=null){
  selected=ids;selectionEdge=key;const keys=new Set(Array.isArray(key)?key:key?[key]:scene.edges.filter(e=>ids.includes(e.from)||ids.includes(e.to)).map(e=>e.key)),active=ids.length>0||key!==null;
  $('#sceneStatus').classList.toggle('selection-active',active);
  const near=new Set(ids);for(const e of scene.edges)if(keys.has(e.key)){near.add(e.from);near.add(e.to);}
  for(const[id,g]of nodeElements){g.classList.toggle('selected',ids.includes(id)||key!==null&&near.has(id));g.classList.toggle('dim',active&&!near.has(id));}
  for(const e of scene.edges){const g=edgeElements.get(e.key),on=keys.has(e.key);g.classList.toggle('selected',on);g.classList.toggle('dim',active&&!on);}
  for(const[id,g]of wireElements){const segment=routingPlan?.segments.find(s=>s.id===id),on=segment&&segment.keys.some(k=>keys.has(k));g.classList.toggle('selected',!!on);g.classList.toggle('dim',active&&!on);
    const line=g.querySelector('.wire-line'),kind=on?'selected':g.dataset.arrowKind;
    if(segment?.arrowEnd)line.setAttribute('marker-end','url(#arrow-'+kind+')');
    if(segment?.arrowStart)line.setAttribute('marker-start','url(#arrow-'+kind+')');}
  for(const caption of inlineCaptions){const g=captionElements.get(caption.id);if(g){const on=caption.keys.some(key=>keys.has(key));g.classList.toggle('selected',on);g.classList.toggle('dim',active&&!on);}}
}
function showWireRelations(keys){
  const valid=keys.filter(key=>scene.edges.some(e=>e.key===key));if(!valid.length)return;
  highlight([],valid);const text=captionModel.summarize(valid);$('#sceneStatus').textContent=text;
}
function showSegment(id){const segment=routingPlan?.segments.find(s=>s.id===id);if(segment)showWireRelations(segment.keys);}
function showNode(id){
  const n=nodeBy(id);if(!n)return;highlight([id]);
  $('#sceneStatus').textContent=tr('{name} · 已突出相关连线',{name:n.name});
}
function showEdge(key){showWireRelations([key]);}
function hoverNode(id){
  const related=new Set(scene.edges.filter(edge=>edge.from===id||edge.to===id).map(edge=>edge.key));
  for(const segment of routingPlan?.segments||[])wireElements.get(segment.id)?.classList.toggle('related-hover',segment.keys.some(key=>related.has(key)));
}
function setBox(next){box=next;root.setAttribute('viewBox',box.join(' '));const label=Math.round(fitBox[2]/box[2]*100)+'%',badge=$('#zoom');if(badge.textContent!==label)badge.textContent=label;}
function boundsFor(ps=positions){const values=Object.values(ps);return{minX:Math.min(...values.map(p=>p.x))-70,minY:Math.min(...values.map(p=>p.y))-125,maxX:Math.max(...values.map(p=>p.x+230))+80,maxY:Math.max(...values.map(p=>p.y+72))+175};}
function viewFor(bounds){const rect=$('#canvas').getBoundingClientRect(),ratio=rect.width/rect.height;let width=bounds.maxX-bounds.minX,height=bounds.maxY-bounds.minY;if(width/height<ratio)width=height*ratio;else height=width/ratio;return[(bounds.minX+bounds.maxX-width)/2,(bounds.minY+bounds.maxY-height)/2,width,height];}
function calculateFit(){const b=root.getBBox(),extent={minX:b.x-50,minY:b.y-60,maxX:b.x+b.width+50,maxY:b.y+b.height+60};
  if(stableSkeleton&&(!compactCollapsed||scene.all)){const reserved=Object.values({...stableSkeleton.nodes,...stableSkeleton.anchors,...stableSkeleton.docks});extent.minX=Math.min(extent.minX,...reserved.map(p=>p.x-90));extent.minY=Math.min(extent.minY,...reserved.map(p=>p.y-110));extent.maxX=Math.max(extent.maxX,...reserved.map(p=>p.x+320));extent.maxY=Math.max(extent.maxY,...reserved.map(p=>p.y+170));}
  return viewFor(extent);
}
function fit(){cameraAnimation++;fitBox=calculateFit();setBox([...fitBox]);}
function moveBox(target){cameraAnimation++;setBox(target);}
function focus(ids){const ps={};for(const id of ids)if(positions[id])ps[id]=positions[id];if(Object.keys(ps).length)moveBox(viewFor(boundsFor(ps)));}
const explanation=document.createElement('div');explanation.className='node-explanation';explanation.id='nodeExplanation';explanation.setAttribute('role','tooltip');explanation.hidden=true;document.body.append(explanation);
function hideExplanation(){explanation.hidden=true;for(const g of nodeElements.values())g.removeAttribute('aria-describedby');}
function showExplanation(node,element){
  const name=document.createElement('strong'),meaning=document.createElement('div');name.textContent=node.name;meaning.textContent=node.meaning||'';
  explanation.replaceChildren(name,meaning);explanation.hidden=false;element.setAttribute('aria-describedby',explanation.id);
  const rect=element.getBoundingClientRect(),w=explanation.offsetWidth,h=explanation.offsetHeight;
  explanation.style.left=Math.max(8,Math.min(rect.left,innerWidth-w-8))+'px';
  explanation.style.top=Math.max(8,rect.bottom+h+16<innerHeight?rect.bottom+8:rect.top-h-8)+'px';
}
function makeNode(n){
  const upper=n.level==='L1',p=positions[n.id];
  const g=svg('g',{'class':'node graph-node density-compact '+(upper?'upper':'lower'),'data-node':n.id,'data-level':n.level,tabindex:0,role:'button','aria-label':upper?tr('{name}，点击展开',{name:n.name}):n.name,...(upper?{'aria-expanded':'false'}:{})});
  g.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!drag){hoverNode(n.id);showExplanation(n,g);}});g.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!drag){hoverNode(null);hideExplanation();}});
  g.addEventListener('focusin',()=>showExplanation(n,g));g.addEventListener('focusout',hideExplanation);
  g.setAttribute('aria-label',(upper?tr('{name}，点击展开',{name:n.name}):n.name)+(n.meaning?' — '+n.meaning:''));
  g.append(svg('rect',{'class':'node-surface',width:230,height:72,rx:10}));
  if(ioCategories&&categoryColors[n.category]){g.classList.add('category-'+n.category);g.style.setProperty('--node-category-color',categoryColors[n.category]);}
  const stripe=ioCategories&&categoryColors[n.category]?categoryColors[n.category]:upper?'var(--atlas-overview)':({operation:'var(--atlas-operation)',object:'var(--atlas-data)',result:'var(--atlas-result)',failure:'var(--atlas-rejection)'}[p.role]||'var(--atlas-operation)');
  g.append(svg('rect',{'class':'node-status',x:0,y:12,width:3,height:48,rx:1.5,fill:stripe}));
  const entryPath=n.file||n.folder,folderNode=n.entry_kind==='folder';
  const fileNode=data.graph_kind==='folder'&&n.level==='L2'&&entryPath;
  const detail=fileNode&&B.layouts.L2.nodes[n.id]?.detail_graph;
  const validDetail=detail&&detail.source===entryPath&&typeof detail.id==='string'&&/^(files|folders)\//.test(detail.id)&&!/[\\\0]/.test(detail.id)&&detail.id.split('/').every(p=>p&&p!=='.'&&p!=='..');
  const title=fileNode?(n.name.includes('\n')?n.name.split('\n').slice(1).join('\n'):n.meaning):n.name;
  const fullRows=wrap(title,12),limit=fileNode?2:4,rows=fullRows.slice(0,limit),lineHeight=16;
  if(fullRows.length>limit)rows[limit-1]=rows[limit-1].replace(/.$/u,'')+'…';
  const blockHeight=fileNode?13+8+12+(rows.length-1)*lineHeight:12+(rows.length-1)*lineHeight;
  const blockTop=(72-blockHeight)/2;
  if(fileNode){
    const filename=entryPath.split('/').at(-1)+(folderNode?'/':'');
    const label=svg('text',{'class':'node-filename',x:115,y:blockTop+6.5,'text-anchor':'middle','dominant-baseline':'central'},filename);
    if(validDetail){const link=svg('a',{'class':'node-entry-link '+(folderNode?'node-folder-link':'node-file-link'),href:'/extract-structure/'+entryPath.split('/').map(encodeURIComponent).join('/'),tabindex:0,'aria-label':tr(folderNode?'打开 {name} 的目录图':'打开 {name} 的单文件图',{name:filename})});link.append(label);g.append(link);}else g.append(label);
  }
  rows.forEach((text,i)=>g.append(svg('text',{'class':'node-title'+(rows.length>2?' multi-line':''),x:115,y:blockTop+(fileNode?13+8:0)+6+i*lineHeight,'text-anchor':'middle','dominant-baseline':'central'},text)));
  if(upper){
    const count=svg('g',{'class':'child-count',transform:'translate(198,10)'});
    count.append(svg('rect',{width:24,height:18,rx:5}),svg('text',{x:12,y:13,'text-anchor':'middle'},model.displayChildren.get(n.id).size));g.append(count);
  }
  return g;
}
function makeEdge(e){return svg('g',{'class':'edge','data-edge':e.key,'data-from':e.from,'data-to':e.to});}
let routingPlan=null,routingSignature='';const captionLayouts=new Map(),routingLayouts=new Map();
let captionTask=null,captionError=null,captionElapsedMs=null;
function cancelCaptionTask(){if(captionTask){captionTask.worker.terminate();captionTask=null;}}
listen(window,'pagehide',cancelCaptionTask);
listen(window,'pageshow',event=>{if(event.persisted&&routingPlan)drawGeometry(positions);});
function drawGeometry(ps){
  displayPositions=ps;for(const[id,g]of nodeElements){const p=ps[id];g.setAttribute('transform',`translate(${p.x},${p.y})`);}
  rangePlan=computeConceptRanges(expanded,model,ps);drawConceptRegions(rangePlan);
  const extra=rangePlan.headers.map(b=>({x:b.x-5,y:b.y-4,w:b.w+10,h:b.h+8}));
  const signature=JSON.stringify([scene.edges.map(e=>e.key),ps,extra]);
  if(signature!==routingSignature){
    routingPlan=routingLayouts.get(signature);
    if(!routingPlan){
      routingPlan=planOrthogonalGraph(scene.edges,ps,new Map(),extra);
      routingLayouts.set(signature,routingPlan);
      if(routingLayouts.size>12)routingLayouts.delete(routingLayouts.keys().next().value);
    }
    routingSignature=signature;
  }
  renderWireSegments(extra);
}
function renderWireSegments(extra){
  wireLayer.replaceChildren();wireElements=new Map();
  const priority=e=>e.refs.some(r=>r.level==='L1'||r.level==='L2'&&B.layouts.L2.edges.some(p=>(p.indices||[p.index]).includes(r.index)&&p.primary));
  for(const segment of routingPlan.segments){
    const edges=segment.keys.map(key=>scene.edges.find(e=>e.key===key));const failure=edges.every(e=>positions[e.to].role==='failure'),main=edges.some(priority),kind=failure?'failure':main?'main':'aux';
    const g=svg('g',{'class':'wire-segment '+kind+(segment.keys.length>1?' shared':''),'data-segment':segment.id,'data-members':JSON.stringify(segment.keys),'data-arrow-kind':kind,tabindex:0,role:'button','aria-label':tr('选择这段连线')});
    const path=svg('path',{'class':'wire-line',d:segment.path,fill:'none','stroke-linecap':'round','stroke-linejoin':'round',...(segment.arrowEnd?{'marker-end':'url(#arrow-'+kind+')'}:{}),...(segment.arrowStart?{'marker-start':'url(#arrow-'+kind+')'}:{})});
    g.append(path,svg('path',{'class':'wire-hit',d:segment.path,fill:'none',stroke:'transparent','stroke-width':12}));wireLayer.append(g);wireElements.set(segment.id,g);
  }
  const joints=new Map();for(const segment of routingPlan.segments)for(const p of [segment.a,segment.b]){const key=p.x+':'+p.y;if(!joints.has(key))joints.set(key,{p,segments:[]});joints.get(key).segments.push(segment);}
  for(const joint of joints.values())if(joint.segments.length>=3){const shared=joint.segments.some(s=>s.keys.length>1),common=new Set(joint.segments.flatMap(s=>s.keys));if(shared&&common.size>1)wireLayer.append(svg('circle',{'class':'wire-junction',cx:joint.p.x,cy:joint.p.y,r:2.3,'pointer-events':'none'}));}
  const knownCaptions=captionLayouts.get(routingSignature);
  if(knownCaptions){cancelCaptionTask();captionError=null;captionElapsedMs=knownCaptions.elapsedMs;captionModel=knownCaptions.model;inlineCaptions=knownCaptions.captions;drawInlineCaptions();}
  else requestCaptionLayout(extra);
}
function requestCaptionLayout(extra){
  if(captionTask?.signature===routingSignature)return;
  cancelCaptionTask();captionError=null;captionElapsedMs=null;
  captionModel=buildInlineCaptions(scene,routingPlan.segments,data,B.presentation);
  inlineCaptions=[];captionLayer.replaceChildren();captionElements=new Map();
  const currentModel=captionModel,signature=routingSignature;
  if(!currentModel.captions.length){captionElapsedMs=0;captionLayouts.set(signature,{model:currentModel,captions:[],elapsedMs:0});return;}
  // Background work can be discarded immediately when the user changes view.
  // Only the current geometry may receive its computed labels.
  try{
    const worker=ExtractRuntime.worker();
    const task={worker,signature,camera:null,preserveView:preserveRestoredView};captionTask=task;
    queueMicrotask(()=>{if(captionTask===task)task.camera=cameraAnimation;});
    const fail=message=>{
      if(captionTask!==task)return;
      cancelCaptionTask();captionError=message;
      $('#sceneStatus').textContent=tr('连线说明暂未排好，节点仍可浏览。');
    };
    worker.onerror=event=>{event.preventDefault();fail(event.message||'Caption worker failed');};
    worker.onmessage=({data:reply})=>{
      if(captionTask!==task||routingSignature!==signature)return;
      if(reply.error){fail(reply.error);return;}
      cancelCaptionTask();captionElapsedMs=reply.elapsedMs;
      currentModel.captions=reply.result.modelCaptions;
      const known={model:currentModel,captions:reply.result.captions,elapsedMs:reply.elapsedMs};
      captionLayouts.set(signature,known);
      if(captionLayouts.size>12)captionLayouts.delete(captionLayouts.keys().next().value);
      captionModel=known.model;inlineCaptions=known.captions;drawInlineCaptions();
      fitBox=calculateFit();
      if(!task.preserveView&&cameraAnimation===task.camera&&(compactCollapsed||scene.none||scene.all))fit();
    };
    worker.postMessage({model:{captions:currentModel.captions,individualCaptions:currentModel.individualCaptions},segments:routingPlan.segments,positions,extra,policy:B.presentation.label_layout||{}});
  }catch(error){
    cancelCaptionTask();captionError=String(error.message||error);
    $('#sceneStatus').textContent=tr('连线说明暂未排好，节点仍可浏览。');
  }
}
function drawInlineCaptions(){
  captionLayer.replaceChildren();captionElements=new Map();
  for(const caption of inlineCaptions){const g=svg('g',{'class':'inline-caption'+(caption.shared?' shared':''),'data-caption':caption.id,'data-members':JSON.stringify(caption.keys),transform:`translate(${caption.x},${caption.y})`,role:'button',tabindex:0,'aria-label':caption.text});
    g.append(svg('rect',{'class':'caption-hitbox',x:caption.box.x-caption.x,y:caption.box.y-caption.y,width:caption.box.w,height:caption.box.h,fill:'none',stroke:'none','pointer-events':'all'}));
    if(caption.leader){const l=caption.leader;g.append(svg('path',{'class':'caption-leader',fill:'none',d:'M'+[l.from,...(l.via?[l.via]:[]),l.to].map(p=>(p.x-caption.x)+','+(p.y-caption.y)).join(' L')}),svg('circle',{'class':'caption-anchor',cx:l.from.x-caption.x,cy:l.from.y-caption.y,r:2}));}
    caption.rows.forEach((row,i)=>g.append(svg('text',{x:0,y:i*20,'text-anchor':'middle'},row)));captionLayer.append(g);captionElements.set(caption.id,g);
  }
  highlight(selected,selectionEdge);
}
function roundedRangePath(b){const r=Math.min(17,b.w/4,b.h/4);return `M${b.x+r},${b.y} H${b.x+b.w-r} Q${b.x+b.w},${b.y} ${b.x+b.w},${b.y+r} V${b.y+b.h-r} Q${b.x+b.w},${b.y+b.h} ${b.x+b.w-r},${b.y+b.h} H${b.x+r} Q${b.x},${b.y+b.h} ${b.x},${b.y+b.h-r} V${b.y+r} Q${b.x},${b.y} ${b.x+r},${b.y} Z`;}
function focusConcept(id){
  if(drag)return;
  hoverConcept=id;const own=new Set(rangePlan.regions.find(r=>r.id===id)?.members||[]);
  rangeLayer.querySelectorAll('[data-concept]').forEach(g=>g.classList.toggle('concept-focused',g.dataset.concept===id));
  controls.querySelectorAll('[data-concept]').forEach(g=>g.classList.toggle('concept-focused',g.dataset.concept===id));
  for(const[n,g]of nodeElements){g.classList.toggle('concept-member',!!id&&own.has(n));g.classList.toggle('concept-muted',!!id&&!own.has(n));}
  $('#canvasWrap').classList.toggle('has-concept-focus',!!id);
}
function drawConceptRegions(plan){
  rangeLayer.replaceChildren();controls.replaceChildren();ownerElements=new Map();
  for(const region of [...plan.regions].sort((a,b)=>b.fragments.reduce((n,f)=>n+f.w*f.h,0)-a.fragments.reduce((n,f)=>n+f.w*f.h,0))){
    const g=svg('g',{'class':'concept-range','data-concept':region.id,'data-members':JSON.stringify(region.members)});g.style.setProperty('--concept-color',region.color);
    for(const fragment of region.fragments){const path=roundedRangePath(fragment);
      const area=svg('g',{'data-fragment':fragment.key});area.append(svg('path',{'class':'range-fill',d:path}),svg('path',{'class':'range-outline',d:path}),svg('path',{'class':'range-border-hit',d:path,'data-collapse':region.id,'data-members':JSON.stringify(fragment.members),role:'button',tabindex:0,'aria-label':tr('收起 {name}',{name:region.name})}));g.append(area);
      const title=svg('g',{'class':'concept-title owner-control'+(fragment.secondary?' secondary':''),'data-collapse':region.id,'data-concept':region.id,transform:`translate(${fragment.header.x},${fragment.header.y})`,role:'button',tabindex:0,'aria-expanded':'true','aria-label':tr('收起 {name}',{name:region.name})});title.style.setProperty('--concept-color',region.color);
      title.append(svg('rect',{width:fragment.header.w,height:32,rx:5}),svg('text',{'class':'concept-disclosure',x:9,y:22},'⌄'),svg('text',{'class':'concept-name',x:30,y:22},region.name));controls.append(title);
    }
    rangeLayer.append(g);
  }
  if(hoverConcept&&!plan.regions.some(r=>r.id===hoverConcept))hoverConcept=null;
  if(hoverConcept)focusConcept(hoverConcept);
}
function refreshControls(){ownerElements=new Map();}
function render({anchor=null,previous=null,initial=false}={}){
  hideExplanation();
  transitioning=true;
  wireLayer.replaceChildren();wireElements=new Map();captionLayer.replaceChildren();captionElements=new Map();inlineCaptions=[];
  const oldPositions=structuredClone(displayPositions);hoverConcept=null;focusConcept(null);
  scene=model.project(expanded);const key=stateKey();positions=cached.has(key)?structuredClone(cached.get(key)):model.place(scene,saved,{anchor,previous:oldPositions});
  for(const[id,p]of Object.entries(saved))if(positions[id])Object.assign(positions[id],p);
  cached.set(key,structuredClone(positions));
  const visible=new Set(scene.nodes.map(n=>n.id));
  for(const[id,g]of nodeElements)if(!visible.has(id)){g.remove();nodeElements.delete(id);}
  for(const n of scene.nodes)if(!nodeElements.has(n.id)){const g=makeNode(n);nodeElements.set(n.id,g);nodeLayer.append(g);}
  edgeLayer.replaceChildren();edgeElements=new Map();for(const e of scene.edges){const g=makeEdge(e);edgeElements.set(e.key,g);edgeLayer.append(g);}
  guides.replaceChildren();const b=boundsFor();for(const x of new Set(Object.values(positions).map(p=>p.x+115)))guides.append(svg('line',{x1:x,x2:x,y1:b.minY+30,y2:b.maxY-30,stroke:'#e9eef4','stroke-dasharray':'3 9'}));
  refreshControls();
  const allExpanded=expandableIds.length>0&&expandableIds.every(id=>expanded.has(id));
  $('#expandAll').textContent=tr(allExpanded?'全部收起':'全部展开');
  $('#expandAll').disabled=expandableIds.length===0;
  $('#expandAll').setAttribute('aria-expanded',String(allExpanded));
  highlight();overview();
  if(initial||!box){drawGeometry(positions);fit();transitioning=false;return;}
  // Preserve screen scale and place the expanded implementation around the prior functional card.
  drawGeometry(positions);fitBox=calculateFit();
  if(compactCollapsed)moveBox([...fitBox]);
  else if(stableSkeleton){
    // Preserve scale and camera. Only pan enough to reveal newly introduced nodes when they fit.
    if(!anchor&&scene.all)moveBox([...fitBox]);
    else{const fresh=scene.nodes.filter(n=>!oldPositions[n.id]).map(n=>positions[n.id]);
      if(fresh.length){const minX=Math.min(...fresh.map(p=>p.x))-55,maxX=Math.max(...fresh.map(p=>p.x+230))+55,minY=Math.min(...fresh.map(p=>p.y))-90,maxY=Math.max(...fresh.map(p=>p.y+72))+55;
        let left=box[0],top=box[1];
        if(maxX-minX<=box[2]){if(minX<left)left=minX;else if(maxX>left+box[2])left=maxX-box[2];}
        if(maxY-minY<=box[3]){if(minY<top)top=minY;else if(maxY>top+box[3])top=maxY-box[3];}
        if(left!==box[0]||top!==box[1])moveBox([left,top,box[2],box[3]]);
      }
    }
  }
  else if(previous?.box){moveBox(previous.box);}
  else if(anchor&&oldPositions[anchor]){
    const related=[...model.children.get(anchor)].filter(id=>positions[id]&&(!oldPositions[id]||positions[id].owner===anchor));
    const target=positions[anchor]||(related.length?positions[related[0]]:null);
    if(target){const before=oldPositions[anchor];let width=box[2],height=box[3];if(related.length){const ps=Object.fromEntries(related.map(id=>[id,positions[id]])),bb=boundsFor(ps),factor=Math.max(1,(bb.maxX-bb.minX)/(width*.85),(bb.maxY-bb.minY)/(height*.85));width*=factor;height*=factor;}
      const rx=(before.x+115-box[0])/box[2],ry=(before.y+36-box[1])/box[3];const ratio=box[3]/box[2];height=width*ratio;const local=boundsFor(related.length?Object.fromEntries(related.map(id=>[id,positions[id]])):{[anchor]:target});const left=Math.max(local.maxX-width,Math.min(local.minX,target.x+115-rx*width)),top=Math.max(local.maxY-height,Math.min(local.minY,target.y+36-ry*height));moveBox([left,top,width,height]);}
  }else moveBox([...fitBox]);
  transitioning=false;
}
const history=new Map();
function toggle(id){if(!model.children.has(id)||!model.children.get(id).size||!expandableIds.includes(id))return;const beforeKey=stateKey();history.set(beforeKey,{box:[...box]});if(expanded.has(id))expanded.delete(id);else expanded.add(id);render({anchor:id,previous:history.get(stateKey())});}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(root.getScreenCTM().inverse());}
function zoom(factor,e){cameraAnimation++;const anchor=e?point(e):{x:box[0]+box[2]/2,y:box[1]+box[3]/2};const w=Math.max(300,Math.min(fitBox[2]*4,box[2]*factor)),f=w/box[2];setBox([anchor.x-(anchor.x-box[0])*f,anchor.y-(anchor.y-box[1])*f,w,box[3]*f]);}
listen($('#canvas'),'wheel',e=>{e.preventDefault();zoom(Math.exp(Math.max(-150,Math.min(150,e.deltaY))*.002),e);},{passive:false});
// Track each contact so touch panning and pinch zoom share the same SVG camera.
const gesturePointers=new Map();
let pinch=null,gestureMoved=false,gestureResetTimer,cameraFrame=null,pendingCameraBox=null;
// Coalesce high-frequency touch samples into one SVG update per display frame.
function flushGestureCamera(){
  if(cameraFrame!==null)cancelAnimationFrame(cameraFrame);
  cameraFrame=null;
  if(pendingCameraBox){const next=pendingCameraBox;pendingCameraBox=null;setBox(next);}
}
function queueGestureCamera(next){
  pendingCameraBox=next;
  if(cameraFrame===null)cameraFrame=requestAnimationFrame(()=>{cameraFrame=null;flushGestureCamera();});
}
function panStart(id,p,moved=false){
  const ctm=root.getScreenCTM();
  return{pointerId:id,startClient:{...p},startBox:[...box],units:{x:1/ctm.a,y:1/ctm.d},moved};
}
function captureGesturePointer(id){
  try{if(!$('#canvas').hasPointerCapture(id))$('#canvas').setPointerCapture(id);}catch{}
}
function markGestureMoved(){
  if(gestureMoved)return;
  gestureMoved=true;suppressClick=true;hideExplanation();hoverNode(null);focusConcept(null);
  clearTimeout(gestureResetTimer);
  $('#canvasWrap').classList.add('is-dragging');
  for(const id of gesturePointers.keys())captureGesturePointer(id);
}
function beginPinch(){
  flushGestureCamera();
  const [a,b]=[...gesturePointers.values()],ctm=root.getScreenCTM();
  const center={clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2};
  pinch={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),center,box:[...box],anchor:point(center),units:{x:1/ctm.a,y:1/ctm.d}};
  drag=null;markGestureMoved();
  for(const id of gesturePointers.keys())captureGesturePointer(id);
}
listen($('#canvas'),'pointerdown',e=>{
  const touch=e.pointerType==='touch';
  if(!touch&&(e.button!==0||e.target.closest('.node-entry-link')))return;
  if(!touch&&gesturePointers.size)return;
  flushGestureCamera();cameraAnimation++;clearTimeout(gestureResetTimer);
  if(!gesturePointers.size){gestureMoved=false;suppressClick=false;}
  gesturePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesturePointers.size>=2){beginPinch();return;}
  const n=e.target.closest('.node');
  if(!touch&&e.shiftKey&&n){
    const id=n.dataset.node;drag={id,pointerId:e.pointerId,start:point(e),p:{...positions[id]},moved:false};
  }else if(touch||(!n&&!e.target.closest('.edge,.wire-segment,.owner-control,[data-caption],[data-collapse]'))){
    drag=panStart(e.pointerId,{x:e.clientX,y:e.clientY});
  }
  // Leave an unmoved touch on its original target so a tap still activates that control.
  if(drag&&!touch)captureGesturePointer(e.pointerId);
});
listen($('#canvas'),'pointermove',e=>{
  if(!gesturePointers.has(e.pointerId))return;
  gesturePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(gesturePointers.size>=2){
    if(!pinch)beginPinch();
    const [a,b]=[...gesturePointers.values()],distance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
    const center={clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2};
    const {anchor,units}=pinch,baseline=pinch.box;
    const width=Math.max(300,Math.min(fitBox[2]*4,baseline[2]*pinch.distance/distance)),factor=width/baseline[2];
    const dx=(center.clientX-pinch.center.clientX)*units.x,dy=(center.clientY-pinch.center.clientY)*units.y;
    queueGestureCamera([anchor.x-(anchor.x-baseline[0]+dx)*factor,anchor.y-(anchor.y-baseline[1]+dy)*factor,width,baseline[3]*factor]);
    markGestureMoved();return;
  }
  if(!drag||drag.pointerId!==e.pointerId)return;
  if(drag.id){
    const p=point(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    drag.moved=drag.moved||Math.hypot(dx,dy)>3;
    if(drag.moved)markGestureMoved();
    positions[drag.id].x=drag.p.x+dx;positions[drag.id].y=drag.p.y+dy;drawGeometry(positions);
  }else{
    if(!drag.moved&&Math.hypot(e.clientX-drag.startClient.x,e.clientY-drag.startClient.y)<6)return;
    drag.moved=true;markGestureMoved();
    const dx=e.clientX-drag.startClient.x,dy=e.clientY-drag.startClient.y,baseline=drag.startBox;
    queueGestureCamera([baseline[0]-dx*drag.units.x,baseline[1]-dy*drag.units.y,baseline[2],baseline[3]]);
  }
});
function endDrag(e){
  // Capture transfers emit a bubbling loss event on the previous SVG child.
  // Only terminate when the canvas itself genuinely loses this pointer.
  if(e.type==='lostpointercapture'&&(e.target!==$('#canvas')||$('#canvas').hasPointerCapture(e.pointerId)))return;
  if(!gesturePointers.has(e.pointerId))return;
  flushGestureCamera();
  if(drag?.id&&drag.moved){
    saved[drag.id]={x:positions[drag.id].x,y:positions[drag.id].y};
    cached.set(stateKey(),structuredClone(positions));
    try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}
  }
  gesturePointers.delete(e.pointerId);pinch=null;drag=null;
  if($('#canvas').hasPointerCapture(e.pointerId))$('#canvas').releasePointerCapture(e.pointerId);
  if(gesturePointers.size>=2)beginPinch();
  else if(gesturePointers.size){
    const [id,p]=[...gesturePointers.entries()][0];
    drag=panStart(id,p,gestureMoved);
  }else{
    $('#canvasWrap').classList.remove('is-dragging');
    // Capture-phase click handling consumes the synthetic click after a drag.
    // Expire the guard for browsers that do not emit one.
    if(gestureMoved){suppressClick=true;gestureResetTimer=setTimeout(()=>suppressClick=false,400);}
  }
}
listen($('#canvas'),'pointerup',endDrag);
listen($('#canvas'),'pointercancel',endDrag);
listen($('#canvas'),'lostpointercapture',endDrag);
listen($('#canvas'),'click',e=>{
  if(!suppressClick)return;
  e.preventDefault();e.stopImmediatePropagation();
},true);
function activate(target){const collapse=target.closest('[data-collapse]'),n=target.closest('.node'),edge=target.closest('.edge'),segment=target.closest('.wire-segment'),caption=target.closest('[data-caption]');if(collapse)toggle(collapse.dataset.collapse);else if(n){if(model.upperBy.has(n.dataset.node))toggle(n.dataset.node);else showNode(n.dataset.node);}else if(caption)showWireRelations(inlineCaptions.find(c=>c.id===caption.dataset.caption).keys);else if(segment)showSegment(segment.dataset.segment);else if(edge)showEdge(edge.dataset.edge);else{highlight();overview();}}
listen($('#canvas'),'click',e=>{if(e.shiftKey||suppressClick||e.target.closest('.node-entry-link'))return;activate(e.target);});
// Geometric hover covers the full concept without inserting a hit surface over node, wire or pan controls.
listen($('#canvas'),'pointermove',e=>{
  if(drag||e.pointerType==='touch')return;const title=e.target.closest('.concept-title'),border=e.target.closest('.range-border-hit');
  let id=(title||border)?.dataset.collapse;
  if(!id){const p=point(e),region=rangePlan.regions.find(r=>r.fragments.some(f=>p.x>=f.x&&p.x<=f.x+f.w&&p.y>=f.y&&p.y<=f.y+f.h));id=region?.id||null;}
  if(id!==hoverConcept)focusConcept(id);
});
listen($('#canvas'),'pointerleave',()=>{if(!drag)focusConcept(null);});
listen($('#canvas'),'focusin',e=>{const control=e.target.closest('.concept-title,.range-border-hit');if(control)focusConcept(control.dataset.collapse);});
listen($('#canvas'),'focusout',e=>{if(e.target.closest('.concept-title,.range-border-hit')&&!e.target.contains(e.relatedTarget))focusConcept(null);});
listen($('#canvas'),'keydown',e=>{if(e.target.closest('.node-entry-link'))return;if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e.target);}});
$('#plus').onclick=()=>zoom(.8);$('#minus').onclick=()=>zoom(1.25);
$('#expandAll').onclick=()=>{
  if(transitioning)return;
  if(expandableIds.every(id=>expanded.has(id))){expanded.clear();render({previous:history.get('')});}
  else{history.set(stateKey(),{box:[...box]});expandableIds.forEach(id=>expanded.add(id));render();}
};
listen(window,'keydown',e=>{if(e.key==='Escape'){hideExplanation();highlight();overview();$('#search').value='';}});

listen($('#search'),'input',()=>{
  const query=$('#search').value.trim().toLocaleLowerCase();
  if(!query){highlight();overview();return;}
  const ids=scene.nodes.filter(n=>n.name.toLocaleLowerCase().includes(query)).map(n=>n.id);
  highlight(ids);$('#sceneStatus').textContent=tr('当前画布找到 {count} 个节点',{count:ids.length});
});
listen($('#search'),'keydown',e=>{
  if(e.key!=='Enter')return;e.preventDefault();
  const query=$('#search').value.trim().toLocaleLowerCase();if(!query)return;
  const visible=scene.nodes.find(n=>n.name.toLocaleLowerCase().includes(query));
  if(visible){showNode(visible.id);focus([visible.id]);return;}
  const lower=data.graphs.L2.nodes.find(n=>n.name.toLocaleLowerCase().includes(query));
  const owner=lower&&model.owners.get(lower.id).find(id=>!expanded.has(id));
  if(owner){toggle(owner);showNode(lower.id);focus([lower.id]);}
  else $('#sceneStatus').textContent=tr('没有找到匹配节点');
});


window.SemanticPreview={snapshot:()=>({expanded:[...expanded],box:[...box],search:$('#search').value}),model,expanded,get transitioning(){return transitioning;},get captionPending(){return captionTask!==null;},get captionError(){return captionError;},get captionElapsedMs(){return captionElapsedMs;},get scene(){return scene;},get positions(){return positions;},get routing(){return routingPlan;},get ranges(){return rangePlan;},get captions(){return inlineCaptions;},get captionModel(){return captionModel;},toggle,fit};
const focusPath=ExtractRuntime.parameters().get('focus_path');
const focusNodes=focusPath?data.graphs.L2.nodes.filter(n=>{const path=n.file||n.folder;return path===focusPath||path?.startsWith(focusPath+'/')||n.folder&&focusPath.startsWith(n.folder+'/');}).map(n=>n.id):[];
if(!B.restore)for(const id of focusNodes)expanded.add(model.layoutHints.stable_positions.nodes[id].owner);
for(const id of B.restore?.expanded||[])if(expandableIds.includes(id))expanded.add(id);
render({initial:true});
if(B.restore){if(Array.isArray(B.restore.box)&&B.restore.box.length===4&&B.restore.box.every(Number.isFinite))setBox(B.restore.box);$('#search').value=B.restore.search||'';}
preserveRestoredView=false;
if(focusNodes.length&&!B.restore){highlight(focusNodes);$('#sceneStatus').textContent=tr('当前路径在目录图中的对应文件');}

window.ExtractViewerDispose=()=>{
  lifetime.abort();cancelCaptionTask();clearTimeout(gestureResetTimer);
  if(cameraFrame!==null)cancelAnimationFrame(cameraFrame);
  cameraFrame=null;pendingCameraBox=null;
  for(const id of gesturePointers.keys())if($('#canvas').hasPointerCapture(id))$('#canvas').releasePointerCapture(id);
  gesturePointers.clear();pinch=null;drag=null;
  explanation.remove();root.remove();$('#canvasWrap').classList.remove('is-dragging','has-concept-focus');
};
};
