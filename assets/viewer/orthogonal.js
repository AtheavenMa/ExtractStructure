/* 目的和主要功能：为 ExtractStructure 连线安排转折、共用线段和文字位置。
 * 适用范围：目录图和文件图中当前可见节点的连线绘制。
 */
'use strict';
function planOrthogonalGraph(edges, positions, labelSizes, extraObstacles=[]) {
  const entries=Object.entries(positions),W=230,H=72,PAD=12,LEAD=24;
  const obstacles=entries.map(([id,p])=>({id,x:p.x-PAD,y:p.y-PAD,w:W+2*PAD,h:H+2*PAD}));
  const nodeBoxes=entries.map(([id,p])=>({id,x:p.x,y:p.y,w:W,h:H}));
  obstacles.push(...extraObstacles.map((b,i)=>({...b,id:'control:'+i})));
  const ports=new Map(),sideGroups=new Map();
  const minY=Math.min(...entries.map(([,p])=>p.y)),maxY=Math.max(...entries.map(([,p])=>p.y+H));
  const minX=Math.min(...entries.map(([,p])=>p.x)),maxX=Math.max(...entries.map(([,p])=>p.x+W));
  function addPort(e,which,side){const id=e[which],other=positions[e[which==='from'?'to':'from']];const key=id+':'+side;if(!sideGroups.has(key))sideGroups.set(key,[]);sideGroups.get(key).push({key:e.key,which,side,id,sort:side==='top'||side==='bottom'?other.x:other.y});}
  for(const e of edges){
    const a=positions[e.from],b=positions[e.to];let from,to;
    if(e.from===e.to){from='right';to='bottom';}
    else if(e.feedback){from='top';to='top';}
    else if(b.x>=a.x+W+40){from='right';to='left';}
    else if(b.y>=a.y+H+40){from='bottom';to='top';}
    else if(b.x>a.x){from='right';to='left';}
    else{from='bottom';to='top';}
    addPort(e,'from',from);addPort(e,'to',to);
  }
  for(const group of sideGroups.values()){
    for(const port of group){const p=positions[port.id],horizontal=port.side==='top'||port.side==='bottom';
      const x=p.x+(horizontal?W/2:port.side==='left'?0:W),y=p.y+(horizontal?(port.side==='top'?0:H):H/2);
      const escape={x:x+(port.side==='left'?-LEAD:port.side==='right'?LEAD:0),y:y+(port.side==='top'?-LEAD:port.side==='bottom'?LEAD:0)};
      if(!ports.has(port.key))ports.set(port.key,{});ports.get(port.key)[port.which]={x,y,escape,side:port.side};
    }
  }
  const incoming=new Map();for(const e of edges){if(e.from===e.to||e.bidirectional||e.feedback)continue;if(!incoming.has(e.to))incoming.set(e.to,[]);incoming.get(e.to).push(e);}
  const busPlans=new Map(),edgeBus=new Map();
  function clearLine(a,b,ignoreId=null){return !obstacles.some(box=>box.id!==ignoreId&&hitBox(a,b,box));}
  for(const[target,members]of incoming){if(members.length<3)continue;
    const b=positions[target],sources=members.map(e=>positions[e.from]);
    const horizontal=sources.every(a=>b.y>a.y+H+65);
    if(!horizontal&&!sources.every(a=>b.x>a.x+W+80))continue;
    const plan={target,keys:members.map(e=>e.key),horizontal,taps:new Map()};
    if(horizontal){
      const lo=Math.min(b.x+W/2,...sources.map(a=>a.x+W/2)),hi=Math.max(b.x+W/2,...sources.map(a=>a.x+W/2));
      const preferred=b.y-65,candidates=[preferred,...Array.from({length:12},(_,i)=>preferred-i*20)];
      const y=candidates.find(y=>y>Math.max(...sources.map(a=>a.y+H))+25&&clearLine({x:lo,y},{x:hi,y}));if(y===undefined)continue;
      plan.axis=y;plan.root={x:b.x+W/2,y};plan.end={x:b.x+W/2,y:b.y};
      for(const e of members)plan.taps.set(e.key,{x:positions[e.from].x+W/2,y});
    }else{
      const xCandidates=[b.x-65,b.x-90,b.x-115,b.x-140];let chosen=null;
      for(const x of xCandidates){const taps=new Map();let valid=true;
        for(const e of members){const a=positions[e.from];let tap;
          const preferred=a.y+H/2,candidates=[preferred,a.y+H+65,a.y+H+110,a.y+H+40,a.y-55,...sources.map(p=>p.y+H+45),...sources.map(p=>p.y-45)];
          for(const y of candidates){if(clearLine({x:a.x+W+45,y},{x,y})){tap={x,y};break;}}
          if(!tap){valid=false;break;}taps.set(e.key,tap);
        }
        if(!valid)continue;const ys=[b.y+H/2,...taps.values()].map(v=>typeof v==='number'?v:v.y);
        if(clearLine({x,y:Math.min(...ys)},{x,y:Math.max(...ys)})){chosen={x,taps};break;}
      }
      if(!chosen)continue;plan.axis=chosen.x;plan.taps=chosen.taps;plan.root={x:chosen.x,y:b.y+H/2};plan.end={x:b.x,y:b.y+H/2};
    }
    if(!clearLine(plan.root,plan.end,target))continue;
    for(const e of members){const a=positions[e.from],from=horizontal?{x:a.x+W/2,y:a.y+H,escape:{x:a.x+W/2,y:a.y+H+LEAD},side:'bottom'}:{x:a.x+W,y:a.y+H/2,escape:{x:a.x+W+LEAD,y:a.y+H/2},side:'right'};ports.set(e.key,{from,to:{...plan.end,escape:plan.root,side:horizontal?'top':'left'}});edgeBus.set(e.key,plan);}
    busPlans.set(target,plan);
  }
  const xs=new Set(),ys=new Set();const put=(set,n)=>set.add(Math.round(n*1000)/1000);
  // Shared grid has distinct tracks in each corridor; port coordinates stay exact.
  for(const[,p]of entries){[p.x-LEAD,p.x+W+LEAD,p.x-12,p.x+W+12].forEach(x=>put(xs,x));[p.y-LEAD,p.y+H+LEAD,p.y-12,p.y+H+12].forEach(y=>put(ys,y));}
  for(const pair of ports.values())for(const p of Object.values(pair)){put(xs,p.escape.x);put(ys,p.escape.y);if(p.side==='left'||p.side==='right'){put(ys,p.escape.y-8);put(ys,p.escape.y+8);}else{put(xs,p.escape.x-8);put(xs,p.escape.x+8);}}
  for(const plan of busPlans.values()){put(xs,plan.root.x);put(ys,plan.root.y);for(const tap of plan.taps.values()){put(xs,tap.x);put(ys,tap.y);}}
  const columns=[...new Set(entries.map(([,p])=>p.x))].sort((a,b)=>a-b);
  for(let i=1;i<columns.length;i++)for(let x=columns[i-1]+W+40;x<columns[i]-24;x+=20)put(xs,x);
  const rows=[...new Set(entries.map(([,p])=>p.y))].sort((a,b)=>a-b);
  for(let i=1;i<rows.length;i++)for(let y=rows[i-1]+H+40;y<rows[i]-24;y+=22)put(ys,y);
  for(let i=0;i<Math.max(10,edges.length);i++){put(ys,minY-90-i*22);put(ys,maxY+70+i*22);}
  for(let i=0;i<8;i++){put(xs,minX-55-i*22);put(xs,maxX+55+i*22);}
  const X=[...xs].sort((a,b)=>a-b),Y=[...ys].sort((a,b)=>a-b),nx=X.length,ny=Y.length,total=nx*ny;
  const xi=new Map(X.map((x,i)=>[x,i])),yi=new Map(Y.map((y,i)=>[y,i]));
  const blocked=new Uint8Array(total);
  const inside=(x,y,b)=>x>b.x+.01&&x<b.x+b.w-.01&&y>b.y+.01&&y<b.y+b.h-.01;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(obstacles.some(b=>inside(X[x],Y[y],b)))blocked[y*nx+x]=1;
  const visibleCache=new Map(),reserved=new Set(),visits=new Uint8Array(total),allSegments=[],labelBoxes=[];
  const labelObstacles=[...nodeBoxes.map(b=>({...b,x:b.x-7,y:b.y-7,w:b.w+14,h:b.h+14})),...extraObstacles];
  for(const pair of ports.values())for(const p of Object.values(pair))labelObstacles.push({x:p.escape.x-7,y:p.escape.y-7,w:14,h:14});
  function hitBox(a,b,box){if(a.x===b.x)return a.x>box.x+.01&&a.x<box.x+box.w-.01&&Math.max(a.y,b.y)>box.y+.01&&Math.min(a.y,b.y)<box.y+box.h-.01;return a.y>box.y+.01&&a.y<box.y+box.h-.01&&Math.max(a.x,b.x)>box.x+.01&&Math.min(a.x,b.x)<box.x+box.w-.01;}
  const gridPoint=i=>({x:X[i%nx],y:Y[Math.floor(i/nx)]});
  const segKey=(a,b)=>a<b?a+':'+b:b+':'+a;
  function allowed(a,b){const key=segKey(a,b);if(!visibleCache.has(key))visibleCache.set(key,!obstacles.some(box=>hitBox(gridPoint(a),gridPoint(b),box)));return visibleCache.get(key);}
  class Heap{constructor(){this.items=[];}push(item){let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.items[p].f<=item.f)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].f<this.items[c].f)c++;if(this.items[c].f>=last.f)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}get length(){return this.items.length;}}
  function findPath(start,end,preferOuter){
    const sx=xi.get(Math.round(start.x*1000)/1000),sy=yi.get(Math.round(start.y*1000)/1000),tx=xi.get(Math.round(end.x*1000)/1000),ty=yi.get(Math.round(end.y*1000)/1000);
    const begin=sy*nx+sx,target=ty*nx+tx;const dist=new Float64Array(total*3);dist.fill(Infinity);const previous=new Int32Array(total*3);previous.fill(-1);const heap=new Heap();
    const heuristic=i=>Math.abs(X[i%nx]-end.x)+Math.abs(Y[Math.floor(i/nx)]-end.y);
    const first=begin*3;dist[first]=0;heap.push({s:first,g:0,f:heuristic(begin)});let found=-1;
    while(heap.length){const current=heap.pop();if(current.g!==dist[current.s])continue;const cell=Math.floor(current.s/3),direction=current.s%3;if(cell===target){found=current.s;break;}const x=cell%nx,y=Math.floor(cell/nx);
      for(const[xx,yy,dir]of [[x-1,y,1],[x+1,y,1],[x,y-1,2],[x,y+1,2]]){
        if(xx<0||xx>=nx||yy<0||yy>=ny)continue;const next=yy*nx+xx;if(blocked[next]||!allowed(cell,next))continue;
        if(labelBoxes.some(box=>hitBox(gridPoint(cell),gridPoint(next),box)))continue;
        const point=gridPoint(next);const step=Math.abs(X[x]-X[xx])+Math.abs(Y[y]-Y[yy]);
        const internal=preferOuter&&point.y>minY-30&&point.y<maxY+30?step*.25:0;
        const cost=current.g+step+(direction&&direction!==dir?210:0)+internal;
        const state=next*3+dir;if(cost>=dist[state])continue;dist[state]=cost;previous[state]=current.s;heap.push({s:state,g:cost,f:cost+heuristic(next)});
      }
    }
    if(found<0)return null;const cells=[];for(let s=found;s>=0;s=previous[s])cells.push(Math.floor(s/3));cells.reverse();for(let i=1;i<cells.length;i++)reserved.add(segKey(cells[i-1],cells[i]));for(const cell of cells)visits[cell]++;
    return cells.map(gridPoint);
  }
  function simplify(points){const result=[];for(const p of points){if(result.length&&p.x===result.at(-1).x&&p.y===result.at(-1).y)continue;while(result.length>1){const a=result.at(-2),b=result.at(-1);if((a.x===b.x&&b.x===p.x&&(b.y-a.y)*(p.y-b.y)>=0)||(a.y===b.y&&b.y===p.y&&(b.x-a.x)*(p.x-b.x)>=0))result.pop();else break;}result.push(p);}return result;}
  const routes=new Map();const priority=e=>{const a=positions[e.from],b=positions[e.to];return(b.role==='failure'?3:b.x<=a.x?2:Math.abs(a.y-b.y)>40?1:0);};
  const ordered=[...edges].sort((a,b)=>priority(a)-priority(b)||Math.abs(positions[a.to].x-positions[a.from].x)-Math.abs(positions[b.to].x-positions[b.from].x)||a.key.localeCompare(b.key));
  const failed=[];
  function directPath(start,end,feedback=false){
    if(feedback){for(let i=0;i<edges.length+4;i++){const y=minY-90-i*22,path=simplify([start,{x:start.x,y},{x:end.x,y},end]);if(path.every((p,j)=>!j||clearLine(path[j-1],p)))return path;}return findPath(start,end,true);}
    const candidates=[[start,end],[start,{x:end.x,y:start.y},end],[start,{x:start.x,y:end.y},end]];
    const xOptions=[start.x+45,start.x-45,(start.x+end.x)/2,end.x-45,end.x+45,minX-55,maxX+55];
    const yOptions=[start.y+65,start.y-65,(start.y+end.y)/2,end.y-65,end.y+65,minY-70,maxY+70];
    for(const x of xOptions)candidates.push([start,{x,y:start.y},{x,y:end.y},end]);
    for(const y of yOptions)candidates.push([start,{x:start.x,y},{x:end.x,y},end]);
    const valid=candidates.map(simplify).filter(points=>points.every((p,i)=>!i||(p.x===points[i-1].x||p.y===points[i-1].y)&&clearLine(points[i-1],p)));
    valid.sort((a,b)=>(a.length-b.length)*240+a.reduce((n,p,i)=>n+(i?Math.abs(p.x-a[i-1].x)+Math.abs(p.y-a[i-1].y):0),0)-b.reduce((n,p,i)=>n+(i?Math.abs(p.x-b[i-1].x)+Math.abs(p.y-b[i-1].y):0),0));
    return valid[0]||findPath(start,end,false);
  }
  for(const edge of ordered){
    const p=ports.get(edge.key),bus=edgeBus.get(edge.key);let points;
    if(bus){const tap=bus.taps.get(edge.key),a=positions[edge.from];let branch;
      if(bus.horizontal){branch=[{x:p.from.x,y:p.from.y},tap];}
      else{const x=a.x+W+45;branch=[{x:p.from.x,y:p.from.y},{x,y:p.from.y},{x,y:tap.y},tap];}
      if(!branch.every((point,i)=>!i||clearLine(branch[i-1],point,edge.from))){const middle=directPath(p.from.escape,tap);branch=middle?[{x:p.from.x,y:p.from.y},...middle]:null;}
      if(branch)points=simplify([...branch,bus.root,bus.end]);
    }else{
      const internal=directPath(p.from.escape,p.to.escape,edge.feedback||edge.from===edge.to);
      if(internal)points=simplify([{x:p.from.x,y:p.from.y},...internal,{x:p.to.x,y:p.to.y}]);
    }
    if(!points){failed.push(edge.key);const y=maxY+100+failed.length*35;points=simplify([{x:p.from.x,y:p.from.y},p.from.escape,{x:p.from.escape.x,y},{x:p.to.escape.x,y},p.to.escape,{x:p.to.x,y:p.to.y}]);}
    const route={points,ports:p,bus:bus?.target,path:'M'+points.map(p=>p.x+','+p.y).join(' L')};routes.set(edge.key,route);
    for(let i=1;i<points.length;i++)allSegments.push({a:points[i-1],b:points[i],key:edge.key});
  }
  const segments=atomizeWireSegments(routes,edges);
  return {routes,ports,buses:busPlans,segments,fallbacks:failed,labelBoxes,obstacles:nodeBoxes};
}
function atomizeWireSegments(routes,edges){
  const groups=new Map(),raw=[];const round=n=>Math.round(n*1000)/1000;
  for(const[key,r]of routes)for(let i=1;i<r.points.length;i++){
    const a=r.points[i-1],b=r.points[i];if(a.x===b.x&&a.y===b.y)continue;
    const horizontal=a.y===b.y,fixed=round(horizontal?a.y:a.x),lo=round(horizontal?Math.min(a.x,b.x):Math.min(a.y,b.y)),hi=round(horizontal?Math.max(a.x,b.x):Math.max(a.y,b.y));
    const id=(horizontal?'h:':'v:')+fixed;if(!groups.has(id))groups.set(id,{horizontal,fixed,raw:[],cuts:new Set()});const group=groups.get(id);group.raw.push({key,lo,hi});group.cuts.add(lo);group.cuts.add(hi);raw.push({horizontal,fixed,lo,hi});
  }
  for(const group of groups.values())for(const other of raw)if(group.horizontal!==other.horizontal&&other.lo<=group.fixed&&other.hi>=group.fixed){if(group.raw.some(s=>other.fixed>=s.lo&&other.fixed<=s.hi))group.cuts.add(other.fixed);}
  const segments=[];
  for(const group of groups.values()){
    const cuts=[...group.cuts].sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++){const lo=cuts[i-1],hi=cuts[i];if(hi-lo<.01)continue;const mid=(lo+hi)/2,keys=[...new Set(group.raw.filter(s=>s.lo<=mid&&s.hi>=mid).map(s=>s.key))].sort();if(!keys.length)continue;
      const a=group.horizontal?{x:lo,y:group.fixed}:{x:group.fixed,y:lo},b=group.horizontal?{x:hi,y:group.fixed}:{x:group.fixed,y:hi};
      const refs=[],seen=new Set();for(const key of keys)for(const ref of edges.find(e=>e.key===key).refs){const id=ref.level+':'+ref.index;if(!seen.has(id)){refs.push(ref);seen.add(id);}}
      segments.push({id:'wire-'+segments.length,a,b,keys,refs,path:`M${a.x},${a.y} L${b.x},${b.y}`,arrowStart:false,arrowEnd:false});
    }
  }
  for(const e of edges){const points=routes.get(e.key).points,ends=[points.at(-1),...(e.bidirectional?[points[0]]:[])];
    for(const tip of ends)for(const segment of segments){if(!segment.keys.includes(e.key))continue;if(Math.abs(segment.a.x-tip.x)<.001&&Math.abs(segment.a.y-tip.y)<.001)segment.arrowStart=true;if(Math.abs(segment.b.x-tip.x)<.001&&Math.abs(segment.b.y-tip.y)<.001)segment.arrowEnd=true;}
  }
  return segments;
}
window.planOrthogonalGraph=planOrthogonalGraph;
