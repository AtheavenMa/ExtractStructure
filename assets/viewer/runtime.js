/* 目的和主要功能：为服务页面与独立页面提供统一的数据、导航、资源与后台计算入口。
 * 适用范围：ExtractStructure 共用查看器；独立页面从内嵌资料读取，服务页面使用同源请求。
 */
'use strict';
(()=>{
  const embedded=document.querySelector('#extractStructureBundle');
  const bundle=embedded?JSON.parse(embedded.textContent):null;
  const base='/extract-structure/';
  const hash=()=>new URLSearchParams(location.hash.slice(1));
  let memoryParameters=null;
  const pageParameters=()=>memoryParameters||hash();
  const runtime={
    standalone:!!bundle,
    defaultLanguage:bundle?.language||'en',
    defaultTheme:bundle?.theme||'system',
    parameters(){return bundle?pageParameters():new URLSearchParams(location.search);},
    requested(){return bundle?(pageParameters().get('source')||bundle.source):decodeURIComponent(location.pathname.slice(base.length)).replace(/\/$/,'');},
    async catalog(){
      if(bundle)return {graphs:bundle.catalog};
      const response=await fetch(base+'data/',{cache:'no-store'});
      if(!response.ok)throw new Error('The graph catalog is unavailable');
      return response.json();
    },
    async graph(id){
      if(bundle){if(!Object.hasOwn(bundle.graphs,id))throw new Error('The requested graph was not exported');return bundle.graphs[id];}
      const response=await fetch(base+'data/'+id.split('/').map(encodeURIComponent).join('/')+'.json',{cache:'no-store'});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Could not load graph');return payload;
    },
    url(source,extra={}){
      if(!bundle){const params=new URLSearchParams(location.search);params.delete('focus_path');for(const [key,value]of Object.entries(extra))params.set(key,value);return base+source.split('/').map(encodeURIComponent).join('/')+(params.size?'?'+params:'');}
      const params=new URLSearchParams(pageParameters());params.set('source',source);params.delete('focus_path');for(const [key,value]of Object.entries(extra))params.set(key,value);return '#'+params;
    },
    follow(url,extra={}){if(bundle)this.navigate(new URLSearchParams(url.slice(1)).get('source'),extra);else{const target=new URL(url,location.href);for(const [key,value]of Object.entries(extra))target.searchParams.set(key,value);location.assign(target);}},
    navigate(source,extra={}){if(bundle){const url=this.url(source,extra);memoryParameters=new URLSearchParams(url.slice(1));try{history.pushState(null,'',url);memoryParameters=null;}catch{try{location.hash=url;memoryParameters=null;}catch{}}window.dispatchEvent(new Event('extract:navigate'));}else location.assign(this.url(source,extra));},
    preference(key,value){const params=bundle?new URLSearchParams(pageParameters()):new URLSearchParams(location.search);params.set(key,value);try{history.replaceState(null,'',bundle?'#'+params:location.pathname+'?'+params+location.hash);if(bundle)memoryParameters=null;}catch{if(bundle)memoryParameters=params;}},
    worker(){
      let worker=null,url=null,timer=null,stopped=false,submitted=null,fallback=false;
      const release=()=>{worker?.terminate();worker=null;if(url){URL.revokeObjectURL(url);url=null;}};
      const task={onmessage:null,onerror:null,
        terminate(){stopped=true;release();clearTimeout(timer);},
        postMessage(data){submitted=data;if(worker){try{worker.postMessage(data);}catch{useMainThread();}}else useMainThread();}
      };
      function useMainThread(){
        if(stopped||fallback)return;fallback=true;release();
        timer=setTimeout(()=>{
          if(stopped)return;const started=performance.now();
          try{const data=submitted,result=layoutInlineCaptionModel(data.model,data.segments,data.positions,data.extra,data.policy);
            if(!stopped)task.onmessage?.({data:{result,elapsedMs:performance.now()-started}});
          }catch(error){if(!stopped)task.onmessage?.({data:{error:String(error.message||error)}});}
        },0);
      }
      try{
        if(bundle)url=URL.createObjectURL(new Blob([bundle.worker],{type:'text/javascript'}));
        worker=new Worker(url||base+'assets/caption_worker.js');
        worker.onmessage=event=>{if(!stopped)task.onmessage?.(event);};
        worker.onerror=event=>{event.preventDefault();useMainThread();};
      }catch{release();}
      return task;
    }
  };
  window.ExtractRuntime=runtime;
})();
