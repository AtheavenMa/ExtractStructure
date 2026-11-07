/* 目的和主要功能：保留 L2 组内排列，并按当前展开范围紧凑排列功能块。
 * 适用范围：目录图和文件图的展开、收起及拖动后的布局；全部展开使用原始 L2 坐标。
 */
'use strict';
function compactExpansionLayout(scene,model,layouts,saved={},context={}){
  const W=230,H=72,DX=380,DY=170,GAP=150,positions={};
  // Canonical coordinates define the complete L2 view and explicit fixed mode.
  const skeleton=model.layoutHints.stable_positions;
  if(skeleton){
    if(model.layoutHints.collapse_layout!=='fixed'&&!scene.all)return compactSkeletonBlocks(scene,model,layouts,saved);
    const visibleLower=new Set(scene.nodes.filter(n=>n.level==='L2').map(n=>n.id));
    for(const n of scene.nodes){const representative=skeleton.representatives?.[n.id],dock=n.level==='L1'&&visibleLower.has(representative)?skeleton.docks?.[n.id]:null;
      const fixed=dock||(n.level==='L1'?skeleton.anchors:skeleton.nodes)[n.id];
      if(!fixed)throw new Error('固定布局缺少节点：'+n.id);
      positions[n.id]={...layouts[n.level].nodes[n.id],...fixed,width:W,height:H,...saved[n.id]};
    }
    return positions;
  }

  const upper=[...model.upperBy.keys()],order=new Map(upper.map((id,i)=>[id,i]));
  function sortedGraph(ids,links,compare){
    const indegree=new Map(ids.map(id=>[id,0])),out=new Map(ids.map(id=>[id,new Set()]));
    for(const[a,b]of links)if(a!==b&&out.has(a)&&out.has(b)&&!out.get(a).has(b)){out.get(a).add(b);indegree.set(b,indegree.get(b)+1);}
    const ready=ids.filter(id=>!indegree.get(id)).sort(compare),result=[],remaining=new Set(ids);
    while(remaining.size){
      // Compressed mixed graphs can contain cycles. Keep them explicit rather than invent feedback.
      const id=ready.shift()||[...remaining].sort(compare)[0];if(!remaining.delete(id))continue;result.push(id);
      for(const to of out.get(id)){indegree.set(to,indegree.get(to)-1);if(!indegree.get(to)&&remaining.has(to)){ready.push(to);ready.sort(compare);}}
    }
    return result;
  }
  const upperLinks=model.upperEdges.map(e=>[e.from,e.to]);
  const groups=sortedGraph(upper,upperLinks,(a,b)=>order.get(a)-order.get(b));
  const groupIndex=new Map(groups.map((id,i)=>[id,i])),visible=new Set(scene.nodes.map(n=>n.id));
  const forward=scene.edges.flatMap(e=>e.members.filter(m=>!model.isFeedback(m.ref)).map(m=>[m.from,m.to])).filter(([a,b])=>a!==b);
  const primary=new Map(),blocks=new Map(groups.map(id=>[id,[]]));
  for(const n of scene.nodes){
    if(n.level==='L1'){primary.set(n.id,n.id);blocks.get(n.id).push(n);continue;}
    const candidates=model.owners.get(n.id).filter(id=>!visible.has(id)),preferred=model.layoutHints.primary_owners?.[n.id];
    const owner=candidates.includes(preferred)?preferred:candidates.sort((a,b)=>groupIndex.get(a)-groupIndex.get(b))[0];
    const id=owner||'unmapped';if(!blocks.has(id))blocks.set(id,[]);primary.set(n.id,id);blocks.get(id).push(n);
  }
  const blockOrder=[...groups,...(blocks.has('unmapped')?['unmapped']:[])].filter(id=>blocks.get(id).length);
  const plans=[];
  for(const owner of blockOrder){
    const nodes=blocks.get(owner),ids=nodes.map(n=>n.id),idset=new Set(ids);
    const hint=id=>layouts[model.upperBy.has(id)?'L1':'L2'].nodes[id]||{};
    const compare=(a,b)=>(hint(a).column||0)-(hint(b).column||0)||(hint(a).lane||0)-(hint(b).lane||0)||ids.indexOf(a)-ids.indexOf(b);
    const sequence=sortedGraph(ids,forward.filter(([a,b])=>idset.has(a)&&idset.has(b)),compare);
    const columns=sequence.length>1?2:1;
    const offsets=new Map(sequence.map((id,i)=>[id,{x:(i%columns)*DX,y:Math.floor(i/columns)*DY}]));
    plans.push({owner,nodes,offsets,w:(columns-1)*DX+W,h:(Math.ceil(sequence.length/columns)-1)*DY+H});
  }
  // Related concepts may have an authored row order when their collaborations interleave.
  const custom=model.layoutHints.concept_rows;
  const rows=custom?custom.map(row=>row.map(id=>plans.find(b=>b.owner===id)).filter(Boolean)):Array.from({length:Math.ceil(plans.length/2)},(_,i)=>plans.slice(i*2,i*2+2));
  for(const b of plans)if(!rows.some(row=>row.includes(b)))rows.push([b]);
  const colWidths=[];for(const row of rows)row.forEach((b,i)=>colWidths[i]=Math.max(colWidths[i]||0,b.w));
  let y=0;
  for(const row of rows){if(!row.length)continue;let x=0;
    for(let i=0;i<row.length;i++){const b=row[i];for(const n of b.nodes){const p=b.offsets.get(n.id),hint=layouts[n.level].nodes[n.id]||{};positions[n.id]={...hint,x:x+p.x,y:y+p.y,width:W,height:H,owner:b.owner};}x+=colWidths[i]+GAP;}
    y+=Math.max(...row.map(b=>b.h))+210;
  }
  // Align the opened concept with the card the reader clicked, keeping its spatial origin.
  const anchor=context.anchor,previous=context.previous||{};
  let shiftX=0,shiftY=0;
  if(anchor&&previous[anchor]){
    const own=plans.find(b=>b.owner===anchor),first=own&&positions[own.nodes.find(n=>!previous[n.id])?.id||own.nodes[0].id];
    if(first){shiftX=previous[anchor].x-first.x;shiftY=previous[anchor].y-first.y;}
  }
  for(const p of Object.values(positions)){p.x+=shiftX;p.y+=shiftY;}
  if(anchor&&previous[anchor]){
    // Reuse the reader's existing scene; create room only around the newly opened block.
    for(const[id,p]of Object.entries(previous))if(positions[id]){positions[id].x=p.x;positions[id].y=p.y;}
    const fresh=Object.entries(positions).filter(([id,p])=>p.owner===anchor&&!previous[id]).map(([,p])=>p);
    if(fresh.length){
      const area={x:Math.min(...fresh.map(p=>p.x))-35,y:Math.min(...fresh.map(p=>p.y))-85,right:Math.max(...fresh.map(p=>p.x+W))+35,bottom:Math.max(...fresh.map(p=>p.y+H))+35};
      for(const block of plans)if(block.owner!==anchor){
        const existing=block.nodes.filter(n=>previous[n.id]&&!saved[n.id]).map(n=>positions[n.id]);
        if(existing.some(p=>p.x<area.right&&p.x+W>area.x&&p.y<area.bottom&&p.y+H>area.y)){
          const delta=area.right+GAP-Math.min(...existing.map(p=>p.x));for(const p of existing)p.x+=delta;
        }
      }
    }
  }
  for(const[id,p]of Object.entries(saved))if(positions[id])Object.assign(positions[id],p);
  const ids=scene.nodes.map(n=>n.id),rank=sortedGraph(ids,forward,(a,b)=>{
    const aa=positions[a],bb=positions[b];return aa.y-bb.y||aa.x-bb.x||ids.indexOf(a)-ids.indexOf(b);
  });
  const incoming=new Map(ids.map(id=>[id,[]]));for(const[a,b]of forward)incoming.get(b)?.push(a);
  const placed=ids.filter(id=>saved[id]);
  for(const id of rank){
    const p=positions[id];
    if(!saved[id]){
      for(const from of incoming.get(id))if(placed.includes(from)){
        const a=positions[from];if(primary.get(from)===primary.get(id))p.y=Math.max(p.y,a.y);if(p.x<a.x+W+55)p.y=Math.max(p.y,a.y+H+100);
      }
      let collision;
      do{collision=placed.map(n=>positions[n]).find(q=>Math.abs(p.x-q.x)<W+45&&Math.abs(p.y-q.y)<H+85);if(collision)p.y=collision.y+H+100;}while(collision);
    }
    if(!placed.includes(id))placed.push(id);
  }
  return positions;
}
function compactSkeletonBlocks(scene,model,layouts,saved){
  const W=230,H=72,skeleton=model.layoutHints.stable_positions;
  const groups=[...model.upperBy.keys()];
  const blocks=new Map();
  for(const node of scene.nodes){
    const owner=node.level==='L1'?node.id:skeleton.nodes[node.id].owner;
    if(!blocks.has(owner))blocks.set(owner,[]);
    const p=node.level==='L1'?skeleton.anchors[node.id]:skeleton.nodes[node.id];
    blocks.get(owner).push({node,p});
  }
  const plans=[...blocks].map(([owner,members])=>{
    const index=groups.indexOf(owner),expanded=members.length>1&&members.every(m=>m.node.level==='L2');
    const minX=Math.min(...members.map(m=>m.p.x)),minY=Math.min(...members.map(m=>m.p.y));
    const maxX=Math.max(...members.map(m=>m.p.x+W)),maxY=Math.max(...members.map(m=>m.p.y+H));
    // Reserve actual group borders and headings, rather than hidden members.
    const side=expanded?24+index*5:0,top=expanded?100+index*5:0,bottom=side;
    const title=expanded?Math.min(360,Math.max(140,[...model.upperBy.get(owner).name].reduce((n,c)=>n+(c.charCodeAt(0)<128?8:16),0)+48))+24:0;
    return {owner,members,minX,minY,side,top,w:Math.max(maxX-minX+side*2,title),h:maxY-minY+top+bottom};
  }).sort((a,b)=>{
    const x=skeleton.anchors[a.owner],y=skeleton.anchors[b.owner];
    return x.y-y.y||x.x-y.x||groups.indexOf(a.owner)-groups.indexOf(b.owner);
  });
  const gapX=110,gapY=100,total=plans.reduce((n,b)=>n+b.w*b.h,0);
  const minimum=Math.max(...plans.map(b=>b.w)),maximum=plans.reduce((n,b)=>n+b.w+gapX,0);
  let best=null;
  for(let target=minimum;target<=maximum;target+=40){
    let x=0,y=0,rowHeight=0,width=0;const slots=new Map();
    for(const block of plans){
      if(x&&x+block.w>target){y+=rowHeight+gapY;x=0;rowHeight=0;}
      slots.set(block.owner,{x,y});width=Math.max(width,x+block.w);
      x+=block.w+gapX;rowHeight=Math.max(rowHeight,block.h);
    }
    const height=y+rowHeight,score=Math.abs(Math.log(width/height))+.2*width*height/total;
    if(!best||score<best.score)best={score,slots};
  }
  const positions={};
  for(const block of plans){
    const origin=best.slots.get(block.owner);
    for(const {node,p}of block.members)positions[node.id]={...layouts[node.level].nodes[node.id],...p,x:origin.x+block.side+p.x-block.minX,y:origin.y+block.top+p.y-block.minY,width:W,height:H,owner:block.owner,...saved[node.id]};
  }
  return positions;
}
window.compactExpansionLayout=compactExpansionLayout;
