/* 目的和主要功能：提供代码语义图的中英文界面、JSON 文本翻译、语言与明暗主题偏好。
 * 适用范围：共用代码图 viewer；翻译保持源码路径、身份、关系及坐标不变。
 */
'use strict';
(()=>{
  const english={
    '输入':'Input','过程':'Process','输出':'Output','独立':'Independent','节点颜色表示输入、过程、输出与独立节点':'Node colors represent input, process, output and independent nodes',
    '功能概览':'Overview','← 功能概览':'← Overview','完整具体逻辑':'Implementation','功能与实现':'Functions and implementation',
    '全部收起':'Collapse all','全部功能':'All functions','全部展开':'Expand all',
    '查找节点…':'Find nodes…','查找节点':'Find nodes','缩小':'Zoom out','放大':'Zoom in','还原位置':'Reset positions','还原手动拖动的位置':'Reset manually moved nodes',
    '总览':'Overview','处理':'Operation','资料':'Data','结果':'Result','拒绝':'Rejection','节点颜色表示功能角色':'Node colors represent functional roles','节点颜色表示总览与功能角色':'Node colors distinguish overview and functional roles',
    '源码目录与文件':'Source folders and files','选择下一级目录或文件':'Choose a child folder or file','当前视图':'Current view',
    '点击功能展开 · 点击范围标题或边界收起 · 点击线段高亮关系 · 滚轮缩放':'Click to expand · Click a group title or border to collapse · Click a line to highlight relations · Scroll to zoom',
    '可逐节点展开的两层语义图':'Two-level semantic graph with expandable nodes','选择这段连线':'Select this connection segment',
    '代码图目录暂时不可用':'The graph catalog is unavailable','尚无代码图，请先通过 Skill 保存 JSON。':'No graphs yet. Generate a graph with the Skill first.',
    '代码图读取失败':'Could not load the graph','当前目录尚未生成目录图':'No folder graph has been generated for this directory',
    '此目录尚未生成目录图。可通过上方路径返回上级，或选择子目录、Python 文件查看已有图。':'No folder graph has been generated here. Use the path above to browse parent folders, child folders, or existing Python file graphs.',
    '绘图组件加载失败':'Could not load the graph viewer','加载失败：{error}':'Loading failed: {error}',
    '切换 {path}':'Switch {path}','父图位置：{owners}':'In parent graph: {owners}','上级目录：{name}':'Parent folder: {name}',
    '（父图仅含直属文件）':' (parent graph covers direct files only)',
    '{nodes} 个节点 · {lines} 条连线 · {relations} 项关系':'{nodes} nodes · {lines} connections · {relations} relations',
    '{nodes} 个节点 · {lines} 条连线 · {relations} 项关系 · {level}':'{nodes} nodes · {lines} connections · {relations} relations · {level}',
    'L1 功能概览':'L1 overview','完整 L2':'Full L2','L1 / L2 局部展开':'Mixed L1 / L2',
    '已展开 {count} / {total}':'Expanded {count} / {total}','{name} · 已突出相关连线':'{name} · Related connections highlighted',
    '{name}，点击展开':'{name}, click to expand','打开 {name} 的目录图':'Open the folder graph for {name}','打开 {name} 的单文件图':'Open the graph for {name}','收起 {name}':'Collapse {name}',
    '当前画布找到 {count} 个节点':'Found {count} nodes in this view','没有找到匹配节点':'No matching nodes found',
    '当前路径在目录图中的对应文件':'Files corresponding to the current source path',
    '连线说明暂未排好，节点仍可浏览。':'Connection labels are unavailable; nodes remain browsable.',
    '部分图中文字沿用原文，尚待补充所选语言翻译。':'Some graph text is shown in its original language; translations are not yet complete.'
  };
  const params=new URLSearchParams(location.search);let stored;try{stored=localStorage.getItem('codeAtlas.language');}catch{}
  const requested=params.get('lang')||stored,lang=requested==='zh'?'zh':'en';
  try{localStorage.setItem('codeAtlas.language',lang);}catch{}
  const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
  let manualTheme=false;
  function setTheme(theme,persist=false){
    const choice=theme==='light'?'light':'dark';document.documentElement.dataset.theme=choice;
    for(const button of document.querySelectorAll('.theme-switch [data-theme]')){
      button.classList.toggle('active',button.dataset.theme===choice);button.setAttribute('aria-pressed',String(button.dataset.theme===choice));
    }
    if(persist){manualTheme=true;try{localStorage.setItem('codeAtlas.theme',choice);}catch{}const url=new URL(location.href);url.searchParams.set('theme',choice);window.history.replaceState(null,'',url);}
  }
  let storedTheme;try{storedTheme=localStorage.getItem('codeAtlas.theme');}catch{}
  const explicitTheme=[params.get('theme'),storedTheme].find(value=>value==='light'||value==='dark');
  manualTheme=!!explicitTheme;
  setTheme(explicitTheme||(systemTheme.matches?'dark':'light'));
  if(params.get('theme')==='light'||params.get('theme')==='dark')try{localStorage.setItem('codeAtlas.theme',document.documentElement.dataset.theme);}catch{}
  systemTheme.addEventListener('change',event=>{if(!manualTheme)setTheme(event.matches?'dark':'light');});
  for(const button of document.querySelectorAll('.theme-switch [data-theme]'))button.onclick=()=>setTheme(button.dataset.theme,true);
  function t(key,values={}){return (lang==='en'?(english[key]||key):key).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'{'+k+'}');}
  function ui(){
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){if(node.parentElement.closest('script,style'))continue;const text=node.nodeValue.trim();if(english[text])node.nodeValue=node.nodeValue.replace(text,t(text));}
    for(const el of document.querySelectorAll('[title],[aria-label],[placeholder]'))for(const attr of ['title','aria-label','placeholder']){const raw=el.getAttribute(attr);if(raw&&english[raw])el.setAttribute(attr,t(raw));}
    for(const button of document.querySelectorAll('[data-language]')){
      button.classList.toggle('active',button.dataset.language===lang);button.setAttribute('aria-pressed',String(button.dataset.language===lang));
      button.onclick=()=>{const next=button.dataset.language;if(next===lang)return;
        try{localStorage.setItem('codeAtlas.language',next);if(window.SemanticPreview)sessionStorage.setItem('codeAtlas.languageView',JSON.stringify({source:window.B.data.source,state:SemanticPreview.snapshot()}));}catch{}
        const url=new URL(location.href);url.searchParams.set('lang',next);location.assign(url);
      };
    }
  }
  function localize(graph){
    const result=structuredClone(graph),dictionary=graph.i18n?.translations?.[lang]||{};
    const fixed=new Set(['id','from','to','owner','source','file','folder','path','symbol','relation','source_index','i18n','source_sha256','sha256','detail_graph','category']);
    function walk(value){if(typeof value==='string')return typeof dictionary[value]==='string'?dictionary[value]:value;
      if(Array.isArray(value))return value.map(walk);if(value&&typeof value==='object'){for(const key of Object.keys(value))if(!fixed.has(key))value[key]=walk(value[key]);}return value;}
    walk(result);
    const visible=[];
    for(const level of ['L1','L2']){visible.push(...result.graphs[level].nodes.map(n=>n.name));visible.push(...result.graphs[level].edges.map(e=>e.label));}
    const p=result.display.presentation;visible.push(...(p.relationship_summaries||[]).map(r=>r.text),...Object.values(p.shared_targets||{}),...Object.values(p.shared_sources||{}),...Object.values(p.connection_pairs||{}));
    const original=[];
    for(const level of ['L1','L2'])original.push(...graph.graphs[level].nodes.map(n=>n.name),...graph.graphs[level].edges.map(e=>e.label));
    const raw=graph.display.presentation;original.push(...(raw.relationship_summaries||[]).map(r=>r.text),...Object.values(raw.shared_targets||{}),...Object.values(raw.shared_sources||{}),...Object.values(raw.connection_pairs||{}));
    const source=graph.i18n?.source_language||(/\p{Script=Han}/u.test(original.join(''))?'zh':'en');
    const incomplete=lang!==source&&original.some(text=>typeof dictionary[text]!=='string');
    const notice=document.querySelector('#languageNotice');if(notice){notice.hidden=!incomplete;notice.textContent=t('部分图中文字沿用原文，尚待补充所选语言翻译。');}
    return result;
  }
  function restore(source){try{const raw=sessionStorage.getItem('codeAtlas.languageView');if(!raw)return null;sessionStorage.removeItem('codeAtlas.languageView');const value=JSON.parse(raw);return value.source===source?value.state:null;}catch{return null;}}
  window.GraphLocale={lang,t,localize,restore};ui();
})();
