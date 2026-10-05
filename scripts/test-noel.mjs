import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(fs.realpathSync(path.resolve('node_modules/wrangler/package.json')));
const {Miniflare}=require('miniflare');
const code='isolated-test-invitation';
const serverRoot=path.resolve('dist/server');
const modules=fs.readdirSync(serverRoot,{recursive:true}).filter(p=>p.endsWith('.js')).map(p=>({type:'ESModule',path:path.join(serverRoot,p)}));
modules.sort((a,b)=>a.path===path.join(serverRoot,'index.js')?-1:b.path===path.join(serverRoot,'index.js')?1:0);
const mf=new Miniflare({modules,modulesRoot:serverRoot,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'noel-tests'},r2Buckets:['BUCKET'],
  assets:{directory:path.resolve('dist/client'),routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
  bindings:{OWNER_EMAIL:'owner@example.test',INVITE_TWO_CODE:code,INVITE_TWO_HASH:createHash('sha256').update(code).digest('hex')},
});
const identity=(id)=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
const origin='http://noel.test';let count=0;
async function request(url,{user,method='GET',body,headers={}}={}){
  const res=await mf.dispatchFetch(`${origin}/api/noel/${url}`,{method,headers:{...(user?identity(user):{}),...(method!=='GET'?{origin}:{}),...(typeof body==='object'&&!(body instanceof Uint8Array)?{'Content-Type':'application/json'}:{}),...headers},body:typeof body==='object'&&!(body instanceof Uint8Array)?JSON.stringify(body):body});return res;
}
function check(actual,expected,message){assert.equal(actual,expected,message);count++;}
try{
  const db=await mf.getD1Database('DB');for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
    for(const sql of fs.readFileSync(`drizzle/${name}`,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql.trim()).run();
  }
  const home=await mf.dispatchFetch(origin+'/');check(home.status,200,'home renders');
  assert.match(await home.text(),/Một mùa Giáng sinh/);count++;
  const adminPage=await mf.dispatchFetch(origin+'/admin',{redirect:'manual'});check(adminPage.status,307,'admin page starts sign-in');
  assert.match(adminPage.headers.get('location'),/^\/signin-with-chatgpt/);count++;
  check((await request('albums')).status,401,'anonymous cannot list albums');
  check((await request('session')).status,200,'public session endpoint');
  check((await request('albums',{user:'outsider'})).status,403,'uninvited cannot list albums');
  const owner=await (await request('session',{user:'owner'})).json();check(owner.slot,1,'verified owner gets first slot');
  check((await (await request('invite',{user:'owner'})).json()).code,code,'owner can obtain invitation');
  check((await request('enroll',{user:'second',method:'POST',body:{code:'wrong'}})).status,403,'wrong invitation rejected');
  check((await request('enroll',{user:'second',method:'POST',body:{code}})).status,200,'second operator redeems invitation');
  check((await request('enroll',{user:'third',method:'POST',body:{code}})).status,409,'third operator rejected');
  check((await request('invite',{user:'second'})).status,403,'second cannot read invite');
  const data={title:'Giáng sinh của An và Bình',names:['An','Bình'],relation:'couple',message:'Một mùa nhớ',speed:.7,snow:true,music:'bells'};
  check((await request('albums',{user:'owner',method:'POST',body:{...data,names:['An','Bình','Chi']}})).status,400,'couple needs exactly two');
  check((await request('albums',{user:'owner',method:'POST',body:{...data,relation:'group'}})).status,400,'group needs at least three');
  const created=await request('albums',{user:'owner',method:'POST',body:data});check(created.status,201,'create draft');const album=await created.json();
  check((await request(`albums/${album.id}/media`,{user:'owner',method:'DELETE'})).status,404,'malformed media path cannot delete album');
  check((await request(`view/${album.id}`)).status,404,'anonymous cannot view draft');
  const photo=new Uint8Array([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,255,217]);
  const uploaded=await request(`albums/${album.id}/upload`,{user:'second',method:'POST',body:photo,headers:{'Content-Type':'image/jpeg'}});check(uploaded.status,201,'second can upload');
  const withPhoto=await uploaded.json(),photoId=withPhoto.photos[0].id;
  check((await request(`media/${photoId}`)).status,401,'private media requires sign-in');
  check((await request(`albums/${album.id}`,{user:'outsider',method:'PUT',body:{...data,published:true}})).status,403,'outsider cannot publish');
  check((await request(`albums/${album.id}`,{user:'owner',method:'PUT',body:{...data,published:true}})).status,200,'publish');
  const publicAlbum=await (await request(`view/${album.id}`)).json();check(publicAlbum.photos.length,1,'public device can retrieve saved photo metadata');
  const full=await request(`media/${photoId}`);check(full.status,200,'published media accessible');check((await full.arrayBuffer()).byteLength,photo.length,'R2 retains exact uploaded bytes');
  const partial=await request(`media/${photoId}`,{headers:{Range:'bytes=0-3'}});check(partial.status,206,'range requests supported');check((await partial.arrayBuffer()).byteLength,4,'range byte length');
  check((await request(`albums/${album.id}`,{user:'owner',method:'PUT',body:{...data,published:false},headers:{origin:'http://evil.test'}})).status,403,'cross origin mutation rejected');
  await request(`albums/${album.id}`,{user:'owner',method:'PUT',body:{...data,published:false}});
  check((await request(`view/${album.id}`)).status,404,'closing link revokes album');
  check((await request(`media/${photoId}`)).status,401,'closing link revokes media');
  check((await request(`albums/${album.id}`,{user:'second',method:'DELETE'})).status,200,'second can delete shared draft');
  check((await request(`albums/${album.id}`,{user:'owner'})).status,404,'deleted album is absent');
  console.log(`${count} checks passed: two operators, access boundaries, persistent media, QR target, publish/revoke, ranges and deletion.`);
}finally{await mf.dispose();}
