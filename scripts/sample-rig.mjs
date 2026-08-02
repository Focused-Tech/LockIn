import sharp from "sharp";
const dir = "public/foxpit/cutouts/avatar_rig/";
async function px(file, x, y){
  const img = sharp(dir+file); const m = await img.metadata();
  const {data,info} = await img.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const cx=Math.round(x), cy=Math.round(y);
  const i=(cy*info.width+cx)*info.channels;
  return `${file} ${m.width}x${m.height} @(${cx},${cy}) = rgba(${data[i]},${data[i+1]},${data[i+2]},${data[i+3]})`;
}
// thigh_near prox(16,18) dist(78,66) center; forearm_near prox(15,8) dist(20,122)
for (const [f,pts] of [
  ["m_thigh_near.png",[[16,18],[78,66],[46,45]]],
  ["m_shin_near.png",[[15,6],[46,98],[30,50]]],
  ["m_forearm_near.png",[[15,8],[20,122],[16,60]]],
  ["m_upperarm_near.png",[[15,7],[18,106],[16,55]]],
]) for (const [x,y] of pts) console.log(await px(f,x,y));
