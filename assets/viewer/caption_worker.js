/* 目的和主要功能：在后台计算连线说明的位置，保持画布与操作控件可响应。
 * 适用范围：ExtractStructure 当前可见图的文字布局；画布切换时由调用方取消旧任务。
 */
'use strict';
self.window=self;
importScripts('./inline_labels.js');
self.onmessage=({data})=>{
  try{
    const started=performance.now();
    const result=layoutInlineCaptionModel(data.model,data.segments,data.positions,data.extra,data.policy);
    self.postMessage({result,elapsedMs:performance.now()-started});
  }catch(error){self.postMessage({error:String(error.message||error)});}
};
