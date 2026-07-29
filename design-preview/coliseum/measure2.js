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
    const px=(X,y)=>{const i=(y*c.width+X)*4; return {r:d[i],g:d[i+1],b:d[i+2],a:d[i+3]};};
    // opaque runs on the row just above the body top (y=188) = the two shackle legs
    const runs=[]; let start=null;
    for(let X=0;X<c.width;X++){
      const on=px(X,188).a>40;
      if(on&&start===null) start=X;
      if((!on||X===c.width-1)&&start!==null){ runs.push([start,X-1]); start=null; }
    }
    // sample the body orange + the keyhole (fox) bounds
    const o=px(216,210);
    const hex="#"+[o.r,o.g,o.b].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
    // fox keyhole = dark pixels inside the body
    let kx0=1e9,kx1=-1,ky0=1e9,ky1=-1;
    for(let y=192;y<372;y++) for(let X=91;X<341;X++){
      const q=px(X,y);
      if(q.a>40 && q.r<80 && q.g<80 && q.b<80){
        if(X<kx0)kx0=X; if(X>kx1)kx1=X; if(y<ky0)ky0=y; if(y>ky1)ky1=y;
      }
    }
    return {legRuns:runs, orange:hex, keyhole:{x0:kx0,x1:kx1,y0:ky0,y1:ky1,cx:(kx0+kx1)/2,cy:(ky0+ky1)/2}};
  },"data:image/png;base64,"+b64);
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
