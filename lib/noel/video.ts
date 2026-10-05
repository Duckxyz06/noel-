import {drawScene} from './scene';
import type {Album} from './types';
export function musicSource(album:Album){return album.music==='custom'&&album.audioUrl?album.audioUrl:`/music/${album.music==='piano'?'piano':'bells'}.mp3`;}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function compressPhoto(file:File):Promise<Blob>{
  if(file.size>30*1024*1024)throw new Error('Ảnh quá lớn (tối đa 30 MB trước khi nén).');
  let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error(`Không đọc được ${file.name}. Hãy chuyển ảnh HEIC sang JPG hoặc PNG.`);}
  if(bitmap.width*bitmap.height>80_000_000){bitmap.close();throw new Error('Ảnh có độ phân giải quá lớn.');}
  const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');c.width=Math.round(bitmap.width*ratio);c.height=Math.round(bitmap.height*ratio);
  c.getContext('2d')!.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
  const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('Không thể nén ảnh.')),'image/jpeg',.85));
  if(blob.size>2*1024*1024)throw new Error('Ảnh vẫn quá lớn sau khi nén.');return blob;
}
export async function recordVideo(album:Album,portrait:boolean,onProgress:(n:number)=>void,signal:AbortSignal):Promise<{blob:Blob;extension:string}>{
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw new Error('Trình duyệt này chưa hỗ trợ xuất video. Hãy dùng Chrome hoặc Edge trên laptop.');
  const c=document.createElement('canvas');c.width=portrait?720:1280;c.height=portrait?1280:720;
  const ctx=c.getContext('2d')!,images=new Map<string,HTMLImageElement>();
  await Promise.all(album.photos.map(p=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(p.id,im);resolve();};im.onerror=()=>reject(new Error('Không tải được một ảnh để xuất video.'));im.src=p.url;})));
  const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime)throw new Error('Không tìm thấy định dạng video được trình duyệt hỗ trợ.');
  const ac=new AudioContext();let stream:MediaStream|undefined,source:AudioBufferSourceNode|undefined,raf=0,recorder:MediaRecorder|undefined;
  try{
    await ac.resume();const response=await fetch(musicSource(album),{signal});if(!response.ok)throw new Error('Không tải được nhạc nền.');
    const audioBuffer=await ac.decodeAudioData(await response.arrayBuffer());source=ac.createBufferSource();source.buffer=audioBuffer;source.loop=true;
    const destination=ac.createMediaStreamDestination(),gain=ac.createGain();gain.gain.value=.65;source.connect(gain);gain.connect(destination);
    drawScene(ctx,c.width,c.height,0,album,images,{exporting:true});stream=c.captureStream(30);destination.stream.getAudioTracks().forEach(track=>stream!.addTrack(track));
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:portrait?4_000_000:5_000_000,audioBitsPerSecond:128_000});
    const chunks:BlobPart[]=[];const rec=recorder;
    const blob=await new Promise<Blob>((resolve,reject)=>{
      let canceled=false;const abort=()=>{canceled=true;if(rec.state!=='inactive')rec.stop();else reject(new DOMException('Đã hủy xuất video.','AbortError'));};
      signal.addEventListener('abort',abort,{once:true});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onerror=()=>{signal.removeEventListener('abort',abort);reject(new Error('Xuất video thất bại. Vui lòng thử lại.'));};
      rec.onstop=()=>{signal.removeEventListener('abort',abort);if(canceled)reject(new DOMException('Đã hủy xuất video.','AbortError'));else resolve(new Blob(chunks,{type:mime}));};
      if(signal.aborted){abort();return;}
      rec.start(1000);source!.start();const start=performance.now();
      const frame=(now:number)=>{if(rec.state==='inactive')return;const t=Math.min((now-start)/1000,20);
        drawScene(ctx,c.width,c.height,t,album,images,{exporting:true});onProgress(Math.round(t/20*100));
        if(t>=20){rec.stop();return;}raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
    });return {blob,extension:mime.startsWith('video/mp4')?'mp4':'webm'};
  }finally{cancelAnimationFrame(raf);if(recorder&&recorder.state!=='inactive')recorder.stop();try{source?.stop();}catch{}stream?.getTracks().forEach(t=>t.stop());await ac.close();}
}
