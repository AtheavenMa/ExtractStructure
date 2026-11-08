/* 目的和主要功能：加载 ExtractStructure 图资料，连接内部绘图组件与目录、文件导航。
 * 适用范围：本技能的文章、目录和文件图页面；通过统一入口读取服务资料或内嵌资料。
 */
'use strict';
(()=>{
  const base='/extract-structure/',runtime=ExtractRuntime;
  const next=document.querySelector('#pathNext');
  const status=document.querySelector('#sceneStatus'),t=GraphLocale.t;
  const byTypeAndName=(a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||a.source.split('/').at(-1).localeCompare(b.source.split('/').at(-1),'en',{sensitivity:'base'});
  function fileLabel(element,text,isFile){
    const dot=isFile?text.lastIndexOf('.'):-1;
    if(dot>0){element.append(document.createTextNode(text.slice(0,dot)));const suffix=document.createElement('span');suffix.className='file-suffix';suffix.textContent=text.slice(dot);element.append(suffix);}
    else element.textContent=text;
  }
  let openMenu=null;
  function closeMenu(){if(openMenu){openMenu.menu.hidden=true;openMenu.button.setAttribute('aria-expanded','false');openMenu=null;}}
  document.addEventListener('pointerdown',e=>{if(openMenu&&!openMenu.menu.contains(e.target)&&!openMenu.button.contains(e.target))closeMenu();});
  window.addEventListener('resize',closeMenu);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openMenu){e.preventDefault();const button=openMenu.button;closeMenu();button.focus();}});
  function styleSelector(select,next=false){
    const button=document.createElement('button');button.type='button';button.className='path-choice'+(next?' path-choice-next':'');
    button.setAttribute('aria-label',select.getAttribute('aria-label'));button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
    if(!next){const chosen=select.selectedOptions[0];fileLabel(button,chosen.textContent.replace(/\/$/,''),chosen.dataset.kind==='file');}
    select.hidden=true;select.after(button);
    const menu=document.createElement('div');menu.className='path-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',select.getAttribute('aria-label'));menu.hidden=true;
    for(const option of select.options){if(!option.value)continue;const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.dataset.value=option.value;
      fileLabel(item,option.textContent,option.dataset.kind==='file');if(option.selected)item.className='current';
      item.onclick=()=>{select.value=option.value;closeMenu();select.dispatchEvent(new Event('change'));};menu.append(item);}
    document.body.append(menu);
    const items=()=>[...menu.querySelectorAll('[role=menuitem]')];
    function show(){if(openMenu?.button===button){closeMenu();return;}closeMenu();menu.hidden=false;button.setAttribute('aria-expanded','true');openMenu={button,menu};
      const rect=button.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.min(rect.bottom+6,innerHeight-menu.offsetHeight-8)+'px';}
    button.onclick=show;
    button.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(openMenu?.button!==button)show();const list=items();(e.key==='ArrowUp'?list.at(-1):list[0])?.focus();}};
    menu.onkeydown=e=>{const list=items(),index=list.indexOf(document.activeElement);let target;
      if(e.key==='Escape'){e.preventDefault();closeMenu();button.focus();return;}
      if(e.key==='Tab'){closeMenu();return;}
      if(e.key==='ArrowDown')target=list[(index+1)%list.length];if(e.key==='ArrowUp')target=list[(index-1+list.length)%list.length];if(e.key==='Home')target=list[0];if(e.key==='End')target=list.at(-1);
      if(target){e.preventDefault();target.focus();}
    };
  }
  let generation=0;
  async function renderPage(){
    const ticket=++generation;
    window.ExtractViewerDispose?.();
    closeMenu();
    window.SemanticPreview=null;
    window.B=null;
    document.querySelector('#graphBreadcrumbs').parentElement.append(next);
    document.querySelector('#graphBreadcrumbs').replaceChildren();
    document.querySelector('#graphPicker').replaceChildren();
    next.querySelectorAll('button').forEach(node=>node.remove());
    document.querySelectorAll('.path-menu').forEach(node=>node.remove());
    document.querySelector('#canvas').replaceChildren();
    document.querySelectorAll('.toolbar button,.toolbar input,.toolbar select').forEach(control=>control.disabled=false);
  try{
    const catalog=await runtime.catalog(),picker=document.querySelector('#graphPicker');
    if(ticket!==generation)return;
    const requested=runtime.requested();
    const current=catalog.graphs.find(g=>g.source===requested||g.id===requested)||(!requested?catalog.graphs[0]:null);
    const id=current?.id||requested;
    if(!id){status.textContent=t('尚无代码图，请先通过 Skill 保存 JSON。');return;}
    if(!runtime.standalone&&current&&location.pathname!==current.url)try{history.replaceState(null,'',current.url+location.search+location.hash);}catch{}
    const source=current?.source||requested;
    const directory=current?.kind==='folder'?source:source.slice(0,source.lastIndexOf('/'));
    // Path segments show only the selected source path. Descending is a separate action.
    picker.append(new Option('',''));
    const local=catalog.graphs.filter(g=>g.source!==source&&g.source.slice(0,g.source.lastIndexOf('/'))===directory);
    for(const item of local.sort(byTypeAndName)){
      const option=new Option(item.source.split('/').at(-1)+(item.kind==='folder'?'/':''),runtime.url(item.source));option.dataset.kind=item.kind;picker.append(option);
    }
    picker.value='';picker.onchange=()=>{if(picker.value)runtime.follow(picker.value);};
    const path=document.querySelector('#graphBreadcrumbs'),parts=source.split('/');
    for(let i=0;i<parts.length;i++){
      if(i){const divider=document.createElement('span');divider.className='path-divider';divider.textContent='/';path.append(divider);}
      const targetSource=parts.slice(0,i+1).join('/'),parentSource=parts.slice(0,i).join('/');
      const siblings=catalog.graphs.filter(g=>g.source===targetSource||g.source.slice(0,g.source.lastIndexOf('/'))===parentSource);
      const select=document.createElement('select');select.className='path-segment';select.setAttribute('aria-label',t('切换 {path}',{path:targetSource}));
      for(const item of siblings.sort(byTypeAndName)){const option=new Option(item.source.split('/').at(-1)+(item.kind==='folder'?'/':''),runtime.url(item.source));option.dataset.kind=item.kind;select.append(option);}
      select.value=runtime.url(targetSource);
      select.onchange=()=>runtime.follow(select.value,{focus_path:source});
      path.append(select);
      styleSelector(select);
    }

    next.hidden=current?.kind!=='folder'||local.length===0;
    if(!next.hidden){const divider=document.createElement('span');divider.className='path-divider';divider.textContent='/';path.append(divider,next);styleSelector(picker,true);}

    const payload=await runtime.graph(id);
    if(ticket!==generation)return;
    if(!payload.graph){
      document.title=source+' / ExtractStructure';
      status.textContent=t('当前目录尚未生成目录图');
      const message=document.createElement('p');message.className='graph-empty-message';
      message.textContent=t('此目录尚未生成目录图。可通过上方路径返回上级，或选择子目录、Python 文件查看已有图。');
      document.querySelector('#canvas').append(message);
      document.querySelectorAll('.toolbar button,.toolbar input,.toolbar select').forEach(control=>control.disabled=true);
      return;
    }
    const graph=GraphLocale.localize(payload.graph),hints={...graph.display,title:graph.source},layouts={};
    for(const level of ['L1','L2']){
      const plan=hints[level]||{};
      layouts[level]={nodes:Object.fromEntries(graph.graphs[level].nodes.map(n=>[n.id,{role:'operation',column:0,lane:0,...plan.nodes[n.id]}])),
        edges:graph.graphs[level].edges.map((e,index)=>({from:e.from,to:e.to,index,primary:(plan.main_edges||[]).some(pair=>pair[0]===e.from&&pair[1]===e.to)}))};
    }
    window.B={original:payload.graph,data:graph,layouts,presentation:hints.presentation,title:hints.title||graph.source,input_sha256:payload.sha256,restore:GraphLocale.restore(graph.source)};
    document.title=(hints.title||graph.source)+' / ExtractStructure';
    window.ExtractViewerMount();
  }catch(error){if(ticket===generation)status.textContent=t('加载失败：{error}',{error:error.message});}
  }
  window.addEventListener('extract:navigate',renderPage);
  window.addEventListener('hashchange',()=>{if(runtime.standalone)renderPage();});
  window.addEventListener('popstate',()=>{if(runtime.standalone)renderPage();});
  window.addEventListener('extract:language',()=>{
    if(!window.B)return;const snapshot=window.SemanticPreview?.snapshot();
    window.ExtractViewerDispose?.();
    B.data=GraphLocale.localize(B.original);B.presentation=B.data.display.presentation;B.restore=snapshot;
    window.ExtractViewerMount();
  });
  document.addEventListener('click',event=>{const link=event.target.closest('a.node-entry-link');if(runtime.standalone&&link){event.preventDefault();runtime.navigate(decodeURIComponent(new URL(link.getAttribute('href'),'https://extract-structure.invalid').pathname.slice(base.length)));}});
  renderPage();
})();
