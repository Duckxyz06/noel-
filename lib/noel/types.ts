export type Relation = 'couple' | 'bestie' | 'group';
export type Photo = { id: string; url: string; caption: string };
export type Album = {
  id: string; title: string; names: string[]; relation: Relation; message: string;
  speed: number; snow: boolean; music: 'bells' | 'piano' | 'custom';
  photos: Photo[]; audioUrl?: string; published: boolean; updatedAt?: number;
};
export const relationships: Record<Relation, {label:string; connector:string}> = {
  couple: {label:'Người yêu',connector:'♥'}, bestie: {label:'Bạn thân',connector:'🫶'},
  group: {label:'Nhóm bạn',connector:'🤝 🫶 ✨'},
};
export const demo: Album = {id:'demo',title:'Một mùa Giáng sinh, cùng nhau',names:['An','Bình'],relation:'couple',
  message:'Có những khoảnh khắc, chỉ cần bên nhau là đủ.',speed:0.7,snow:true,music:'bells',photos:[],published:false};
export function connectedNames(album: Pick<Album,'names'|'relation'>) {
  const connectors = [relationships[album.relation].connector];
  return album.names.map((n,i)=>i ? `${connectors[(i-1)%connectors.length]} ${n}` : n).join(' ');
}
