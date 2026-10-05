'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {drawScene,type Hit} from '@/lib/noel/scene';
import type {Album} from '@/lib/noel/types';
export type SceneHandle={canvas:()=>HTMLCanvasElement|null;restart:()=>void;images:()=>Map<string,HTMLImageElement>};
type Props={album:Album;playing:boolean;zoom:number;pan:{x:number;y:number};reduced:boolean;onZoom:(v:number)=>void;onPan:(v:{x:number;y:number})=>void;onPhoto:(id:string)=>void};
export const Scene=forwardRef<SceneHandle,Props>(function Scene({album,playing,zoom,pan,reduced,onZoom,onPan,onPhoto},ref){
  const canvas=useRef<HTMLCanvasElement>(null),time=useRef(0),hits=useRef<Hit[]>([]),images=useRef(new Map<string,HTMLImageElement>());
  const current=useRef({album,playing,zoom,pan,reduced});current.current={album,playing,zoom,pan,reduced};
  const [size,setSize]=useState({w:800,h:600});const gesture=useRef<{x:number;y:number;px:number;py:number;moved:boolean}|null>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef(0);
  useImperativeHandle(ref,()=>({canvas:()=>canvas.current,restart:()=>{time.current=0;},images:()=>images.current}),[]);
  useEffect(()=>{const c=canvas.current;if(!c)return;const ro=new ResizeObserver(([entry])=>setSize({w:entry.contentRect.width,h:entry.contentRect.height}));ro.observe(c);return()=>ro.disconnect();},[]);
  useEffect(()=>{const active=new Set(album.photos.map(p=>p.id));for(const id of images.current.keys())if(!active.has(id))images.current.delete(id);
    album.photos.forEach(p=>{if(images.current.get(p.id)?.src.endsWith(p.url))return;const im=new Image();im.src=p.url;images.current.set(p.id,im);});
  },[album.photos]);
  useEffect(()=>{time.current=0;},[album.id]);
  useEffect(()=>{
    const c=canvas.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);c.width=Math.max(1,Math.round(size.w*dpr));c.height=Math.max(1,Math.round(size.h*dpr));
    let raf=0,last=0,drawn=0;
    function tick(now:number){const dt=last?Math.min((now-last)/1000,.05):0;last=now;const p=current.current;
      if(p.playing&&!document.hidden)time.current+=dt;
      if(now-drawn>=30){ctx!.setTransform(dpr,0,0,dpr,0,0);hits.current=drawScene(ctx!,size.w,size.h,time.current,p.album,images.current,{zoom:p.zoom,pan:p.pan,reduced:p.reduced});drawn=now;}
      raf=requestAnimationFrame(tick);
    }raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[size]);
  return <canvas ref={canvas} className="tree-canvas" aria-label="Cây thông ánh sáng từ tên và ảnh kỷ niệm. Dùng các nút ảnh bên dưới để mở ảnh." role="img"
    onWheel={e=>{e.preventDefault();onZoom(Math.max(.7,Math.min(2.5,zoom-e.deltaY*.001)));}}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture.current={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current=Math.hypot(a.x-b.x,a.y-b.y);}}}
    onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.current.size===2){const [a,b]=[...pointers.current.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch.current)onZoom(Math.max(.7,Math.min(2.5,zoom*d/pinch.current)));pinch.current=d;if(gesture.current)gesture.current.moved=true;return;}
      const g=gesture.current;if(g&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>6){g.moved=true;onPan({x:g.px+e.clientX-g.x,y:g.py+e.clientY-g.y});}}}
    onPointerUp={e=>{const g=gesture.current;pointers.current.delete(e.pointerId);pinch.current=0;if(g&&!g.moved){const rect=e.currentTarget.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
      const found=[...hits.current].reverse().find(p=>Math.abs(x-p.x)<p.w/2&&Math.abs(y-p.y)<p.h/2);if(found)onPhoto(found.id);}
      gesture.current=null;}}
    onPointerCancel={e=>{pointers.current.delete(e.pointerId);gesture.current=null;pinch.current=0;}}
  />;
});
