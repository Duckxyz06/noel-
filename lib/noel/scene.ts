import { connectedNames,relationships,type Album } from './types';
export type Hit={id:string;x:number;y:number;w:number;h:number};
export type SceneOptions={zoom?:number;pan?:{x:number;y:number};reduced?:boolean;exporting?:boolean};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const rand=(i:number)=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);};
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number) {
  ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color);g.addColorStop(.18,color+'9c');g.addColorStop(1,color+'00');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
export function drawScene(ctx:CanvasRenderingContext2D,w:number,h:number,time:number,album:Album,images:Map<string,HTMLImageElement>,options:SceneOptions={}):Hit[] {
  const t=options.reduced?14:time;
  const scale=Math.min(w/650,h/660)*.95;
  const s=scale*(options.zoom||1),cx=w/2+(options.pan?.x||0),cy=h*.48+(options.pan?.y||0);
  const rotation=options.reduced?0:t*.026*album.speed;
  const hits:Hit[]=[];
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#020403';ctx.fillRect(0,0,w,h);
  glow(ctx,w/2,h*.62,Math.min(w,h)*.65,'#0b2418',.43);
  for(let i=0;i<100;i++){
    const x=rand(i+42)*w,y=((rand(i+300)*h+t*(album.snow?6:0)*(1+rand(i)))%h);
    ctx.globalAlpha=(.12+rand(i+97)*.4)*(album.snow?1:.35);ctx.fillStyle='#bdd6c8';ctx.beginPath();ctx.arc(x,y,(.5+rand(i+18))*scale,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  const base=cy+229*s;
  ctx.save();ctx.translate(cx,base);ctx.scale(1,.17);glow(ctx,0,0,242*s,'#29b768',clamp((t-1)/4)*.27);ctx.restore();
  for(let ring=0;ring<3;ring++){
    ctx.beginPath();ctx.ellipse(cx,base+ring*3*s,(165+ring*30)*s,(23+ring*4)*s,0,0,Math.PI*2);
    ctx.lineWidth=.6*s;ctx.strokeStyle=`rgba(107,226,155,${clamp((t-4)/4)*(.18-ring*.04)})`;ctx.stroke();
  }
  // Photo orbits move faster than the tree. Rear cards are drawn behind it.
  const cards=album.photos.map((photo,i)=>{
    const angle=i*2.39996+(options.reduced?0:t*.105*album.speed);
    const level=album.photos.length<=6?i%3:i%5;
    const radius=253+(level%2)*41;
    const z=Math.cos(angle),p=.81+.19*(z+1)/2;
    const reveal=clamp((t-5.8-i*.09)/1.3);
    const x=cx+Math.sin(angle)*radius*s,y=cy+(-145+level*76)*s+z*31*s+(1-reveal)*110*s;
    const cardW=(album.photos.length>15?72:97)*s*p,cardH=cardW*1.17;
    return {photo,i,x,y,z,reveal,w:cardW,h:cardH,tilt:Math.sin(angle*.7)*.075};
  }).sort((a,b)=>a.z-b.z);
  function card(c:typeof cards[number]){
    if(!c.reveal)return;
    ctx.save();ctx.globalAlpha=c.reveal*(.63+.37*(c.z+1)/2);
    if(c.reveal<1)glow(ctx,c.x,c.y,60*s,'#ffe6a9',(1-c.reveal)*.85);
    ctx.translate(c.x,c.y);ctx.rotate(c.tilt);
    ctx.shadowColor='#e4c27a';ctx.shadowBlur=10*s;ctx.fillStyle='#e9e5d9';ctx.beginPath();ctx.roundRect(-c.w/2,-c.h/2,c.w,c.h,3*s);ctx.fill();ctx.shadowBlur=0;
    const im=images.get(c.photo.id),iw=c.w-8*s,ih=c.h-20*s;
    if(im?.complete&&im.naturalWidth){ctx.save();ctx.beginPath();ctx.rect(-iw/2,-c.h/2+4*s,iw,ih);ctx.clip();
      const cover=Math.max(iw/im.naturalWidth,ih/im.naturalHeight);ctx.drawImage(im,-im.naturalWidth*cover/2,-c.h/2+4*s+(ih-im.naturalHeight*cover)/2,im.naturalWidth*cover,im.naturalHeight*cover);ctx.restore();
    }else{ctx.fillStyle='#183829';ctx.fillRect(-iw/2,-c.h/2+4*s,iw,ih);ctx.fillStyle='#b8dbbe';ctx.font=`${12*s}px sans-serif`;ctx.textAlign='center';ctx.fillText('♥',0,-3*s);}
    ctx.font=`${Math.max(7,8*s)}px Arial`;ctx.textAlign='center';ctx.fillStyle='#3e4b41';ctx.fillText(c.photo.caption.slice(0,18),0,c.h/2-6*s);
    ctx.restore();if(c.reveal>.9)hits.push({id:c.photo.id,x:c.x,y:c.y,w:c.w,h:c.h});
  }
  cards.filter(c=>c.z<0).forEach(card);
  // Name-bearing streaks rise from the base before joining the name rings.
  if(t<7){for(let i=0;i<36;i++){
    const start=rand(i+500)*3.6,progress=clamp((t-start)/2.4);if(!progress||progress===1)continue;
    const x=cx+(rand(i+210)*2-1)*200*s*(1-progress*.7),y=base-progress*(220+rand(i+321)*260)*s;
    const g=ctx.createLinearGradient(x,y,x,y+60*s);g.addColorStop(0,'#a6ffc4');g.addColorStop(1,'#41c67500');ctx.strokeStyle=g;ctx.lineWidth=1.1*s;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(1-progress)*8*s,y+60*s);ctx.stroke();
    ctx.globalAlpha=Math.sin(progress*Math.PI);ctx.fillStyle='#9ef6b9';ctx.font=`${12*s}px Arial`;ctx.textAlign='center';ctx.fillText(album.names[i%album.names.length],x,y-4*s);ctx.globalAlpha=1;
  }}
  // Individual points add shimmer between legible name rings, rather than a solid mesh.
  for(let i=0;i<1150;i++){
    const v=Math.sqrt(rand(i+721)),r=180*v*(.9+.1*rand(i+39)),a=rand(i+122)*Math.PI*2+rotation;
    const reveal=clamp((t-1.4-(1-v)*2.5-rand(i+200)*.65)/1.65);if(!reveal)continue;
    const z=Math.cos(a),x=cx+Math.sin(a)*r*s,y=cy+(-224+446*v)*s+z*r*.13*s+(1-reveal)*(130+rand(i)*230)*s;
    ctx.globalAlpha=reveal*(.15+.58*(z+1)/2)*(.6+.4*Math.sin(t*1.8+i));ctx.fillStyle=i%13===0?'#d6efb4':'#57dd85';
    ctx.beginPath();ctx.arc(x,y,(.55+rand(i+541)*1.15)*s,0,Math.PI*2);ctx.fill();
  }
  const labels:{x:number;y:number;z:number;v:number;index:number}[]=[];
  for(let ring=0;ring<15;ring++){
    const v=(ring+1)/15,r=180*v,count=Math.max(1,Math.floor(2*Math.PI*r/90));
    for(let k=0;k<count;k++){const a=k/count*Math.PI*2+rotation+ring*.46;
      labels.push({x:cx+Math.sin(a)*r*s,y:cy+(-224+446*v)*s+Math.cos(a)*r*.13*s,z:Math.cos(a),v,index:ring*21+k});}
  }
  labels.sort((a,b)=>a.z-b.z).forEach(p=>{
    const reveal=clamp((t-1.8-(1-p.v)*2.4)/1.7);if(!reveal)return;
    ctx.globalAlpha=reveal*(.08+.87*(p.z+1)/2);ctx.textAlign='center';
    ctx.font=`${(9.5+(p.z+1)*1.5)*s}px Arial, sans-serif`;ctx.fillStyle=p.index%5===0?'#ceecac':'#70e89a';
    ctx.shadowColor='#22b15a';ctx.shadowBlur=p.z>.3?5*s:0;
    const groupLabel=`${album.names[p.index%album.names.length]} ${['🤝','🫶','✨'][p.index%3]} ${album.names[(p.index+1)%album.names.length]}`;
    const label=p.index%4===0?(album.relation==='group'?groupLabel:connectedNames(album)):album.names[p.index%album.names.length];
    ctx.fillText(label,p.x,p.y+(1-reveal)*180*s);ctx.shadowBlur=0;
  });
  ctx.globalAlpha=1;
  const colors=['#f1c96a','#ed937d','#a7d9e9','#bdaaec','#e6b8c8'];
  // Festoon bulbs and tasteful ornaments materialize after the names.
  for(let i=0;i<100;i++){
    const v=.13+i/115,a=v*Math.PI*12+rotation,r=184*v,z=Math.cos(a),x=cx+Math.sin(a)*r*s,y=cy+(-224+446*v)*s+z*r*.13*s;
    const reveal=clamp((t-4.5-i*.023)/1.4);const alpha=reveal*(.4+.6*(z+1)/2);
    if(!alpha)continue;const color=colors[i%colors.length];
    if(i%8===0){glow(ctx,x,y,13*s,color,alpha*.8);ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(x,y,3*s,0,Math.PI*2);ctx.fill();}
    else{glow(ctx,x,y,5*s,'#f1d79d',alpha*.48);ctx.globalAlpha=alpha;ctx.fillStyle='#ffeab2';ctx.beginPath();ctx.arc(x,y,1.3*s,0,Math.PI*2);ctx.fill();}
  }
  // Gold topper: a gradual bloom, never a sudden white flash.
  const star=clamp((t-4.2)/3.5),sx=cx,sy=cy-249*s;
  ctx.globalAlpha=1;glow(ctx,sx,sy,(44+Math.sin(t*.7)*5)*s,'#eac16a',star*.55);
  ctx.save();ctx.globalAlpha=star;ctx.fillStyle='#f7d481';ctx.shadowColor='#ffce61';ctx.shadowBlur=13*s;ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=(i%2?7.8:18)*s;i?ctx.lineTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r):ctx.moveTo(sx+Math.cos(a)*r,sy+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.restore();
  cards.filter(c=>c.z>=0).forEach(card);
  ctx.globalAlpha=1;
  // Quiet footer floats below the tree and is included in video exports.
  ctx.textAlign='center';ctx.fillStyle='#e3cc9a';ctx.font=`${15*scale}px Georgia, serif`;
  ctx.fillText(connectedNames(album).slice(0,110),w/2,h-48*scale);
  if(options.exporting){ctx.fillStyle='#98ac9e';ctx.font=`${12*scale}px Arial`;ctx.fillText(album.message.slice(0,75),w/2,h-22*scale);}
  return hits;
}
