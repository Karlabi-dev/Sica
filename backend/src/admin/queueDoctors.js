import {getPool} from "../config/database.js";
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function updateQueueDoctors(req,res){
 res.set("Cache-Control","no-store");
 if(req.staff?.role!=="admin")return res.status(403).json({error:"Somente administradores"});
 const {id}=req.params,{doctorIds}=req.body??{};
 if(!uuid(id)||!Array.isArray(doctorIds)||doctorIds.length>30||!doctorIds.every(uuid)||new Set(doctorIds).size!==doctorIds.length)return res.status(400).json({error:"Seleção de médicos inválida"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const queue=await client.query("SELECT id,queue_mode,specialty_id FROM public.queue_definitions WHERE id=$1 FOR UPDATE",[id]);
  if(!queue.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Fila não encontrada"});}
  if(queue.rows[0].queue_mode==="individual"&&doctorIds.length!==1){await client.query("ROLLBACK");return res.status(400).json({error:"Fila individual exige exatamente um médico"});}
  const existing=await client.query("SELECT staff_user_id FROM public.doctor_profiles WHERE queue_definition_id=$1 FOR UPDATE",[id]);
  const oldIds=existing.rows.map(x=>x.staff_user_id);
  const removed=oldIds.filter(x=>!doctorIds.includes(x));
  if(removed.length){
   const active=await client.query("SELECT 1 FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id WHERE qs.definition_id=$1 AND e.status IN ('waiting','called','in_service') LIMIT 1",[id]);
   if(active.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Há pacientes ativos. Não remova médicos desta fila durante os atendimentos"});}
  }
  for(const doctorId of doctorIds){
   const d=await client.query("SELECT p.queue_definition_id FROM public.doctor_profiles p JOIN public.staff_users s ON s.id=p.staff_user_id WHERE s.id=$1 AND s.role='doctor' AND s.active=true AND p.enabled=true FOR UPDATE OF p",[doctorId]);
   if(!d.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Médico inativo ou sem consultório"});}
   if(d.rows[0].queue_definition_id&&d.rows[0].queue_definition_id!==id){await client.query("ROLLBACK");return res.status(409).json({error:"Médico vinculado a outra fila. Remova-o da fila anterior antes"});}
  }
  await client.query("UPDATE public.doctor_profiles SET queue_definition_id=NULL,updated_at=now() WHERE queue_definition_id=$1 AND NOT(staff_user_id=ANY($2::uuid[]))",[id,doctorIds]);
  for(const doctorId of doctorIds){
   await client.query("UPDATE public.doctor_profiles SET queue_definition_id=$2,updated_at=now() WHERE staff_user_id=$1",[doctorId,id]);
   if(queue.rows[0].specialty_id)await client.query("INSERT INTO public.professional_specialties(staff_user_id,specialty_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[doctorId,queue.rows[0].specialty_id]);
  }
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'queue.doctors.updated','queue_definition',$2,$3::jsonb)",[req.staff.id,id,JSON.stringify({doctorCount:doctorIds.length})]);
  await client.query("COMMIT");return res.json({id,doctorIds});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Queue membership failed",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível atualizar os médicos da fila"});}finally{client.release();}
}
