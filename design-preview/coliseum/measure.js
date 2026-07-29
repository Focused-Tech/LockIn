const puppeteer=require("puppeteer"), path=require("path"), fs=require("fs");
(async()=>{
  const b64=fs.readFileSync(path.join(__dirname,"assets/icon-padlock.png")).toString("base64");
  const b=await puppeteer.launch({args:["--no-sandbox"]});
  const p=await b.newPage();
  const r=await p.evaluate(async(uri)=>{
    const img=new Image(); img.src=uri; await img.decode();
    const c=document.createElement("canvas"); c.width=img.width; c.height=img.height;
    const x=c.getContext("2d"); x.drawImage(img,0,0);
    const d=x.getImageData(0,0,c.width,c.height).data;
    const rows=[];
    for(let y=0;y<c.height;y++){
      let min=1e9,max=-1;
      for(let X=0;X<c.width;X++){
        const a=d[(y*c.width+X)*4+3];
        if(a>40){ if(X<min)min=X; if(X>max)max=X; }
      }
      rows.push(max<0?null:{y,min,max,w:max-min});
    }
    const filled=rows.filter(Boolean);
    const top=filled[0].y, bot=filled[filled.length-1].y;
    // body top = first row where width jumps past 70% of max width
    const maxW=Math.max(...filled.map(r=>r.w));
    const bodyTop=filled.find(r=>r.w>maxW*0.92).y;
    return {W:c.width,H:c.height,top,bot,maxW,bodyTop};
  },"data:image/png;base64,"+b64);
  console.log(r);
  await b.close();
})();
