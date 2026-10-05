import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { z } from 'zod';
import type { Album, Photo } from './types';
type Bindings = { DB: D1Database; BUCKET: R2Bucket; OWNER_EMAIL?: string; INVITE_TWO_HASH?: string; INVITE_TWO_CODE?: string };
export function bindings() { const b=env as unknown as Bindings; if(!b.DB || !b.BUCKET) throw new Error('Storage unavailable'); return b; }
export function database() { return bindings().DB; }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function operator() {
  const user=await getChatGPTUser(); if(!user) throw new HttpError(401,'Vui lòng đăng nhập bằng ChatGPT.');
  let member=await database().prepare('SELECT slot FROM operators WHERE user_id = ?').bind(user.userId).first<{slot:number}>();
  if(!member&&bindings().OWNER_EMAIL?.toLowerCase()===user.email.toLowerCase()){
    await database().prepare('INSERT OR IGNORE INTO operators (slot,user_id,email,created_at) VALUES (1,?,?,?)').bind(user.userId,user.email,Date.now()).run();
    member=await database().prepare('SELECT slot FROM operators WHERE user_id = ?').bind(user.userId).first<{slot:number}>();
  }
  if(!member) throw new HttpError(403,'Tài khoản này chưa có quyền quản lý.'); return {...user,slot:member.slot};
}
export const settings = z.object({title:z.string().trim().min(1).max(80),names:z.array(z.string().trim().min(1).max(24)).min(2).max(8),
  relation:z.enum(['couple','bestie','group']),message:z.string().trim().max(160),speed:z.number().min(.3).max(1.4),snow:z.boolean(),
  music:z.enum(['bells','piano','custom'])}).superRefine((a,c)=>{
    if(a.relation==='group' ? a.names.length<3 : a.names.length!==2) c.addIssue({code:'custom',path:['names'],message:a.relation==='group'?'Nhóm bạn cần 3–8 tên.':'Mối quan hệ này cần đúng 2 tên.'});
  });
export async function loadAlbum(id:string, admin=false):Promise<Album> {
  const row=await database().prepare('SELECT * FROM albums WHERE id = ?').bind(id).first<{id:string;data:string;published:number;updated_at:number}>();
  if(!row || (!row.published&&!admin)) throw new HttpError(404,'Bộ kỷ niệm chưa được chia sẻ hoặc đã đóng.');
  const {results}=await database().prepare('SELECT id, kind, caption FROM media WHERE album_id = ? ORDER BY created_at, id').bind(id).all<{id:string;kind:string;caption:string}>();
  const photos:Photo[]=results.filter(m=>m.kind==='photo').map(m=>({id:m.id,url:`/api/noel/media/${m.id}`,caption:m.caption}));
  const audio=results.find(m=>m.kind==='audio');
  return {...JSON.parse(row.data),id:row.id,published:!!row.published,updatedAt:row.updated_at,photos,audioUrl:audio?`/api/noel/media/${audio.id}`:undefined};
}
export async function sha256(value:string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
export function json(value:unknown,status=200) { return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
export function checkOrigin(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin) throw new HttpError(403,'Yêu cầu không hợp lệ.');
}
export async function guarded(work:()=>Promise<Response>) { try{return await work();}catch(e){
  if(e instanceof HttpError)return json({error:e.message},e.status);
  if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Thông tin không hợp lệ.'},400);
  console.error('Noel request failed',e instanceof Error?e.message:'Unknown error');return json({error:'Không thể kết nối kho kỷ niệm. Vui lòng thử lại.'},503);
} }
