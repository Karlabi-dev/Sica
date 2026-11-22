import { randomUUID } from "node:crypto";
import { getPool } from "../config/database.js";

const uuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const forbidden = (req,res) => req.staff?.role !== "admin" ? (res.status(403).json({error:"Somente administradores"}),true) : false;
const validSchedule = schedule => Array.isArray(schedule)&&schedule.length<=21&&schedule.every(x=>Number.isInteger(x.weekday)&&x.weekday>=0&&x.weekday<=6&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.end)&&x.end>x.start);
async function saveSchedule(client,id,schedule){
 if(!validSchedule(schedule))throw Object.assign(new Error("Invalid schedule"),{code:"SCHEDULE"});
 await client.query("DELETE FROM public.professional_availability WHERE staff_user_id=$1",[id]);
 for(const slot of schedule)await client.query("INSERT INTO public.professional_availability(staff_user_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4)",[id,slot.weekday,slot.start,slot.end]);
}
const fail = (res,e) => {console.error("Doctor administration error",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Cadastro de médicos indisponível"});};

export async function doctorCatalog(req,res) {
 res.set("Cache-Control","no-store");
 if(forbidden(req,res)) return;
 try {
  const pool=getPool();
  const [doctors,rooms,queues]=await Promise.all([
   pool.query(`SELECT s.id,s.display_name,s.active,p.room_id,p.queue_definition_id,p.enabled,
    r.name AS room_name,q.name AS queue_name,q.queue_mode,q.stage_type
    FROM public.staff_users s LEFT JOIN public.doctor_profiles p ON p.staff_user_id=s.id
    LEFT JOIN public.rooms r ON r.id=p.room_id
    LEFT JOIN public.queue_definitions q ON q.id=p.queue_definition_id
    WHERE s.role='doctor' ORDER BY s.display_name`),
   pool.query("SELECT id,name FROM public.rooms WHERE active=true ORDER BY name"),
   pool.query("SELECT id,name,stage_type,queue_mode FROM public.queue_definitions WHERE active=true AND stage_type IN ('consultation','exam') ORDER BY name")
  ]);
  const availability=await pool.query("SELECT staff_user_id,weekday,start_time::text,end_time::text FROM public.professional_availability ORDER BY weekday,start_time");
  const specialties=await pool.query("SELECT id,name,active FROM public.specialties ORDER BY name");
  return res.json({doctors:doctors.rows.map(d=>({...d,schedule:availability.rows.filter(a=>a.staff_user_id===d.id)})),rooms:rooms.rows,queues:queues.rows,specialties:specialties.rows});
 }catch(e){return fail(res,e);}
}

export async function createDoctor(req,res) {
 res.set("Cache-Control","no-store");
 if(forbidden(req,res)) return;
 const {name,schedule=[]}=req.body??{};
 if(typeof name!=="string"||name.trim().length<3||name.trim().length>160)
  return res.status(400).json({error:"Informe um nome válido"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const uid="provisioned:sica:"+randomUUID();
  const s=await client.query(`INSERT INTO public.staff_users(firebase_uid,display_name,role,active)
   VALUES($1,$2,'doctor',true) RETURNING id`,[uid,name.trim()]);
  await client.query(`INSERT INTO public.doctor_profiles(staff_user_id,room_id,queue_definition_id)
   VALUES($1,NULL,NULL)`,[s.rows[0].id]);
  await saveSchedule(client,s.rows[0].id,schedule);
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id)
   VALUES($1,'doctor.created','staff_user',$2)`,[req.staff.id,s.rows[0].id]);
  await client.query("COMMIT");
  return res.status(201).json({id:s.rows[0].id});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="SCHEDULE")return res.status(400).json({error:"Horários inválidos"});if(e.code==="23505")return res.status(409).json({error:e.constraint==="uq_doctor_profile_room"?"Este consultório já está ocupado por outro médico ativo. Escolha outro consultório ou desative o vínculo anterior.":"Já existe um cadastro com esses dados. Verifique os vínculos de consultório e fila."});return fail(res,e);}finally{client.release();}
}

export async function updateDoctor(req,res) {
 res.set("Cache-Control","no-store");
 if(forbidden(req,res)) return;
 const {name,active,schedule=[]}=req.body??{};
 if(!uuid(req.params.id)||typeof name!=="string"||name.trim().length<3||name.trim().length>160||typeof active!=="boolean")
  return res.status(400).json({error:"Dados do médico inválidos"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const s=await client.query("UPDATE public.staff_users SET display_name=$2,active=$3,updated_at=now() WHERE id=$1 AND role='doctor' RETURNING id",[req.params.id,name.trim(),active]);
  if(!s.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Médico não encontrado"});}
  if(!active){
   const linked=await client.query("SELECT 1 FROM public.doctor_profiles p JOIN public.queue_definitions q ON q.id=p.queue_definition_id WHERE p.staff_user_id=$1 AND q.active=true LIMIT 1",[req.params.id]);
   if(linked.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Remova o médico da fila ativa antes de desativá-lo."});}
  }
  await client.query("UPDATE public.doctor_profiles SET enabled=$2,updated_at=now() WHERE staff_user_id=$1",[req.params.id,active]);
  await saveSchedule(client,req.params.id,schedule);
  if(!active) await client.query("UPDATE public.authorized_devices SET status='revoked' WHERE staff_user_id=$1 AND status='active'",[req.params.id]);
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id)
   VALUES($1,'doctor.updated','staff_user',$2)`,[req.staff.id,req.params.id]);
  await client.query("COMMIT");return res.json({status:"updated"});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="23505")return res.status(409).json({error:"Consultório já ocupado"});return fail(res,e);}finally{client.release();}
}

export async function deleteDoctor(req,res){
 res.set("Cache-Control","no-store");
 if(forbidden(req,res))return;
 if(!uuid(req.params.id))return res.status(400).json({error:"Médico inválido"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const doctor=await client.query("SELECT id,display_name,active FROM public.staff_users WHERE id=$1 AND role='doctor' FOR UPDATE",[req.params.id]);
  if(!doctor.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Médico não encontrado"});}
  if(doctor.rows[0].active){await client.query("ROLLBACK");return res.status(409).json({error:"Desative o médico antes de excluí-lo."});}
  const linked=await client.query("SELECT 1 FROM public.doctor_profiles p JOIN public.queue_definitions q ON q.id=p.queue_definition_id WHERE p.staff_user_id=$1 AND q.active=true LIMIT 1",[req.params.id]);
  if(linked.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"O médico ainda está vinculado a uma fila ativa."});}
  const active=await client.query("SELECT 1 FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.doctor_profiles dp ON dp.queue_definition_id=qs.definition_id WHERE dp.staff_user_id=$1 AND e.status IN ('waiting','called','in_service') LIMIT 1",[req.params.id]);
  if(active.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Existe atendimento ativo na fila do médico. Finalize os atendimentos antes de excluí-lo."});}
  await client.query("UPDATE public.staff_users SET active=false,updated_at=now() WHERE id=$1",[req.params.id]);
  await client.query("UPDATE public.doctor_profiles SET enabled=false,queue_definition_id=NULL,room_id=NULL,updated_at=now() WHERE staff_user_id=$1",[req.params.id]);
  await client.query("UPDATE public.authorized_devices SET status='revoked' WHERE staff_user_id=$1 AND status='active'",[req.params.id]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'doctor.archived','staff_user',$2,$3::jsonb)",[req.staff.id,req.params.id,JSON.stringify({name:doctor.rows[0].display_name})]);
  await client.query("COMMIT");return res.json({status:"archived"});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});return fail(res,e);}finally{client.release();}
}
