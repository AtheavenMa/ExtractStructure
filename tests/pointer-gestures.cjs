// Exercise the production gesture handlers with SVG camera coordinates.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/viewer/viewer.js'),'utf8');
const input=source.slice(source.indexOf('function point(e)'),source.indexOf('function activate(target)'));
function setup(){
  const listeners=new Map(),captured=new Set(),classes=new Set(),timers=new Map();
  let timer=0;
  const canvas={
    addEventListener(type,handler,capture){const list=listeners.get(type)||[];list.push({handler,capture:capture===true});listeners.set(type,list);},
    hasPointerCapture:id=>captured.has(id),setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)
  };
  const context={console,Map,Math,JSON,structuredClone,
    $:selector=>selector==='#canvas'?canvas:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}},
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),
    localStorage:{setItem(){}},stateKey:()=>'',drawGeometry(){},
    DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return{x:this.x*m.a+m.e,y:this.y*m.d+m.f};}}
  };
  vm.createContext(context);
  vm.runInContext(`
    let box=[0,0,1000,2000],fitBox=[0,0,1000,2000],cameraAnimation=0,drag=null,suppressClick=false;
    const positions={n:{x:10,y:20}},saved={},cached=new Map(),storageKey='test';
    function setBox(next){box=next;}
    const root={getScreenCTM(){const a=400/box[2],d=800/box[3],e=-box[0]*a,f=-box[1]*d;return{a,d,e,f,inverse(){return{a:1/a,d:1/d,e:-e/a,f:-f/d};}};}};
  `+input+`
    globalThis.inspect=()=>({box:[...box],drag,suppressClick,contacts:gesturePointers.size,position:{...positions.n},saved:{...saved}});
  `,context);
  const target=kind=>({closest:selectors=>selectors.split(',').some(s=>s.trim()===kind)?{dataset:{node:'n'}}:null});
  function send(type,id,x,y,kind='',extra={}){
    const e={pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,target:target(kind),prevented:false,stopped:false,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
    for(const item of [...(listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){item.handler(e);if(e.stopped)break;}
    return e;
  }
  return{send,state:context.inspect,classes};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
for(const kind of ['.node','.wire-segment','.owner-control','.node-entry-link','']){
  const t=setup();
  t.send('pointerdown',1,100,100,kind);t.send('pointerup',1,100,100,kind);
  assert.equal(t.send('click',1,100,100,kind).prevented,false,'Tap should reach '+kind);
  t.send('pointerdown',2,100,100,kind);t.send('pointermove',2,140,130,kind);
  near(t.state().box[0],-100);near(t.state().box[1],-75);
  t.send('pointerup',2,140,130,kind);
  assert.equal(t.send('click',2,140,130,kind).prevented,true,'Drag must not activate '+kind);
}
{
  const t=setup();
  t.send('pointerdown',1,100,150,'.node');t.send('pointerdown',2,200,150,'.node');
  t.send('pointermove',1,50,150);t.send('pointermove',2,250,150);
  near(t.state().box[2],500);near(t.state().box[0]+150*t.state().box[2]/400,375);
  t.send('pointermove',1,90,190);t.send('pointermove',2,290,190);
  near(t.state().box[2],500);near(t.state().box[0]+190*t.state().box[2]/400,375);
  near(t.state().box[1]+190*t.state().box[3]/800,375);
  t.send('pointerup',2,290,190);const before=t.state().box[0];
  t.send('pointermove',1,110,190);near(t.state().box[0],before-25);
  t.send('pointercancel',1,110,190);
  assert.equal(t.state().contacts,0);assert.equal(t.classes.has('is-dragging'),false);
  t.send('pointerdown',3,100,100,'.node');t.send('pointerup',3,100,100,'.node');
  assert.equal(t.send('click',3,100,100,'.node').prevented,false);
}
{
  const t=setup();
  t.send('pointerdown',1,100,150);t.send('pointerdown',2,200,150);
  t.send('pointermove',2,10000,150);near(t.state().box[2],300);
  t.send('pointermove',2,101,150);near(t.state().box[2],4000);
  t.send('lostpointercapture',2,101,150);t.send('pointerup',1,100,150);
  assert.equal(t.state().contacts,0);
}
{
  const t=setup(),mouse={pointerType:'mouse',shiftKey:true};
  t.send('pointerdown',1,100,100,'.node',mouse);t.send('pointermove',1,120,140,'.node',mouse);
  t.send('pointerup',1,120,140,'.node',mouse);
  near(t.state().position.x,60);near(t.state().position.y,120);
  assert.ok(t.state().saved.n);
}
for(const name of ['gpt-code-structure.html','attention-is-all-you-need-paper-structure.html']){
  const html=fs.readFileSync(path.join(__dirname,'../examples',name),'utf8');
  const shared=source.slice(source.indexOf('// Track each contact'),source.indexOf('function activate(target)'));
  const embedded=shared.replaceAll("$('#canvas').addEventListener(","listen($('#canvas'),");
  assert.ok(html.includes(embedded),name+' must ship the current handlers');
  for(const [,attrs,script]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!attrs.includes('application/json'))new vm.Script(script);
  }
}
console.log('PASS: taps, pan from controls/links, anchored pinch, two-finger pan, finger transitions, cancellation, zoom limits, mouse node drag, and both HTML exports.');

