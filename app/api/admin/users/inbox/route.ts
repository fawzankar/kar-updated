import { NextResponse } from 'next/server'
import { ensureSchema, pool } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
function asId(value:string|null){const id=Number(value);return Number.isSafeInteger(id)&&id>0?id:null}
export async function GET(request:Request){
  await ensureSchema(); const user=await getCurrentUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401}); if(user.role!=='owner')return NextResponse.json({error:'Owner access required.'},{status:403})
  const id=asId(new URL(request.url).searchParams.get('userId')); if(!id)return NextResponse.json({error:'Invalid user.'},{status:400})
  const target=await pool.query('SELECT id,username,display_name AS "displayName",active FROM users WHERE id=$1 LIMIT 1',[id]); if(!target.rows[0])return NextResponse.json({error:'User not found.'},{status:404})
  const result=await pool.query(`SELECT m.id,m.text,m.sender_name AS "senderName",m.media_data AS "mediaData",m.media_type AS "mediaType",m.media_transcript AS "mediaTranscript",m.is_read AS "isRead",m.kept,m.created_at AS time,COALESCE(json_agg(json_build_object('id',r.id,'text',r.text,'time',r.created_at,'author',r.author,'mediaUrl',r.media_url,'mediaType',r.media_type) ORDER BY r.created_at ASC,r.id ASC) FILTER(WHERE r.id IS NOT NULL),'[]') AS replies FROM messages m LEFT JOIN responses r ON r.message_id=m.id WHERE m.user_id=$1 AND m.deleted_at IS NULL GROUP BY m.id ORDER BY m.created_at DESC`,[id])
  return NextResponse.json({user:target.rows[0],messages:result.rows.map(m=>({...m,id:Number(m.id),replies:m.replies.map((r:any)=>({...r,id:Number(r.id)}))}))},{headers:{'Cache-Control':'no-store'}})
}
