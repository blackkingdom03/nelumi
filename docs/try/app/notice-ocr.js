(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NelumiNoticeOCR=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const assetBase=typeof document==='undefined'?'':new URL('./vendor/ocr/',document.currentScript.src).href;
  function validateFile(file){
    if(!file||!['image/png','image/jpeg','image/webp','image/bmp'].includes(file.type))return '图片格式不支持，请使用 PNG、JPG、WebP 或 BMP。';
    if(!file.size)return '图片为空，请重新复制。';
    if(file.size>10*1024*1024)return '图片超过 10 MB，请缩小后再粘贴。';
    return null;
  }
  function cleanText(text){return String(text||'').replace(/\r\n?/g,'\n')
    .replace(/(?<=\p{Script=Han})[ \t]+(?=\p{Script=Han})/gu,'')
    .replace(/(\d)[ \t]+(?=[年月日号点分])/g,'$1').replace(/([年月])[ \t]+(?=\d)/g,'$1')
    .replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
  let library;
  function loadLibrary(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    if(!library)library=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=assetBase+'tesseract.min.js';
      script.onload=()=>resolve(window.Tesseract);script.onerror=()=>{library=null;script.remove();reject(Error('本地识别组件加载失败，请重新打开程序后重试。'));};document.head.append(script);
    });
    return library;
  }
  function start(file,onProgress=()=>{}){
    let stopped=false,worker,canvas,stopReject;
    const stop=new Promise((_,reject)=>{stopReject=reject;});
    const cancel=(message='已取消图片识别。')=>{stopped=true;stopReject(Error(message));if(worker)void worker.terminate();if(canvas){canvas.width=0;canvas.height=0;}};
    const timer=setTimeout(()=>cancel('识别超时，请裁剪到通知正文后重试。'),60000);
    const work=(async()=>{
      const invalid=validateFile(file);if(invalid)throw Error(invalid);
      const bitmap=await createImageBitmap(file);
      try{
        if(stopped)throw Error('已取消图片识别。');
        if(bitmap.width*bitmap.height>16000000||bitmap.width>10000||bitmap.height>10000)throw Error('图片尺寸过大，请裁剪到通知正文后重试。');
        const scale=Math.min(2,Math.max(1,1400/bitmap.width),Math.sqrt(6000000/(bitmap.width*bitmap.height)));
        canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      }finally{bitmap.close();}
      const engine=await loadLibrary();if(stopped)throw Error('已取消图片识别。');
      worker=await engine.createWorker(['chi_sim','eng'],1,{workerPath:assetBase+'worker.min.js',corePath:assetBase+'core',langPath:assetBase+'lang',cacheMethod:'none',errorHandler:()=>cancel('图片识别失败，请重新选择清晰的通知截图后重试。'),logger:m=>{if(!stopped)onProgress(m.status==='recognizing text'?Math.round(m.progress*100):0);}});
      if(stopped){await worker.terminate();throw Error('已取消图片识别。');}
      await worker.setParameters({tessedit_pageseg_mode:'6',user_defined_dpi:'150'});
      const {data}=await worker.recognize(canvas);
      const text=cleanText(data.text);if(!text)throw Error('没有识别到文字，请使用清晰的通知截图。');
      if(text.length>50000)throw Error('识别文字超过 50,000 字符，请分段粘贴图片。');
      return {text,confidence:Number(data.confidence)||0};
    })().finally(()=>{if(worker)void worker.terminate();if(canvas){canvas.width=0;canvas.height=0;}});
    return {promise:Promise.race([work,stop]).finally(()=>clearTimeout(timer)),cancel};
  }
  return {validateFile,cleanText,start};
});

