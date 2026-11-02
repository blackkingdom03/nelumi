(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NelumiNoticeLinks=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  function webUrl(value) {
    if(typeof value!=='string'||value.length>2081||!/^https?:\/\//i.test(value)||/[\s\u0000-\u001f\u007f\\]/.test(value))return null;
    try{const url=new URL(value);return url.hostname&&!url.username&&!url.password&&url.href.length<=2081?url.href:null;}catch{return null;}
  }
  function parts(value) {
    const text=String(value??''),result=[];let offset=0;
    // Chinese surrounding prose terminates a pasted ASCII URL; the original stays untouched.
    for(const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"'\x60\p{Script=Han}，。！？；：、【】（）]+/giu)) {
      let link=match[0].replace(/[.,;!?]+$/,'');
      while(link.endsWith(')')&&(link.match(/\)/g)||[]).length>(link.match(/\(/g)||[]).length)link=link.slice(0,-1);
      const href=webUrl(/^www\./i.test(link)?'https://'+link:link);if(!href)continue;
      if(match.index>offset)result.push({text:text.slice(offset,match.index)});
      result.push({text:link,href});offset=match.index+link.length;
    }
    if(offset<text.length||!result.length)result.push({text:text.slice(offset)});
    return result;
  }
  return {webUrl,parts};
});
