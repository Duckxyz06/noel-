'use client';
import {useEffect,useRef,useState,lazy,Suspense} from 'react';
import {TreePine,Music2,ImagePlus,QrCode,Download,Play,Pause,RotateCcw,Maximize2,ZoomIn,ZoomOut,Save,FolderHeart,Heart,Users,Sparkles,Trash2,Copy,Check,SlidersHorizontal,Plus,LockKeyhole,VolumeX,ChevronLeft,ChevronRight,Loader2} from 'lucide-react';
import QRCode from 'qrcode';
import {toast} from 'sonner';
import {Toaster} from '@/components/ui/sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {Slider} from '@/components/ui/slider';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {Scene,type SceneHandle} from './Scene';
import {connectedNames,demo,relationships,type Album,type Relation} from '@/lib/noel/types';
import {compressPhoto,download,musicSource,recordVideo} from '@/lib/noel/video';
const VideoPreview=lazy(()=>import('./VideoPreview'));
async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const res=await fetch(`/api/noel/${path}`,{...options,headers:{...(typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
  let data:unknown;try{data=await res.json();}catch{throw new Error('Kết nối bị gián đoạn. Vui lòng thử lại.');}
  if(!res.ok)throw new Error(data&&typeof data==='object'&&'error' in data?String(data.error):'Không thể thực hiện thao tác.');return data as T;
}
type Session={signedIn:boolean;operator:boolean;slot?:number;email?:string};
export default function Noel({admin=false,albumId}:{admin?:boolean;albumId?:string}){
  const [album,setAlbum]=useState<Album>({...demo}),[nameText,setNameText]=useState(demo.names.join(', '));
  const [session,setSession]=useState<Session|null>(null),[list,setList]=useState<Album[]>([]),[drawer,setDrawer]=useState(false),[library,setLibrary]=useState(false);
  const [loading,setLoading]=useState(!!albumId||admin),[error,setError]=useState(''),[busy,setBusy]=useState(''),[dirty,setDirty]=useState(false),[code,setCode]=useState('');
  const [playing,setPlaying]=useState(true),[muted,setMuted]=useState(true),[volume,setVolume]=useState(.55),[reduced,setReduced]=useState(false),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  const [photoId,setPhotoId]=useState<string|null>(null),[photoZoom,setPhotoZoom]=useState(1),[share,setShare]=useState(false),[qr,setQr]=useState(''),[shareUrl,setShareUrl]=useState('');
  const [photoBase,setPhotoBase]=useState({w:0,h:0});
  const [video,setVideo]=useState(false),[portrait,setPortrait]=useState(false),[progress,setProgress]=useState<number|null>(null),[remove,setRemove]=useState<{id?:string;kind:'photo'|'album'|'audio'}|null>(null);
  const [invite,setInvite]=useState<{claimed:boolean;code?:string;email?:string}|null>(null);
  const scene=useRef<SceneHandle>(null),audio=useRef<HTMLAudioElement>(null),photoInput=useRef<HTMLInputElement>(null),audioInput=useRef<HTMLInputElement>(null),stage=useRef<HTMLDivElement>(null),controller=useRef<AbortController|null>(null);
  const editable=admin&&!!session?.operator,readOnly=!!albumId;
  const modelState=useRef({album,readOnly,editable,admin});modelState.current={album,readOnly,editable,admin};
  useEffect(()=>{
    type Context={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
    const context=(document as Document&{modelContext?:Context}).modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools=[{name:'read_memory_tree',description:'Read the currently visible Christmas memory tree and its names.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({title:modelState.current.album.title,names:modelState.current.album.names,relation:modelState.current.album.relation,photoCount:modelState.current.album.photos.length,published:modelState.current.album.published})},
      {name:'stage_tree_names',description:'Preview 2–8 names and their relationship on the tree. This stages unsaved changes and does not save or publish.',inputSchema:{type:'object',properties:{names:{type:'array',items:{type:'string'},minItems:2,maxItems:8},relation:{type:'string',enum:['couple','bestie','group']}},required:['names','relation'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{
        const state=modelState.current;if(state.readOnly||(state.admin&&!state.editable))throw new Error('This tree cannot be edited here.');
        if(!input||typeof input!=='object')throw new Error('Invalid input');const v=input as {names:unknown;relation:unknown};
        if(!Array.isArray(v.names)||v.names.length<2||v.names.length>8||!v.names.every(n=>typeof n==='string'&&n.trim().length>0&&n.trim().length<=24)||!['couple','bestie','group'].includes(String(v.relation)))throw new Error('Invalid names or relationship');
        if(v.relation==='group'?v.names.length<3:v.names.length!==2)throw new Error('Invalid name count');
        const names=(v.names as string[]).map(n=>n.trim()),relation=v.relation as Relation;
        setAlbum(a=>({...a,names,relation}));setNameText(names.join(', '));setDirty(true);return {staged:true,names,relation};
      }}];
    for(const tool of tools)try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[]);
  function adopt(a:Album){setAlbum(a);setNameText(a.names.join(', '));setDirty(false);setZoom(1);setPan({x:0,y:0});scene.current?.restart();}
  const update=(patch:Partial<Album>)=>{setAlbum(a=>({...a,...patch}));setDirty(true);};
  useEffect(()=>{let alive=true;async function load(){try{
    if(albumId){const a=await api<Album>(`view/${albumId}`);if(alive)adopt(a);}
    if(admin){const s=await api<Session>('session');if(alive)setSession(s);if(s.operator){const saved=await api<Album[]>('albums');if(alive)setList(saved);}}
  }catch(e){if(alive)setError((e as Error).message);}finally{if(alive)setLoading(false);}}void load();return()=>{alive=false;};},[admin,albumId]);
  useEffect(()=>{const m=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(m.matches);const change=()=>setReduced(m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
  useEffect(()=>{if(audio.current)audio.current.volume=volume;},[volume]);
  useEffect(()=>{const a=audio.current;if(!a)return;if(muted)a.pause();else a.play().catch(()=>{setMuted(true);toast.info('Chạm nút nhạc để bật âm thanh.');});},[muted,album.music,album.audioUrl]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(!share||album.id==='demo')return;let active=true;const url=`${window.location.origin}/m/${album.id}`;setShareUrl(url);setQr('');void QRCode.toDataURL(url,{width:640,margin:3,errorCorrectionLevel:'M',color:{dark:'#163924',light:'#fffaf0'}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)toast.error('Không tạo được mã QR.');});return()=>{active=false;};},[share,album.id]);
  const chosen=album.photos.find(p=>p.id===photoId);
  const openPhoto=(id:string)=>{setPhotoId(id);setPhotoZoom(1);};
  const changePhoto=(step:number)=>{const i=album.photos.findIndex(p=>p.id===photoId);const next=album.photos[(i+step+album.photos.length)%album.photos.length];if(next)openPhoto(next.id);};
  async function refreshList(){const all=await api<Album[]>('albums');setList(all);}
  async function enroll(){setBusy('Đang mở Studio…');try{await api('enroll',{method:'POST',body:JSON.stringify({code})});setSession(await api('session'));setCode('');await refreshList();toast.success('Quyền quản lý đã gắn với tài khoản của bạn.');}catch(e){toast.error((e as Error).message);}finally{setBusy('');}}
  async function persist(published=album.published):Promise<Album>{
    const names=nameText.split(/[,\n]/).map(n=>n.trim()).filter(Boolean);
    const payload={...album,names,published};const a=await api<Album>(album.id==='demo'?'albums':`albums/${album.id}`,{method:album.id==='demo'?'POST':'PUT',body:JSON.stringify(payload)});
    setAlbum(a);setNameText(a.names.join(', '));setDirty(false);await refreshList();return a;
  }
  async function save(publish=false){setBusy(publish?'Đang tạo liên kết…':'Đang lưu…');try{let a=await persist(publish||album.published);
    if(publish&&!a.published){a=await api<Album>(`albums/${a.id}`,{method:'PUT',body:JSON.stringify({...a,published:true})});setAlbum(a);await refreshList();}
    toast.success(publish?'Bộ kỷ niệm đã sẵn sàng để gửi.':'Đã lưu bộ kỷ niệm.');if(publish)setShare(true);
  }catch(e){toast.error((e as Error).message);}finally{setBusy('');}}
  async function upload(files:FileList|null,kind:'photo'|'audio'){
    if(!files?.length||!editable)return;
    const selected=Array.from(files);if(kind==='photo'&&selected.length+album.photos.length>30){toast.error('Mỗi cây thông có tối đa 30 ảnh.');return;}
    setBusy('Đang chuẩn bị…');let completed=0;
    try{const saved=await persist();for(let i=0;i<selected.length;i++){
      const f=selected[i];setBusy(`Đang tải ${i+1}/${selected.length}…`);const body=kind==='photo'?await compressPhoto(f):f;
      if(kind==='audio'&&(f.size>10*1024*1024||!f.name.toLowerCase().endsWith('.mp3')))throw new Error('Chọn tệp MP3 tối đa 10 MB.');
      const a=await api<Album>(`albums/${saved.id}/upload?kind=${kind}`,{method:'POST',headers:{'Content-Type':kind==='photo'?'image/jpeg':'audio/mpeg','x-caption':encodeURIComponent(f.name.replace(/\.[^.]+$/,'').slice(0,100))},body});
      completed++;setAlbum(a);
      if(kind==='audio'){const withMusic=await api<Album>(`albums/${saved.id}`,{method:'PUT',body:JSON.stringify({...a,music:'custom'})});setAlbum(withMusic);}
    }await refreshList();toast.success(kind==='photo'?`Đã thêm ${completed} ảnh kỷ niệm.`:'Đã thêm nhạc riêng.');
    }catch(e){toast.error(`${completed?`Đã lưu ${completed} tệp. `:''}${(e as Error).message}`);}finally{setBusy('');if(photoInput.current)photoInput.current.value='';if(audioInput.current)audioInput.current.value='';}
  }
  async function removeItem(){if(!remove)return;setBusy('Đang xóa…');try{
    if(remove.kind==='album'){await api(`albums/${album.id}`,{method:'DELETE'});adopt({...demo});}
    else{const id=remove.id||album.audioUrl?.split('/').pop();if(id){const a=await api<Album>(`albums/${album.id}/media/${id}`,{method:'DELETE'});setAlbum(remove.kind==='audio'?{...a,music:'bells'}:a);if(remove.kind==='audio'){setDirty(true);}if(photoId===id)setPhotoId(null);}}
    await refreshList();toast.success('Đã xóa.');setRemove(null);
  }catch(e){toast.error((e as Error).message);}finally{setBusy('');}}
  async function closeSharing(){setBusy('Đang đóng liên kết…');try{const a=await persist(false);setAlbum(a);toast.success('Liên kết đã đóng. Khách sẽ không truy cập được bộ ảnh này.');}catch(e){toast.error((e as Error).message);}finally{setBusy('');}}
  async function exportVideo(){controller.current=new AbortController();setProgress(0);try{
    const result=await recordVideo(album,portrait,setProgress,controller.current.signal);download(result.blob,`Noel-ky-niem.${result.extension}`);toast.success('Video đã sẵn sàng tải xuống.');
  }catch(e){if((e as Error).name!=='AbortError')toast.error((e as Error).message);}finally{setProgress(null);controller.current=null;}}
  async function copyLink(){try{await navigator.clipboard.writeText(shareUrl);toast.success('Đã sao chép liên kết.');}catch{toast.info('Chọn và sao chép liên kết bên dưới.');}}
  const editor=<div className="editor-content">
    <div className="studio-heading"><span className="eyebrow">{editable?'STUDIO CỦA HAI BẠN':'THỬ MỘT CHÚT PHÉP MÀU'}</span><h2>{editable?'Gói một mùa nhớ':'Viết tên vào Giáng sinh'}</h2><p>{editable?'Tên, ảnh và một lời nhắn. Thế là đủ cho một món quà.':'Thay tên để xem cây thông của bạn sẽ trông như thế nào.'}</p></div>
    {admin&&!session?.operator?<div className="enroll-panel"><LockKeyhole size={22}/><h3>Mở Studio riêng</h3><p>Chủ Studio đăng nhập bằng tài khoản ChatGPT đã tạo web. Người quản lý thứ hai nhập mã do chủ Studio gửi.</p><label htmlFor="code">Mã mời người quản lý thứ hai</label><Input id="code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="Nhập mã được cấp"/><Button className="gold-button" disabled={!code||!!busy} onClick={enroll}>Mở quyền quản lý</Button><a className="quiet-link" href="/signout-with-chatgpt?return_to=/">Đổi tài khoản</a></div>:<>
      <label htmlFor="title">Tên bộ kỷ niệm</label><Input id="title" maxLength={80} value={album.title} onChange={e=>update({title:e.target.value})}/>
      <label htmlFor="names">Tên những người đặc biệt</label><Input id="names" maxLength={210} value={nameText} placeholder="An, Bình" onChange={e=>{setNameText(e.target.value);const n=e.target.value.split(/[,\n]/).map(n=>n.trim()).filter(Boolean);update({names:n.length?n:['…']});}}/><p className="field-note">Ngăn cách mỗi tên bằng dấu phẩy · tối đa 24 ký tự/tên</p>
      <label>Mối quan hệ</label><div className="relation-options" role="group" aria-label="Mối quan hệ">
        {(['couple','bestie','group'] as Relation[]).map(r=><Button key={r} variant="outline" aria-pressed={album.relation===r} className={album.relation===r?'chosen':''} onClick={()=>update({relation:r})}>{r==='couple'?<Heart/>:r==='bestie'?<Users/>:<Sparkles/>}{relationships[r].label}</Button>)}
      </div><p className="field-note">{album.relation==='group'?'3–8 người · nối bằng 🤝 🫶 ✨':`2 người · nối bằng ${relationships[album.relation].connector}`}</p>
      <label htmlFor="message">Một lời nhắn</label><Textarea id="message" maxLength={160} value={album.message} onChange={e=>update({message:e.target.value})} rows={3}/>
      <div className="section-line"><h3>Những khoảnh khắc</h3><span>{album.photos.length}/30</span></div>
      {editable?<><button className="upload-zone" disabled={!!busy} onClick={()=>photoInput.current?.click()}><ImagePlus size={25}/><strong>Thêm ảnh kỷ niệm</strong><span>Chọn nhiều ảnh từ điện thoại hoặc laptop</span><small>JPG, PNG, WebP · ảnh được tự động nén</small></button>
        {album.photos.length>0&&<div className="edit-thumbnails">{album.photos.map(p=><div key={p.id}><button aria-label={`Xem ${p.caption}`} onClick={()=>openPhoto(p.id)}><img src={p.url} alt={p.caption}/></button><button className="delete-photo" aria-label={`Xóa ${p.caption}`} disabled={!!busy} onClick={()=>setRemove({id:p.id,kind:'photo'})}><Trash2 size={12}/></button></div>)}</div>}
      </>:<div className="demo-upload"><ImagePlus/><p>Ảnh kỷ niệm sẽ được thêm trong Studio riêng của hai người quản lý.</p><a href="/admin">Vào Studio</a></div>}
      <div className="section-line"><h3>Âm thanh & chuyển động</h3><Music2 size={15}/></div>
      <label htmlFor="track">Nhạc Giáng sinh không lời</label><Select value={album.music} onValueChange={v=>update({music:v as Album['music']})}><SelectTrigger id="track" className="wide-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="bells">Chuông mùa đông</SelectItem><SelectItem value="piano">Piano Giáng sinh</SelectItem>{album.audioUrl&&<SelectItem value="custom">Bản nhạc của bạn</SelectItem>}</SelectContent></Select>
      {editable&&<div className="audio-upload"><Button variant="ghost" size="sm" disabled={!!busy||!!album.audioUrl} onClick={()=>audioInput.current?.click()}><Plus size={14}/>Thêm MP3 riêng</Button>{album.audioUrl&&<Button size="icon" variant="ghost" aria-label="Xóa nhạc riêng" onClick={()=>setRemove({kind:'audio'})}><Trash2 size={15}/></Button>}</div>}
      <label htmlFor="speed">Tốc độ xoay <span className="label-right">{album.speed.toFixed(1)}×</span></label><Slider id="speed" min={.3} max={1.4} step={.1} value={[album.speed]} onValueChange={([speed])=>update({speed})}/>
      <div className="switch-row"><label htmlFor="snow">Tuyết nhẹ</label><Switch id="snow" checked={album.snow} onCheckedChange={snow=>update({snow})}/></div>
      <div className="switch-row"><label htmlFor="motion">Giảm chuyển động</label><Switch id="motion" checked={reduced} onCheckedChange={setReduced}/></div>
      {editable&&<div className="editor-actions"><Button className="green-button" disabled={!!busy} onClick={()=>void save()}>{busy?<Loader2 className="spin"/>:dirty?<Save/>:<Check/>}{busy|| (dirty?'Lưu kỷ niệm':'Lưu bộ kỷ niệm')}</Button>
        <Button className="gold-button" disabled={!!busy} onClick={()=>void save(true)}><QrCode/>Tạo QR & gửi quà</Button>
        {album.published&&<Button variant="ghost" disabled={!!busy} onClick={closeSharing}>Đóng liên kết chia sẻ</Button>}
        {album.id!=='demo'&&<Button variant="ghost" className="danger-text" disabled={!!busy} onClick={()=>setRemove({kind:'album'})}><Trash2 size={14}/>Xóa bộ kỷ niệm</Button>}
        {session?.slot===1&&<Button variant="ghost" disabled={!!busy} onClick={async()=>{try{setInvite(await api('invite'));}catch(e){toast.error((e as Error).message);}}}><Users size={14}/>Người quản lý thứ hai</Button>}
      </div>}
    </>}
    <div className="studio-note"><TreePine size={15}/><span>{editable?'Ảnh được lưu chung để hai bạn cùng quản lý.':'Một cây thông. Rất nhiều điều muốn giữ lại.'}</span></div>
  </div>;
  return <div className={`noel-app ${readOnly?'viewer':''}`}>
    <Toaster theme="dark" richColors position="bottom-center"/>
    <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple hidden onChange={e=>void upload(e.target.files,'photo')}/>
    <input hidden ref={audioInput} type="file" accept="audio/mpeg,.mp3" onChange={e=>void upload(e.target.files,'audio')}/>
    <header className="topbar"><a className="wordmark" href="/"><TreePine size={24}/><span>noël<span className="wordmark-dot">.</span></span></a><span className="topbar-center">A LITTLE CHRISTMAS MAGIC</span>
      <div className="top-actions">{editable&&<Button variant="ghost" onClick={()=>setLibrary(true)}><FolderHeart size={17}/><span>Bộ kỷ niệm</span></Button>}{!readOnly&&(admin?<a className="studio-link" href="/signout-with-chatgpt?return_to=/">Đăng xuất</a>:<a className="studio-link" href="/admin"><LockKeyhole size={14}/>Studio riêng</a>)}</div>
    </header>
    <main className="main-workspace">
      {!readOnly&&<aside className="editor-desktop">{editor}</aside>}
      <section className="experience" ref={stage} aria-label="Cây thông kỷ niệm">
        <div className="scene-title"><div className="eyebrow"><span className="tiny-star">✧</span> CHRISTMAS MEMORIES</div><h1>{album.title}</h1><p>{album.message}</p></div>
        <Scene ref={scene} album={album} playing={playing} zoom={zoom} pan={pan} reduced={reduced} onZoom={setZoom} onPan={setPan} onPhoto={openPhoto}/>
        {loading&&<div className="status-card" role="status"><Loader2 className="spin"/>Đang mở những kỷ niệm…</div>}
        {error&&<div className="status-card error-card" role="alert"><h2>Chưa mở được món quà</h2><p>{error}</p><Button variant="outline" onClick={()=>window.location.reload()}>Thử lại</Button></div>}
        {!loading&&!error&&<>
          <div className="scene-meta"><span>{relationships[album.relation].connector} {relationships[album.relation].label}</span><span>{album.photos.length} khoảnh khắc{album.id==='demo'?' · Bản xem thử':''}</span></div>
          {!album.photos.length&&<div className="empty-photos"><span>✧</span>{editable?'Thêm những bức ảnh, để kỷ niệm bắt đầu bay.':readOnly?'Những cái tên đã thắp sáng mùa Giáng sinh này.':'Thử đổi tên, rồi mở Studio để thêm ảnh của bạn.'}</div>}
          <div className="scene-toolbar">
            <div className="toolbar-group"><Button size="icon" variant="ghost" aria-label={playing?'Tạm dừng chuyển động':'Tiếp tục chuyển động'} onClick={()=>setPlaying(!playing)}>{playing?<Pause/>:<Play/>}</Button><Button size="icon" variant="ghost" aria-label="Xem lại hiệu ứng xuất hiện" onClick={()=>{scene.current?.restart();setPlaying(true);}}><RotateCcw/></Button><span className="toolbar-divider"/><Button size="icon" variant="ghost" aria-label={muted?'Bật nhạc':'Tắt nhạc'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX/>:<Music2/>}</Button><span className="music-label">{muted?'Bật nhạc':'Nhạc đang phát'}</span></div>
            <div className="toolbar-group"><Button size="icon" variant="ghost" aria-label="Thu nhỏ vùng xem" onClick={()=>setZoom(Math.max(.7,zoom-.2))}><ZoomOut/></Button><button className="zoom-value" aria-label="Đặt lại vùng xem" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>{Math.round(zoom*100)}%</button><Button size="icon" variant="ghost" aria-label="Phóng to vùng xem" onClick={()=>setZoom(Math.min(2.5,zoom+.2))}><ZoomIn/></Button><Button size="icon" variant="ghost" aria-label="Toàn màn hình" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else stage.current?.requestFullscreen?.().catch(()=>toast.info('Thiết bị này chưa hỗ trợ toàn màn hình.'));}}><Maximize2/></Button></div>
          </div>
          <div className="below-scene"><span>Chạm ảnh để mở · kéo để khám phá</span><div>{!readOnly&&<Button className="mobile-editor" variant="ghost" onClick={()=>setDrawer(true)}><SlidersHorizontal size={16}/>Chỉnh cây thông</Button>}
            {album.published&&<Button variant="ghost" onClick={()=>setShare(true)}><QrCode size={16}/><span>Chia sẻ</span></Button>}<Button variant="ghost" onClick={()=>setVideo(true)}><Download size={16}/><span>Video kỷ niệm</span></Button></div></div>
          {album.photos.length>0&&<div className="memory-strip" aria-label="Danh sách ảnh kỷ niệm">{album.photos.map((p,i)=><button key={p.id} aria-label={`Mở ảnh ${i+1}: ${p.caption}`} onClick={()=>openPhoto(p.id)}><img src={p.url} alt={p.caption} loading="lazy"/><span>{String(i+1).padStart(2,'0')}</span></button>)}</div>}
        </>}
        <audio ref={audio} src={musicSource(album)} loop preload="none"/>
      </section>
    </main>
    <Sheet open={drawer} onOpenChange={setDrawer}><SheetContent className="editor-sheet"><SheetTitle className="sr-only">Chỉnh cây thông</SheetTitle><SheetDescription className="sr-only">Tên, ảnh và âm thanh của bộ kỷ niệm</SheetDescription>{editor}</SheetContent></Sheet>
    <Dialog open={!!chosen} onOpenChange={v=>{if(!v)setPhotoId(null);}}><DialogContent className="photo-dialog"><DialogTitle>{chosen?.caption||'Một khoảnh khắc đáng nhớ'}</DialogTitle><DialogDescription>Cây thông vẫn chuyển động phía sau. Phóng to để nhìn rõ từng kỷ niệm.</DialogDescription>
      {chosen&&<div className={`photo-viewport ${photoZoom>1?'zoomed':''}`}><img key={chosen.id} src={chosen.url} alt={chosen.caption} onLoad={e=>{const rect=e.currentTarget.getBoundingClientRect();setPhotoBase({w:rect.width,h:rect.height});}} style={photoZoom>1?{width:photoBase.w*photoZoom,height:photoBase.h*photoZoom,maxWidth:'none',maxHeight:'none'}:undefined}/></div>}
      <div className="photo-controls"><Button size="icon" variant="outline" aria-label="Ảnh trước" onClick={()=>changePhoto(-1)}><ChevronLeft/></Button><span>{album.photos.findIndex(p=>p.id===photoId)+1}/{album.photos.length}</span><Button size="icon" variant="outline" aria-label="Ảnh tiếp theo" onClick={()=>changePhoto(1)}><ChevronRight/></Button><span className="toolbar-divider"/><Button size="icon" variant="ghost" aria-label="Thu nhỏ ảnh" onClick={()=>setPhotoZoom(Math.max(1,photoZoom-.25))}><ZoomOut/></Button><span>{Math.round(photoZoom*100)}%</span><Button size="icon" variant="ghost" aria-label="Phóng to ảnh" onClick={()=>setPhotoZoom(Math.min(3,photoZoom+.25))}><ZoomIn/></Button></div>
    </DialogContent></Dialog>
    <Dialog open={share} onOpenChange={setShare}><DialogContent className="share-dialog"><div className="modal-icon"><QrCode/></div><DialogTitle>Gửi một mùa Giáng sinh</DialogTitle><DialogDescription>Quét mã là mở ngay bộ kỷ niệm này. Người nhận có thể xem ảnh, nghe nhạc và tải video.</DialogDescription>
      {qr?<img className="qr-image" src={qr} alt="Mã QR mở bộ kỷ niệm"/>:<p>Đang tạo QR…</p>}<strong className="share-names">{connectedNames(album)}</strong><Input aria-label="Liên kết bộ kỷ niệm" value={shareUrl} readOnly onFocus={e=>e.target.select()}/>
      <div className="dialog-buttons"><Button className="green-button" onClick={copyLink}><Copy/>Sao chép link</Button><Button variant="outline" disabled={!qr} onClick={()=>{const a=document.createElement('a');a.download='Noel-QR.png';a.href=qr;a.click();}}><Download/>Tải QR</Button></div>
    </DialogContent></Dialog>
    <Dialog open={!!invite} onOpenChange={v=>{if(!v)setInvite(null);}}><DialogContent><DialogTitle>Studio dành cho hai người</DialogTitle><DialogDescription>{invite?.claimed?'Người quản lý thứ hai đã đăng ký.':'Gửi mã này cho người cùng quản lý với bạn. Họ mở Studio riêng, đăng nhập ChatGPT và nhập mã một lần.'}</DialogDescription>{invite?.claimed?<p>{invite.email}</p>:<><Input readOnly aria-label="Mã mời người quản lý thứ hai" value={invite?.code||''} onFocus={e=>e.target.select()}/><Button className="green-button" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/admin\nMã mời: ${invite?.code}`);toast.success('Đã sao chép link Studio và mã mời.');}catch{toast.info('Chọn và sao chép mã mời.');}}}><Copy/>Sao chép lời mời</Button></>}</DialogContent></Dialog>
    <Dialog open={video} onOpenChange={v=>{if(progress!==null){controller.current?.abort();}setVideo(v);}}><DialogContent className="video-dialog"><DialogTitle>Giữ lại phép màu</DialogTitle><DialogDescription>Video 20 giây có ảnh và nhạc nền. Giữ trang này mở trong khi xuất.</DialogDescription>
      <div className="format-toggle"><Button variant={portrait?'outline':'default'} disabled={progress!==null} onClick={()=>setPortrait(false)}>Ngang · 16:9</Button><Button variant={portrait?'default':'outline'} disabled={progress!==null} onClick={()=>setPortrait(true)}>Dọc · 9:16</Button></div>
      <Suspense fallback={<p>Đang chuẩn bị xem trước…</p>}>{video&&<VideoPreview album={album} portrait={portrait}/>}</Suspense>
      <p className="field-note">Định dạng MP4 hoặc WebM tùy trình duyệt. Chrome/Edge trên laptop được khuyến nghị để xuất video.</p>
      {progress!==null?<><progress value={progress} max={100} aria-label="Tiến độ xuất video"/><p role="status">Đang xuất video · {progress}%</p><Button variant="outline" onClick={()=>controller.current?.abort()}>Hủy xuất</Button></>:<Button className="gold-button" onClick={exportVideo}><Download/>Tải video 20 giây</Button>}
    </DialogContent></Dialog>
    <Sheet open={library} onOpenChange={setLibrary}><SheetContent className="library-sheet"><SheetTitle>Bộ kỷ niệm của hai bạn</SheetTitle><SheetDescription>Mở một bộ ảnh để chỉnh sửa hoặc gửi lại mã QR.</SheetDescription><Button className="green-button" onClick={()=>{adopt({...demo});setLibrary(false);setDrawer(true);}}><Plus/>Tạo bộ kỷ niệm mới</Button>
      {list.length?list.map(a=><button className="album-list-item" key={a.id} onClick={async()=>{if(dirty&&!window.confirm('Có thay đổi chưa lưu. Mở bộ kỷ niệm khác?'))return;setBusy('Đang mở…');try{adopt(await api<Album>(`albums/${a.id}`));setLibrary(false);}catch(e){toast.error((e as Error).message);}finally{setBusy('');}}}><TreePine/><span><strong>{a.title}</strong><small>{a.names.join(' · ')}</small></span><em>{a.published?'Đã chia sẻ':'Bản nháp'}</em></button>):<p className="field-note">Chưa có bộ kỷ niệm. Thêm tên và ảnh rồi bấm Lưu.</p>}
    </SheetContent></Sheet>
    <AlertDialog open={!!remove} onOpenChange={v=>{if(!v&&!busy)setRemove(null);}}><AlertDialogContent><AlertDialogTitle>{remove?.kind==='album'?'Xóa bộ kỷ niệm này?':remove?.kind==='audio'?'Xóa nhạc riêng?':'Xóa ảnh này?'}</AlertDialogTitle><AlertDialogDescription>{remove?.kind==='album'?'Toàn bộ ảnh và nhạc riêng sẽ bị xóa. Liên kết và QR cũ sẽ ngừng hoạt động.':'Tệp sẽ bị xóa khỏi bộ kỷ niệm này.'}</AlertDialogDescription><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>Giữ lại</AlertDialogCancel><AlertDialogAction disabled={!!busy} onClick={e=>{e.preventDefault();void removeItem();}}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
