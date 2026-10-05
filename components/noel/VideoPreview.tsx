'use client';
import {useEffect,useRef,useState} from 'react';
import {Player} from '@remotion/player';
import {useCurrentFrame,useVideoConfig,AbsoluteFill} from 'remotion';
import type {Album} from '@/lib/noel/types';
import {drawScene} from '@/lib/noel/scene';
function MemoryFilm({album}:{album:Album}){
  const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig(),ref=useRef<HTMLCanvasElement>(null);
  const [images,setImages]=useState(new Map<string,HTMLImageElement>());
  useEffect(()=>{let alive=true;Promise.all(album.photos.map(p=>new Promise<[string,HTMLImageElement]|null>(resolve=>{const im=new Image();im.onload=()=>resolve([p.id,im]);im.onerror=()=>resolve(null);im.src=p.url;}))).then(entries=>{if(alive)setImages(new Map(entries.filter((e):e is [string,HTMLImageElement]=>!!e)));});return()=>{alive=false;};},[album.photos]);
  useEffect(()=>{const ctx=ref.current?.getContext('2d');if(ctx)drawScene(ctx,width,height,frame/fps,album,images,{exporting:true});},[frame,fps,width,height,album,images]);
  return <AbsoluteFill><canvas ref={ref} width={width} height={height} style={{width:'100%',height:'100%'}} /></AbsoluteFill>;
}
export default function VideoPreview({album,portrait}:{album:Album;portrait:boolean}){
  return <Player component={MemoryFilm} inputProps={{album}} durationInFrames={600} compositionWidth={portrait?720:1280} compositionHeight={portrait?1280:720} fps={30} controls loop style={{width:'100%',maxHeight:'45vh',background:'#000',borderRadius:12}} />;
}
