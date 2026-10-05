import { getChatGPTUser } from '@/app/chatgpt-auth';
import { bindings,database,operator,loadAlbum,settings,sha256,json,guarded,HttpError,checkOrigin } from '@/lib/noel/server';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,context:Context) { return guarded(async()=>{
  const {path}=await context.params;
  if(path[0]==='session') {const user=await getChatGPTUser();if(!user)return json({signedIn:false,operator:false});
    let member=false,slot=0;try{const o=await operator();member=true;slot=o.slot;}catch(e){if(!(e instanceof HttpError&&e.status===403))throw e;}return json({signedIn:true,operator:member,slot,email:user.email});}
  if(path[0]==='invite') {
    const o=await operator();if(o.slot!==1)throw new HttpError(403,'Chỉ chủ Studio mới có thể mời người quản lý.');
    const invited=await database().prepare('SELECT email FROM operators WHERE slot = 2').first<{email:string}>();
    return json(invited?{claimed:true,email:invited.email}:{claimed:false,code:bindings().INVITE_TWO_CODE});
  }
  if(path[0]==='albums') {
    await operator();if(path[1])return json(await loadAlbum(path[1],true));
    const {results}=await database().prepare('SELECT id,data,published,updated_at FROM albums ORDER BY updated_at DESC LIMIT 200').all<{id:string;data:string;published:number;updated_at:number}>();
    return json(results.map(r=>({...JSON.parse(r.data),id:r.id,published:!!r.published,updatedAt:r.updated_at,photos:[]})));
  }
  if(path[0]==='view'&&path[1]) return json(await loadAlbum(path[1]));
  if(path[0]==='media'&&path[1]) {
    const row=await database().prepare('SELECT m.*,a.published FROM media m JOIN albums a ON a.id=m.album_id WHERE m.id = ?').bind(path[1]).first<{key:string;mime:string;published:number}>();
    if(!row)throw new HttpError(404,'Không tìm thấy ảnh.');if(!row.published)await operator();
    const range=request.headers.get('range');const obj=await bindings().BUCKET.get(row.key,range?{range:request.headers}:undefined);if(!obj)throw new HttpError(404,'Không tìm thấy tệp.');
    const h=new Headers({'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});let status=200;
    if(range && obj.range && 'offset' in obj.range && obj.range.offset!==undefined){const len=obj.range.length ?? obj.size-obj.range.offset;h.set('Content-Range',`bytes ${obj.range.offset}-${obj.range.offset+len-1}/${obj.size}`);h.set('Content-Length',String(len));status=206;}
    else h.set('Content-Length',String(obj.size));return new Response(obj.body,{status,headers:h});
  }
  throw new HttpError(404,'Không tìm thấy trang.');
});}
export async function POST(request:Request,context:Context) { return guarded(async()=>{
  checkOrigin(request);const {path}=await context.params;
  if(path[0]==='enroll') {
    const user=await getChatGPTUser();if(!user)throw new HttpError(401,'Vui lòng đăng nhập trước.');
    const {code}=await request.json() as {code:unknown};if(typeof code!=='string'||code.length>100)throw new HttpError(400,'Mã quản lý không hợp lệ.');
    const hash=await sha256(code.trim());const b=bindings();const slot=hash===b.INVITE_TWO_HASH?2:0;
    if(!slot)throw new HttpError(403,'Mã quản lý không đúng.');
    const existing=await database().prepare('SELECT user_id FROM operators WHERE slot = ?').bind(slot).first<{user_id:string}>();
    if(existing&&existing.user_id!==user.userId)throw new HttpError(409,'Mã này đã được một người quản lý sử dụng.');
    if(!existing){try{await database().prepare('INSERT INTO operators (slot,user_id,email,created_at) VALUES (?,?,?,?)').bind(slot,user.userId,user.email,Date.now()).run();}catch{throw new HttpError(409,'Tài khoản hoặc vị trí quản lý đã được đăng ký.');}}
    return json({ok:true});
  }
  await operator();
  if(path[0]==='albums'&&!path[1]) {
    const data=settings.parse(await request.json());const id=crypto.randomUUID();
    await database().prepare('INSERT INTO albums (id,data,published,updated_at) VALUES (?,?,0,?)').bind(id,JSON.stringify(data),Date.now()).run();return json(await loadAlbum(id,true),201);
  }
  if(path[0]==='albums'&&path[1]&&path[2]==='upload') {
    const album=await loadAlbum(path[1],true);const kind=new URL(request.url).searchParams.get('kind')==='audio'?'audio':'photo';
    const sizeLimit=kind==='audio'?10*1024*1024:2*1024*1024;
    if(Number(request.headers.get('content-length'))>sizeLimit)throw new HttpError(413,'Tệp quá lớn.');
    const bytes=await request.arrayBuffer();if(bytes.byteLength>sizeLimit||bytes.byteLength<12)throw new HttpError(400,'Tệp không hợp lệ hoặc quá lớn.');
    const head=new Uint8Array(bytes);let mime='';
    if(kind==='photo') {
      if(head[0]===255&&head[1]===216&&head[2]===255)mime='image/jpeg';
      else if(head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71)mime='image/png';
      else if(new TextDecoder().decode(head.slice(0,4))==='RIFF'&&new TextDecoder().decode(head.slice(8,12))==='WEBP')mime='image/webp';
    }else if(new TextDecoder().decode(head.slice(0,3))==='ID3'||(head[0]===255&&(head[1]&224)===224))mime='audio/mpeg';
    if(!mime)throw new HttpError(415,kind==='audio'?'Chọn một tệp nhạc MP3.':'Chọn ảnh JPG, PNG hoặc WebP.');
    const id=crypto.randomUUID(),key=`albums/${album.id}/${id}`;
    let caption='Một khoảnh khắc đáng nhớ';try{caption=decodeURIComponent(request.headers.get('x-caption')||caption).slice(0,100);}catch{throw new HttpError(400,'Tên tệp không hợp lệ.');}
    const bucket=bindings().BUCKET;await bucket.put(key,bytes,{httpMetadata:{contentType:mime}});
    try{
      const result=await database().prepare("INSERT INTO media (id,album_id,key,kind,mime,caption,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM media WHERE album_id = ? AND kind = ?) < ?")
      .bind(id,album.id,key,kind,mime,caption,Date.now(),album.id,kind,kind==='photo'?30:1).run();
      if(!result.meta.changes)throw new HttpError(409,kind==='photo'?'Mỗi cây thông có tối đa 30 ảnh.':'Xóa nhạc riêng hiện tại trước khi thay nhạc mới.');
    }catch(e){await bucket.delete(key);throw e;}
    return json(await loadAlbum(album.id,true),201);
  }
  throw new HttpError(404,'Không tìm thấy trang.');
});}
export async function PUT(request:Request,context:Context) { return guarded(async()=>{
  checkOrigin(request);await operator();const {path}=await context.params;
  if(path[0]!=='albums'||!path[1])throw new HttpError(404,'Không tìm thấy trang.');
  await loadAlbum(path[1],true);const body=await request.json() as Record<string,unknown>;const data=settings.parse(body);
  if(body.published!==undefined&&typeof body.published!=='boolean')throw new HttpError(400,'Trạng thái chia sẻ không hợp lệ.');
  await database().prepare('UPDATE albums SET data = ?, published = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(data),body.published?1:0,Date.now(),path[1]).run();return json(await loadAlbum(path[1],true));
});}
export async function DELETE(request:Request,context:Context) { return guarded(async()=>{
  checkOrigin(request);await operator();const {path}=await context.params;
  if(path[0]!=='albums'||!path[1])throw new HttpError(404,'Không tìm thấy trang.');
  await loadAlbum(path[1],true);const db=database();
  if(path[2]==='media'&&path[3]) {
    const row=await db.prepare('SELECT key FROM media WHERE id = ? AND album_id = ?').bind(path[3],path[1]).first<{key:string}>();if(!row)throw new HttpError(404,'Không tìm thấy tệp.');
    await bindings().BUCKET.delete(row.key);await db.prepare('DELETE FROM media WHERE id = ? AND album_id = ?').bind(path[3],path[1]).run();return json(await loadAlbum(path[1],true));
  }
  if(path.length!==2)throw new HttpError(404,'Không tìm thấy trang.');
  const {results}=await db.prepare('SELECT key FROM media WHERE album_id = ?').bind(path[1]).all<{key:string}>();
  if(results.length)await bindings().BUCKET.delete(results.map(r=>r.key));
  await db.batch([db.prepare('DELETE FROM media WHERE album_id = ?').bind(path[1]),db.prepare('DELETE FROM albums WHERE id = ?').bind(path[1])]);return json({ok:true});
});}
