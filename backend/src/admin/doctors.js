import { randomUUID } from "node:crypto";
import { getPool } from "../config/database.js";

const uuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const forbidden = (req,res) => req.staff?.role !== "admin" ? (res.status(403).json({error:"Somente administradores"}),true) : false;
const validSchedule = schedule => Array.isArray(schedule)&&schedule.length<=21&&schedule.every(x=>Number.isInteger(x.weekday)&&x.weekday>=0&&x.weekday<=6&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.end)&&x.end>x.start);
async function saveSchedule(client,id,specialtyId,schedule){
 if(!validSchedule(schedule))throw Object.assign(new Error("Invalid schedule"),{code:"SCHEDULE"});
 if(specialtyId){if(!uuid(specialtyId))throw Object.assign(new Error("Invalid specialty"),{code:"SCHEDULE"});await client.query("INSERT INTO public.professional_specialties(staff_user_id,specialty_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[id,specialtyId]);}
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
 const {name,roomId,queueId,specialtyId,schedule=[]}=req.body??{};
 if(typeof name!=="string"||name.trim().length<3||name.trim().length>160||!uuid(roomId)||!uuid(queueId))
  return res.status(400).json({error:"Informe nome, consultório e fila válidos"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const valid=await client.query(`SELECT q.id,q.queue_mode FROM public.queue_definitions q
   JOIN public.rooms r ON r.id=$2 AND r.active=true
   WHERE q.id=$1 AND q.active=true AND q.stage_type IN ('consultation','exam')`,[queueId,roomId]);
  if(!valid.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"Fila ou consultório indisponível"});}
  if(valid.rows[0].queue_mode==="individual"){
   const taken=await client.query("SELECT 1 FROM public.doctor_profiles WHERE queue_definition_id=$1 AND enabled=true",[queueId]);
   if(taken.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Esta fila individual já possui um médico"});}
  }
  const uid="provisioned:sica:"+randomUUID();
  const s=await client.query(`INSERT INTO public.staff_users(firebase_uid,display_name,role,active)
   VALUES($1,$2,'doctor',true) RETURNING id`,[uid,name.trim()]);
  await client.query(`INSERT INTO public.doctor_profiles(staff_user_id,room_id,queue_definition_id)
   VALUES($1,$2,$3)`,[s.rows[0].id,roomId,queueId]);
  await saveSchedule(client,s.rows[0].id,specialtyId,schedule);
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id)
   VALUES($1,'doctor.created','staff_user',$2)`,[req.staff.id,s.rows[0].id]);
  await client.query("COMMIT");
  return res.status(201).json({id:s.rows[0].id});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="SCHEDULE")return res.status(400).json({error:"Horários ou especialidade inválidos"});if(e.code==="23505")return res.status(409).json({error:"Consultório já vinculado a outro médico ativo"});return fail(res,e);}finally{client.release();}
}

export async function updateDoctor(req,res) {
 res.set("Cache-Control","no-store");
 if(forbidden(req,res)) return;
 const {name,roomId,queueId,active,specialtyId,schedule=[]}=req.body??{};
 if(!uuid(req.params.id)||typeof name!=="string"||name.trim().length<3||name.trim().length>160||!uuid(roomId)||!uuid(queueId)||typeof active!=="boolean")
  return res.status(400).json({error:"Dados do médico inválidos"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const q=await client.query(`SELECT q.queue_mode FROM public.queue_definitions q JOIN public.rooms r ON r.id=$2 AND r.active=true
   WHERE q.id=$1 AND q.active=true AND q.stage_type IN ('consultation','exam')`,[queueId,roomId]);
  if(!q.rowCount){await client.query("ROLLBACK");return res.status(400).json({error:"Fila ou consultório inválido"});}
  if(active&&q.rows[0].queue_mode==="individual"){
   const taken=await client.query("SELECT 1 FROM public.doctor_profiles WHERE queue_definition_id=$1 AND staff_user_id<>$2 AND enabled=true",[queueId,req.params.id]);
   if(taken.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Fila individual ocupada"});}
  }
  const s=await client.query("UPDATE public.staff_users SET display_name=$2,active=$3,updated_at=now() WHERE id=$1 AND role='doctor' RETURNING id",[req.params.id,name.trim(),active]);
  if(!s.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Médico não encontrado"});}
  await client.query(`INSERT INTO public.doctor_profiles(staff_user_id,room_id,queue_definition_id,enabled)
   VALUES($1,$2,$3,$4) ON CONFLICT(staff_user_id) DO UPDATE
   SET room_id=EXCLUDED.room_id,queue_definition_id=EXCLUDED.queue_definition_id,enabled=EXCLUDED.enabled,updated_at=now()`,[req.params.id,roomId,queueId,active]);
  await saveSchedule(client,req.params.id,specialtyId,schedule);
  if(!active) await client.query("UPDATE public.authorized_devices SET status='revoked' WHERE staff_user_id=$1 AND status='active'",[req.params.id]);
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id)
   VALUES($1,'doctor.updated','staff_user',$2)`,[req.staff.id,req.params.id]);
  await client.query("COMMIT");return res.json({status:"updated"});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="23505")return res.status(409).json({error:"Consultório já ocupado"});return fail(res,e);}finally{client.release();}
}
