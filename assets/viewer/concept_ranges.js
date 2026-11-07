/* 目的和主要功能：计算展开功能的范围、标题与边界。
 * 适用范围：目录图和文件图在同一画布中逐项展开时使用。
 */
'use strict';
function computeConceptRanges(expanded,model,positions){
  const W=230,H=72;
  const nodes=Object.entries(positions).map(([id,p])=>({id,x:p.x,y:p.y,w:W,h:H}));
  const result=[],headerBoxes=[];
  const intersects=(a,b,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;
  const union=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.max(a.x+a.w,b.x+b.w)-Math.min(a.x,b.x),h:Math.max(a.y+a.h,b.y+b.h)-Math.min(a.y,b.y),members:[...a.members,...b.members]});
  for(const owner of expanded){
    if(model.layoutHints.exclusive_groups&&model.displayChildren.get(owner).size<=1)continue;
    const own=new Set([...(model.layoutHints.exclusive_groups?model.displayChildren:model.children).get(owner)||[]].filter(id=>positions[id]));if(!own.size)continue;
    const index=[...model.upperBy.keys()].indexOf(owner),inset=index*5;
    const foreign=nodes.filter(n=>!own.has(n.id));
    let fragments=[...own].map(id=>{
      const p=positions[id];let left=p.x-24-inset,top=p.y-64-inset,right=p.x+W+24+inset,bottom=p.y+H+24+inset;
      for(const n of foreign){
        if(n.x<p.x+W&&n.x+n.w>p.x){if(n.y+n.h<=p.y)top=Math.max(top,n.y+n.h+10);if(n.y>=p.y+H)bottom=Math.min(bottom,n.y-10);}
        if(n.y<p.y+H&&n.y+n.h>p.y){if(n.x+n.w<=p.x)left=Math.max(left,n.x+n.w+10);if(n.x>=p.x+W)right=Math.min(right,n.x-10);}
      }
      return{x:left,y:top,w:right-left,h:bottom-top,members:[id]};
    });
    let changed=true;
    while(changed){changed=false;
      outer:for(let i=0;i<fragments.length;i++)for(let j=i+1;j<fragments.length;j++){
        const a=fragments[i],b=fragments[j],merged=union(a,b);
        const near=a.members.some(aa=>b.members.some(bb=>{const p=positions[aa],q=positions[bb];return Math.abs(p.y-q.y)<35&&Math.abs(p.x-q.x)<=470||Math.abs(p.x-q.x)<35&&Math.abs(p.y-q.y)<=290;}));
        if(!near||merged.w*merged.h>merged.members.length*W*H*5.5||foreign.some(n=>intersects(merged,n,3)))continue;
        fragments.splice(j,1);fragments.splice(i,1,merged);changed=true;break outer;
      }
    }
    fragments.sort((a,b)=>a.x-b.x||a.y-b.y);
    const name=model.upperBy.get(owner).name;
    const region={id:owner,name,color:({input:'var(--atlas-data)',process:'var(--atlas-operation)',output:'var(--atlas-copper)',independent:'var(--atlas-independent)'}[model.upperBy.get(owner).category]||'var(--atlas-overview)'),members:[...own],fragments:[]};
    for(let i=0;i<fragments.length;i++){
      const fragment=fragments[i],width=Math.min(360,Math.max(140,[...name].reduce((n,c)=>n+(c.charCodeAt(0)<128?8:16),0)+48));let header;
      const xs=[fragment.x+12,Math.max(fragment.x+12,fragment.x+fragment.w-width-12)];
      outer:for(let attempt=0;attempt<18;attempt++){
        const y=attempt===0?fragment.y-16:attempt===1?fragment.y+fragment.h-16:fragment.y-16-(attempt-1)*36;
        for(const x of xs){const box={x,y,w:width,h:32};if(nodes.some(n=>intersects(box,{x:n.x-30,y:n.y-40,w:n.w+60,h:n.h+80}))||headerBoxes.some(n=>intersects(box,n,4)))continue;header=box;break outer;}
      }
      if(!header)header={x:fragment.x+12,y:fragment.y-40-headerBoxes.length*36,w:width,h:32};
      headerBoxes.push(header);region.fragments.push({...fragment,key:owner+':'+i,header,secondary:i>0});
    }
    result.push(region);
  }
  return {regions:result,headers:headerBoxes};
}
window.computeConceptRanges=computeConceptRanges;
