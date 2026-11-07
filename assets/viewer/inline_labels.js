/* 目的和主要功能：按实际关系成员选择有语义依据的短摘要，并将支路和汇流段的说明直接排在图上。
 * 适用范围：Skill 的交互画布；原始语义 JSON 为依据，展示摘要由各文件的布局提示提供。
 */
'use strict';
function wrapCaptionText(text,limit=12){
  const rows=[];let line='',count=0;
  const push=()=>{if(line){rows.push(line);line='';count=0;}};
  for(const token of String(text).match(/[A-Za-z0-9]+|[^\n]|\n/gu)||[]){
    if(token==='\n'){push();continue;}
    const size=[...token].reduce((n,c)=>n+(c.charCodeAt(0)<128?.55:1),0);
    const parts=size>limit?[...token]:[token];
    for(const part of parts){const w=[...part].reduce((n,c)=>n+(c.charCodeAt(0)<128?.55:1),0);if(count+w>limit&&line)push();line+=part;count+=w;}
  }
  push();return rows;
}
function buildInlineCaptions(scene,segments,data,presentation={}){
  const targets=presentation.shared_targets||{},sources=presentation.shared_sources||{},pairs=presentation.connection_pairs||{};
  const edgeBy=new Map(scene.edges.map(e=>[e.key,e]));
  const reviewed=new Map((presentation.relationship_summaries||[]).filter(s=>{const e=data.graphs[s.level]?.edges[s.index];return e&&e.from===s.from&&e.to===s.to;}).map(s=>[s.level+':'+s.index,s.text]));
  const refText=r=>reviewed.get(r.level+':'+r.index)||data.graphs[r.level].edges[r.index].label||data.graphs[r.level].edges[r.index].description;
  const unique=values=>[...new Set(values)];
  const raw=refs=>refs.map(r=>data.graphs[r.level].edges[r.index]);
  const same=values=>unique(values).length===1?values[0]:null;
  function connectionText(e){
    const originals=raw(e.refs),pairKeys=unique(originals.map(r=>[r.from,r.to].sort().join('|')));
    if(pairKeys.length===1&&pairs[pairKeys[0]])return pairs[pairKeys[0]];
    if(originals.length===1)return refText(e.refs[0]);
    const to=same(originals.map(r=>r.to)),from=same(originals.map(r=>r.from));
    if(to&&targets[to])return targets[to];if(from&&sources[from])return sources[from];
    if(targets[e.to])return targets[e.to];
    return unique(e.refs.map(refText)).join('；');
  }
  function summarize(keys){
    const edges=keys.map(key=>edgeBy.get(key));if(edges.length===1)return connectionText(edges[0]);
    const to=same(edges.map(e=>e.to)),from=same(edges.map(e=>e.from));
    if(to&&targets[to])return targets[to];if(from&&sources[from])return sources[from];
    const originals=edges.flatMap(e=>raw(e.refs)),rawTo=same(originals.map(r=>r.to)),rawFrom=same(originals.map(r=>r.from));
    if(rawTo&&targets[rawTo])return targets[rawTo];if(rawFrom&&sources[rawFrom])return sources[rawFrom];
    return unique(edges.map(connectionText)).join('；');
  }
  const groups=new Map();
  for(const segment of segments){const key=JSON.stringify(segment.keys);if(!groups.has(key))groups.set(key,{keys:segment.keys,candidates:[]});groups.get(key).candidates.push(segment);}
  const captions=[],covered=new Set(),groupByTarget=new Map();
  const length=s=>Math.abs(s.a.x-s.b.x)+Math.abs(s.a.y-s.b.y);
  // One common-action caption per convergence, on the segment with the fullest actual membership.
  for(const group of groups.values())if(group.keys.length>1){
    const target=same(group.keys.map(key=>edgeBy.get(key).to));if(!target)continue;
    const previous=groupByTarget.get(target);
    if(!previous||group.keys.length>previous.keys.length||group.keys.length===previous.keys.length&&Math.max(...group.candidates.map(length))>Math.max(...previous.candidates.map(length)))groupByTarget.set(target,group);
  }
  for(const[target,group]of groupByTarget){
    const commonText=summarize(group.keys);
    const branchTexts=unique(group.keys.map(key=>connectionText(edgeBy.get(key))));
    // A joined list repeats the branch labels; retain those labels on the branches.
    if(branchTexts.length>1&&commonText===branchTexts.join('；'))continue;
    // A tiny inlet cannot carry a bundle description. Keep its actual branch
    // descriptions instead; the shared wire still retains all clickable members.
    const spans=new Map();for(const s of group.candidates){const h=s.a.y===s.b.y,key=(h?'h:':'v:')+(h?s.a.y:s.a.x);if(!spans.has(key))spans.set(key,[]);spans.get(key).push([h?Math.min(s.a.x,s.b.x):Math.min(s.a.y,s.b.y),h?Math.max(s.a.x,s.b.x):Math.max(s.a.y,s.b.y)]);}
    let longest=0;for(const pieces of spans.values()){let start,end;for(const[lo,hi]of pieces.sort((a,b)=>a[0]-b[0])){if(end!==undefined&&lo<=end+.01)end=Math.max(end,hi);else{start=lo;end=hi;}longest=Math.max(longest,end-start);}}
    if(longest<72)continue;
    captions.push({id:'shared:'+target,keys:group.keys,text:commonText,candidates:group.candidates,shared:true});group.keys.forEach(key=>covered.add(key));}
  const repeated=new Map();for(const e of scene.edges){const key=e.to+'|'+connectionText(e);repeated.set(key,(repeated.get(key)||0)+1);}
  for(const e of scene.edges){
    const text=connectionText(e),individual=segments.filter(s=>s.keys.length===1&&s.keys[0]===e.key);
    if(covered.has(e.key)&&(!individual.length||repeated.get(e.to+'|'+text)>1||captions.some(c=>c.keys.includes(e.key)&&c.text===text)))continue;
    const candidates=segments.filter(s=>s.keys.includes(e.key));
    captions.push({id:'connection:'+e.key,keys:[e.key],text,candidates,shared:false});covered.add(e.key);
  }
  const individualCaptions=scene.edges.map(e=>({id:'connection:'+e.key,keys:[e.key],text:connectionText(e),candidates:segments.filter(s=>s.keys.includes(e.key)),shared:false}));
  return {captions,individualCaptions,summarize,connectionText};
}
function captionSpatialIndex(items,bounds,cellSize=160){
  const cells=new Map(),boxes=items.map(bounds),seen=new Uint32Array(items.length);let stamp=0;
  for(let id=0;id<items.length;id++){
    const b=boxes[id];
    for(let x=Math.floor(b.x/cellSize);x<=Math.floor((b.x+b.w)/cellSize);x++)for(let y=Math.floor(b.y/cellSize);y<=Math.floor((b.y+b.h)/cellSize);y++){
      const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);
    }
  }
  return {query(box){
    stamp=(stamp+1)>>>0;if(!stamp){seen.fill(0);stamp=1;}
    const found=[];
    for(let x=Math.floor(box.x/cellSize);x<=Math.floor((box.x+box.w)/cellSize);x++)for(let y=Math.floor(box.y/cellSize);y<=Math.floor((box.y+box.h)/cellSize);y++){
      for(const id of cells.get(x+':'+y)||[]){
        if(seen[id]===stamp)continue;seen[id]=stamp;const b=boxes[id];
        if(b.x>box.x+box.w||b.x+b.w<box.x||b.y>box.y+box.h||b.y+b.h<box.y)continue;
        found.push(items[id]);
      }
    }
    return found;
  }};
}
function positionInlineCaptions(captions,segments,positions,extraObstacles,wrap,distanceLimit=112,labelPolicy={},memo={pools:new Map()}){
  const readable=labelPolicy.readable===true;
  // Start with a broad but sparse set of positions. Dense corridor sampling is
  // reserved for scenes where the sparse pass cannot place every description.
  const exhaustiveIds=new Set(labelPolicy.exhaustive_ids||[]);
  const exhaustiveAll=labelPolicy.exhaustive===true;
  const textWidth=text=>[...text].reduce((n,c)=>n+(c.charCodeAt(0)<128?7.5:14),0);
  function readableRows(text,limit){
    const result=[];let line='',units=0;
    const push=()=>{if(line.trim())result.push(line.trim());line='';units=0;};
    for(const token of String(text).match(/[A-Za-z0-9]+(?:[-_'’][A-Za-z0-9]+)*|\n|[^\S\n]+|[^\s]/gu)||[]){
      if(token==='\n'){push();continue;}
      if(/^\s+$/.test(token)){if(line){line+=' ';units+=.55;}continue;}
      const size=[...token].reduce((n,c)=>n+(c.charCodeAt(0)<128?.55:1),0);
      if(line&&units+size>limit)push();line+=token;units+=size;
    }
    push();return result;
  }
  // A label may overlap four pixels of a neighboring border, while the node
  // interior, group heading text and other labels remain protected.
  const borderOverlap=4;
  const inset=box=>({x:box.x+borderOverlap,y:box.y+borderOverlap,w:Math.max(0,box.w-2*borderOverlap),h:Math.max(0,box.h-2*borderOverlap)});
  const obstacles=[...Object.values(positions).map(p=>inset({x:p.x,y:p.y,w:230,h:72})),...extraObstacles.map(inset)];
  const intersects=(a,b,pad=4)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
  const crosses=(s,b)=>s.a.x===s.b.x?s.a.x>b.x&&s.a.x<b.x+b.w&&Math.max(s.a.y,s.b.y)>b.y&&Math.min(s.a.y,s.b.y)<b.y+b.h:s.a.y>b.y&&s.a.y<b.y+b.h&&Math.max(s.a.x,s.b.x)>b.x&&Math.min(s.a.x,s.b.x)<b.x+b.w;
  const signature=s=>JSON.stringify(s.keys);
  // Routing cuts a straight wire at every crossing. Rejoin only adjacent pieces
  // with identical members, so labels can use the whole real straight span.
  const groups=new Map();
  for(const segment of segments){const horizontal=segment.a.y===segment.b.y,fixed=horizontal?segment.a.y:segment.a.x;
    const key=(horizontal?'h:':'v:')+fixed+':'+signature(segment);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...segment,horizontal,fixed,lo:horizontal?Math.min(segment.a.x,segment.b.x):Math.min(segment.a.y,segment.b.y),hi:horizontal?Math.max(segment.a.x,segment.b.x):Math.max(segment.a.y,segment.b.y)});
  }
  const spans=[];
  for(const pieces of groups.values()){
    let span;
    for(const piece of pieces.sort((a,b)=>a.lo-b.lo)){
      if(span&&Math.abs(span.hi-piece.lo)<.01){span.hi=piece.hi;span.ids.push(piece.id);}
      else{span={...piece,ids:[piece.id]};spans.push(span);}
    }
  }
  const boxDistance=(span,b)=>{const x=span.horizontal?span.lo:span.fixed,y=span.horizontal?span.fixed:span.lo,w=span.horizontal?span.hi-span.lo:0,h=span.horizontal?0:span.hi-span.lo;
    return Math.hypot(Math.max(x-b.x-b.w,b.x-x-w,0),Math.max(y-b.y-b.h,b.y-y-h,0));};
  function lineHitsBox(line,box){let lo=0,hi=1;for(const axis of ['x','y']){const size=axis==='x'?'w':'h',a=line.from[axis],d=line.to[axis]-a,min=box[axis]+.1,max=box[axis]+box[size]-.1;
    if(Math.abs(d)<.001){if(a<=min||a>=max)return false;continue;}const p=(min-a)/d,q=(max-a)/d;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));if(lo>=hi)return false;}return hi>0&&lo<1;}
  const leaderObstacles=[...Object.values(positions).map(p=>({x:p.x,y:p.y,w:230,h:72})),...extraObstacles];
  const conflicts=(a,b)=>intersects(a.box,b.box);
  const pools=new Map(),ownedSpans=new Map();
  const wireIndex=captionSpatialIndex(segments,s=>({x:Math.min(s.a.x,s.b.x),y:Math.min(s.a.y,s.b.y),w:Math.abs(s.a.x-s.b.x),h:Math.abs(s.a.y-s.b.y)}));
  const spanIndex=captionSpatialIndex(spans,s=>s.horizontal?{x:s.lo,y:s.fixed,w:s.hi-s.lo,h:0}:{x:s.fixed,y:s.lo,w:0,h:s.hi-s.lo});
  // Keep a bounded, score-ordered pool and reject candidates whose minimum
  // score cannot enter it before doing collision and nearest-wire searches.
  function retainOption(options,option,optionLimit){
    let lo=0,hi=options.length;
    while(lo<hi){const middle=(lo+hi)>>>1;if(options[middle].score<=option.score)lo=middle+1;else hi=middle;}
    if(lo>=optionLimit)return;
    options.splice(lo,0,option);if(options.length>optionLimit)options.pop();
  }
  for(const caption of captions){
    const exhaustive=exhaustiveAll||exhaustiveIds.has(caption.id);
    const optionLimit=exhaustive?180:64;
    const cacheKey=JSON.stringify([caption.id,caption.text,caption.keys,caption.candidates.map(s=>s.id),distanceLimit,exhaustive]);
    const cached=memo.pools.get(cacheKey);
    if(cached){pools.set(caption.id,cached.options);ownedSpans.set(caption.id,cached.owned);continue;}
    const gaps=[...new Set([...(exhaustive?[8,4,14,24,0,36,48,64,80,96,112]:[8,24,0,48,80,112]),...(distanceLimit>112?[144,176,208,distanceLimit]:[])])];
    const ids=new Set(caption.candidates.map(s=>s.id)),pieces=spans.filter(s=>s.ids.some(id=>ids.has(id))),owned=[],options=[],seen=new Set(),byAxis=new Map();
    for(const piece of pieces){const key=(piece.horizontal?'h:':'v:')+piece.fixed;if(!byAxis.has(key))byAxis.set(key,[]);byAxis.get(key).push(piece);}
    for(const list of byAxis.values()){let span;for(const piece of list.sort((a,b)=>a.lo-b.lo)){
      if(span&&piece.lo<=span.hi+.01){span.hi=Math.max(span.hi,piece.hi);span.ids.push(...piece.ids);span.keys=[...new Set([...span.keys,...piece.keys])];}
      else{span={...piece,ids:[...piece.ids],keys:[...piece.keys]};owned.push(span);}
    }}
    ownedSpans.set(caption.id,owned);
    const shapes=new Set(),foreign=new Set(spans.filter(s=>!s.keys.some(k=>caption.keys.includes(k))));
    const minWidth=readable?Math.min(labelPolicy.min_width||140,textWidth(caption.text)+8):0;
    const squareLimit=Math.max(14,Math.ceil(Math.sqrt(textWidth(caption.text)*20)/14)+2);
    const limits=[...new Set([...(readable?[14,16,12,18,10,20,22,24,28,32]:exhaustive?[14,16,12,18,10,20,8,24,6,5,4,3]:[14,16,12,18,10,20,8,24]),squareLimit,Math.ceil(squareLimit*1.5),Math.ceil(squareLimit*2)])];
    for(const limit of limits){
      const rows=readable?readableRows(caption.text,limit):wrap(caption.text,limit).map(row=>row.trim());
      if(readable&&rows.length>(labelPolicy.max_lines||3))continue;
      const w=Math.max(24,minWidth,...rows.map(row=>textWidth(row)+8)),h=rows.length*20+4;
      if(h>w)continue;
      const shape=rows.join('\n');if(shapes.has(shape))continue;shapes.add(shape);
      for(const span of owned){
        const size=span.horizontal?w:h,length=span.hi-span.lo,overflow=Math.max(0,(size-length)/2);
        const lo=span.lo+Math.min(size/2+10,length/2),hi=span.hi-Math.min(size/2+10,length/2),middle=(lo+hi)/2;
        const shapeScore=(readable?Math.max(0,w-220)*.4+Math.max(0,rows.length-2)*12:0)+(limit<8?120:0)+Math.max(0,span.keys.length-caption.keys.length)*15+Math.abs(limit-14)*3+rows.length*2+overflow*4+(span.horizontal?0:8);
        if(options.length===optionLimit&&shapeScore>options[optionLimit-1].score+1e-9)continue;
        const anchors=new Set([middle,lo,hi,span.lo,span.hi,span.lo-size/2-8,span.hi+size/2+8]);
        if(exhaustive)for(let p=lo+24;p<hi;p+=24)anchors.add(p);
        for(const along of anchors){
          const minimumScore=shapeScore+Math.abs(along-middle)*.08;
          if(options.length===optionLimit&&minimumScore>options[optionLimit-1].score+1e-9)continue;
          for(const gap of gaps)for(const side of (gap?[1,-1]:[0])){
          const box=span.horizontal?{x:along-w/2,y:span.fixed+(side===1?gap:side===-1?-gap-h:-h/2),w,h}:{x:span.fixed+(side===1?gap:side===-1?-gap-w:-w/2),y:along-h/2,w,h};
          const separation=boxDistance(span,box);
          if(separation>distanceLimit+.01)continue;
          const key=[box.x,box.y,w,h].join(':');if(seen.has(key))continue;seen.add(key);
          // All remaining score terms are nonnegative. A full pool with an
          // equal or better score already wins the stable-sort tie as well.
          if(options.length===optionLimit&&minimumScore>options[optionLimit-1].score+1e-9)continue;
          if(obstacles.some(b=>intersects(box,b,0)))continue;
          // Transparent text boxes keep every relation line clear of the text.
          if(wireIndex.query(box).some(segment=>crosses(segment,box)))continue;
          const distance=separation;
          if(options.length===optionLimit&&minimumScore+distance*2>options[optionLimit-1].score+1e-9)continue;
          // Only wires within distance + 5 can affect the leader decision or
          // ambiguity penalty; farther wires have exactly the same zero cost.
          const radius=distance+5,nearby={x:box.x-radius,y:box.y-radius,w:box.w+2*radius,h:box.h+2*radius};
          let otherSquared=Infinity;
          for(const segment of spanIndex.query(nearby)){
            if(!foreign.has(segment))continue;
            const x=segment.horizontal?segment.lo:segment.fixed,y=segment.horizontal?segment.fixed:segment.lo;
            const w=segment.horizontal?segment.hi-segment.lo:0,h=segment.horizontal?0:segment.hi-segment.lo;
            const dx=Math.max(x-box.x-box.w,box.x-x-w,0),dy=Math.max(y-box.y-box.h,box.y-y-h,0);
            otherSquared=Math.min(otherSquared,dx*dx+dy*dy);
          }
          const other=Math.sqrt(otherSquared);
          const onSpan=Math.max(span.lo,Math.min(span.hi,along));
          const anchor=span.horizontal?{x:onSpan,y:span.fixed}:{x:span.fixed,y:onSpan};
          const leader=distance>24||other+3<distance?{from:anchor,to:{x:Math.max(box.x,Math.min(box.x+box.w,anchor.x)),y:Math.max(box.y,Math.min(box.y+box.h,anchor.y))}}:null;
          if(leader&&leaderObstacles.some(b=>lineHitsBox(leader,b)))continue;
          const junctions=wireIndex.query({x:anchor.x-16,y:anchor.y-16,w:32,h:32}).filter(s=>(s.a.y===s.b.y)!==span.horizontal).length;
          const score=(readable?Math.max(0,w-220)*.4+Math.max(0,rows.length-2)*12:0)+(limit<8?120:0)+(leader?120:0)+Math.max(0,span.keys.length-caption.keys.length)*15+distance*2+Math.abs(along-middle)*.08+Math.abs(limit-14)*3+rows.length*2+overflow*4+(span.horizontal?0:8)+junctions*45+Math.max(0,distance+5-other)*12;
          retainOption(options,{box,rows,score,anchor,segmentIds:span.ids,gap:distance,inline:false,leader},optionLimit);
          }
        }
      }
    }
    pools.set(caption.id,options);
    memo.pools.set(cacheKey,{options,owned});
  }
  // Place constrained labels first. Look ahead at remaining choices so a label
  // yields scarce nearby space instead of forcing another description far away.
  const empty=[...pools].filter(([,options])=>!options.length).map(([id])=>id);
  function retry(ids){
    if(exhaustiveAll)return null;
    const additional=ids.filter(id=>!exhaustiveIds.has(id));
    const policy=additional.length?{...labelPolicy,exhaustive_ids:[...exhaustiveIds,...additional]}:{...labelPolicy,exhaustive:true};
    return positionInlineCaptions(captions,segments,positions,extraObstacles,wrap,distanceLimit,policy,memo);
  }
  if(empty.length){
    // Candidate pools are independent. If a caption already has no slot after
    // dense sampling, expanding every other pool cannot create a slot for it.
    const unexpanded=empty.filter(id=>!exhaustiveAll&&!exhaustiveIds.has(id));
    if(unexpanded.length){const result=retry(unexpanded);if(result)return result;}
    const error=new Error('No nearby label slot: '+empty.join(', '));error.code='CAPTION_SPACE';error.captionIds=empty;throw error;}
  let assigned=new Map();
  const order=[...captions].sort((a,b)=>pools.get(a.id).length-pools.get(b.id).length||Number(b.shared)-Number(a.shared)||a.id.localeCompare(b.id));
  let best=new Map();
  for(let attempt=0;attempt<6;attempt++){
    assigned=new Map();const pending=new Set(order.map(c=>c.id));
    while(pending.size){
      const chosen=[...assigned.values()];
      const available=[...pending].map(id=>({id,options:pools.get(id).filter(p=>!chosen.some(other=>conflicts(p,other)))})).sort((a,b)=>a.options.length-b.options.length||a.id.localeCompare(b.id));
      const next=available[0];if(!next.options.length){pending.delete(next.id);continue;}
      const scored=next.options.slice(0,20).map(candidate=>{
        let score=candidate.score;
        for(let i=1;i<available.length;i++){
          const other=available[i];let blocked=0;
          for(const option of other.options)if(conflicts(candidate,option))blocked++;
          score+=blocked===other.options.length?100000:80*blocked/other.options.length;
        }
        return {candidate,score};
      }).sort((a,b)=>a.score-b.score);
      const choice=scored[attempt&&pending.size===captions.length?Math.min(attempt,scored.length-1):0].candidate;
      assigned.set(next.id,choice);pending.delete(next.id);
    }
    if(assigned.size>best.size)best=new Map(assigned);if(assigned.size===captions.length)break;
  }
  if(assigned.size<best.size)assigned=best;
  // Coordinate descent improves distance and readability after all claims exist.
  for(let pass=0;pass<2;pass++)for(const caption of order){const current=assigned.get(caption.id);if(!current)continue;
    const better=pools.get(caption.id).find(p=>p.score<current.score&&!([...assigned].some(([id,other])=>id!==caption.id&&conflicts(p,other))));if(better)assigned.set(caption.id,better);
  }
  for(const caption of captions){const p=assigned.get(caption.id);if(!p?.leader)continue;
    const blocked=[...leaderObstacles,...[...assigned].filter(([id])=>id!==caption.id).map(([,other])=>other.box)],routes=[];
    for(const span of ownedSpans.get(caption.id)){
      const middle=span.horizontal?p.box.x+p.box.w/2:p.box.y+p.box.h/2,points=[Math.max(span.lo,Math.min(span.hi,middle)),span.lo,span.hi];
      for(let along=span.lo+24;along<span.hi;along+=24)points.push(along);
      for(const along of points){const from=span.horizontal?{x:along,y:span.fixed}:{x:span.fixed,y:along},to={x:Math.max(p.box.x,Math.min(p.box.x+p.box.w,from.x)),y:Math.max(p.box.y,Math.min(p.box.y+p.box.h,from.y))},distance=Math.hypot(from.x-to.x,from.y-to.y);
        if(distance>distanceLimit+.01)continue;
        const direct={from,to};if(!blocked.some(b=>lineHitsBox(direct,b)))routes.push({...direct,length:distance});
        for(const via of [{x:from.x,y:to.y},{x:to.x,y:from.y}])if(!blocked.some(b=>lineHitsBox({from,to:via},b)||lineHitsBox({from:via,to},b)))routes.push({...direct,via,length:Math.abs(from.x-to.x)+Math.abs(from.y-to.y)+30});
      }
    }
    routes.sort((a,b)=>a.length-b.length);if(routes.length){p.leader=routes[0];p.anchor=p.leader.from;}
  }
  const missing=captions.filter(c=>!assigned.has(c.id)).map(c=>c.id);
  if(missing.length){
    const result=retry(missing);if(result)return result;
    const error=new Error('No nearby label slot: '+missing.join(', '));error.code='CAPTION_SPACE';error.captionIds=missing;throw error;}
  return captions.map(caption=>{
    const placement=assigned.get(caption.id);
    return {...caption,...placement,x:placement.box.x+placement.box.w/2,y:placement.box.y+18};
  });
}
function layoutInlineCaptionModel(model,segments,positions,extra,policy={}){
  let distance=112;const memo={pools:new Map()};
  for(;;){
    try{return {captions:positionInlineCaptions(model.captions,segments,positions,extra,wrapCaptionText,distance,policy,memo),modelCaptions:model.captions};}
    catch(error){
      if(error.code!=='CAPTION_SPACE')throw error;
      let bundles=model.captions.filter(c=>c.shared&&error.captionIds.includes(c.id));
      if(!bundles.length)bundles=model.captions.filter(c=>c.shared);
      if(!bundles.length){if(distance<224){distance=224;continue;}throw error;}
      const ids=new Set(bundles.map(c=>c.id)),keys=new Set(bundles.flatMap(c=>c.keys));
      model.captions=model.captions.filter(c=>!ids.has(c.id));
      for(const caption of model.individualCaptions)if(keys.has(caption.keys[0])&&!model.captions.some(c=>c.keys.length===1&&c.keys[0]===caption.keys[0]))model.captions.push(caption);
    }
  }
}
window.buildInlineCaptions=buildInlineCaptions;
window.positionInlineCaptions=positionInlineCaptions;
