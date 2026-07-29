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
    const A=(X,y)=>d[(y*c.width+X)*4+3];
    const rowRuns=y=>{const runs=[];let s=null;
      for(let X=0;X<c.width;X++){const on=A(X,y)>40;
        if(on&&s===null)s=X;
        if((!on||X===c.width-1)&&s!==null){runs.push([s,X-1]);s=null;}}
      return runs;};
    let lastTwo=null;
    const sample=[];
    for(let y=60;y<230;y++){
      const rr=rowRuns(y);
      if(rr.length===2) lastTwo={y,runs:rr};
      if(y%10===0) sample.push({y,n:rr.length,runs:rr.map(r=>r.join("-")).join(" | ")});
    }
    return {lastRowWithTwoLegs:lastTwo, sample};
  },"data:image/png;base64,"+b64);
  console.log("last row with 2 separate legs:",JSON.stringify(r.lastRowWithTwoLegs));
  console.log("row scan:"); r.sample.forEach(s=>console.log(`  y=${s.y} runs=${s.n}  ${s.runs}`));
  await b.close();
})();
