import sharp from "sharp";
const [src,out,l,t,w,h,scale] = process.argv.slice(2);
await sharp(src).extract({left:+l,top:+t,width:+w,height:+h}).resize(+w*(+scale)).png().toFile(out);
console.log("cropped",out);
