import Noel from '@/components/noel/Noel';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/admin');return <Noel admin />;}
