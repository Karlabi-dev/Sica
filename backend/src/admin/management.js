import { getPool } from "../config/database.js";
import { decryptTrackingToken } from "../security/trackingToken.js";
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const admin=(req,res)=>req.staff?.role!=="admin"?(res.status(403).json({error:"Acesso restrito à administração"}),false):true;
const fail=(res,e)=>{console.error("Admin management failed",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível consultar ou salvar no banco"});};
export async function adminPatients(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 try{
  const {rows}=await getPool().query(`SELECT j.id AS journey_id,j.started_at,j.completed_at,j.status AS journey_status,
   p.full_name,p.phone,(SELECT e.ticket_code FROM public.queue_entries e WHERE e.journey_id=j.id ORDER BY e.enqueued_at ASC LIMIT 1) AS ticket_code,
   (SELECT e.status FROM public.queue_entries e WHERE e.journey_id=j.id ORDER BY e.enqueued_at DESC,e.id DESC LIMIT 1) AS current_status
   FROM public.patient_journeys j LEFT JOIN public.patients p ON p.id=j.patient_id
   ORDER BY j.started_at DESC LIMIT 500`);
  return res.json({patients:rows});
 }catch(e){return fail(res,e);}
}
export async function adminPatientJourney(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 if(!uuid(req.params.id))return res.status(400).json({error:"Identificador inválido"});
 try{
  const pool=getPool();
  const journey=(await pool.query(`SELECT j.id,j.started_at,j.completed_at,j.status,p.full_name,p.phone,j.tracking_expires_at,j.tracking_revoked_at,j.tracking_token_encrypted
    FROM public.patient_journeys j LEFT JOIN public.patients p ON p.id=j.patient_id WHERE j.id=$1`,[req.params.id])).rows[0];
  if(!journey)return res.status(404).json({error:"Jornada não encontrada"});
  const {rows}=await pool.query(`SELECT e.id,e.ticket_code,e.status,e.enqueued_at,e.called_at,e.service_started_at,e.service_finished_at,
   q.name AS queue_name,q.stage_type,r.name AS room_name
   FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
   JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions q ON q.id=qs.definition_id
   LEFT JOIN LATERAL (SELECT room_id FROM public.call_events c WHERE c.queue_entry_id=e.id ORDER BY c.called_at DESC LIMIT 1) ce ON true
   LEFT JOIN public.rooms r ON r.id=ce.room_id WHERE e.journey_id=$1 ORDER BY e.enqueued_at,e.id`,[req.params.id]);
  const {tracking_token_encrypted,tracking_expires_at,tracking_revoked_at,...safe}=journey;
  let trackingToken=null;
  if(tracking_token_encrypted&&!tracking_revoked_at&&new Date(tracking_expires_at)>new Date()&&journey.status!=="completed")trackingToken=decryptTrackingToken(tracking_token_encrypted);
  await pool.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id) VALUES($1,'patient.history.viewed','patient_journey',$2)",[req.staff.id,req.params.id]);
  return res.json({journey:safe,events:rows,trackingToken});
 }catch(e){return fail(res,e);}
}
export async function adminReturnToQueue(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {entryId}=req.params;const reason=typeof req.body?.reason==="string"?req.body.reason.trim():"";
 if(!uuid(entryId)||reason.length<10||reason.length>300)return res.status(400).json({error:"Informe um motivo entre 10 e 300 caracteres."});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const result=await client.query(`SELECT e.id,e.queue_id,e.journey_id,e.status,e.service_started_at,e.service_finished_at,e.legal_priority,qs.ends_at,
    qd.active AS queue_active,qs.status AS session_status,qi.active AS instance_active,j.status AS journey_status
    FROM public.queue_entries e
    JOIN public.queue_instances qi ON qi.id=e.queue_id
    JOIN public.queue_sessions qs ON qs.id=qi.session_id
    JOIN public.queue_definitions qd ON qd.id=qs.definition_id
    JOIN public.patient_journeys j ON j.id=e.journey_id
    WHERE e.id=$1 FOR UPDATE OF e,j`,[entryId]);
  const e=result.rows[0];
  if(!e){await client.query("ROLLBACK");return res.status(404).json({error:"Atendimento não encontrado"});}
  if(!["completed","no_show","cancelled"].includes(e.status)||!e.service_finished_at||Date.now()-new Date(e.service_finished_at).getTime()>=3600000||e.journey_status==="completed"){
   await client.query("ROLLBACK");return res.status(409).json({error:"Somente atendimentos encerrados ou ausentes podem voltar à fila em até uma hora."});
  }
  if(!e.queue_active||!e.instance_active||e.session_status!=="active"||new Date(e.ends_at)<=new Date()){
   await client.query("ROLLBACK");return res.status(409).json({error:"A fila não está ativa. Não é possível devolver o paciente."});
  }
  const duplicate=await client.query("SELECT 1 FROM public.queue_entries WHERE journey_id=$1 AND id<>$2 AND status IN ('waiting','called','in_service') LIMIT 1",[e.journey_id,entryId]);
  if(duplicate.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"O paciente já possui outro atendimento ativo."});}
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["admin-return:"+e.queue_id]);
  const first=await client.query("SELECT MIN(enqueued_at) AS first FROM public.queue_entries WHERE queue_id=$1 AND status='waiting' AND legal_priority=$2",[e.queue_id,e.legal_priority]);
  const position=new Date();
  await client.query("UPDATE public.queue_entries SET status='waiting',enqueued_at=$2,called_at=NULL,service_started_at=NULL,service_finished_at=NULL WHERE id=$1",[entryId,position]);
  if(e.journey_status==="cancelled")await client.query("UPDATE public.patient_journeys SET status='active',completed_at=NULL,tracking_revoked_at=NULL WHERE id=$1",[e.journey_id]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'patient.returned_to_queue','queue_entry',$2,$3::jsonb)",[req.staff.id,entryId,JSON.stringify({reason,previousStatus:e.status,queueId:e.queue_id})]);
  await client.query("COMMIT");return res.json({status:"waiting",message:"Paciente devolvido à fila, na sua categoria original."});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Admin return to queue failed",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível devolver o paciente à fila."});}finally{client.release();}
}
export async function adminCloseAttendance(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {entryId}=req.params;const reason=typeof req.body?.reason==="string"?req.body.reason.trim():"";
 if(!uuid(entryId)||reason.length<10||reason.length>300)return res.status(400).json({error:"Informe um motivo entre 10 e 300 caracteres."});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const result=await client.query(`SELECT e.id,e.status,e.journey_id,e.queue_id,j.status AS journey_status
    FROM public.queue_entries e JOIN public.patient_journeys j ON j.id=e.journey_id
    WHERE e.id=$1 FOR UPDATE OF j,e`,[entryId]);
  const entry=result.rows[0];
  if(!entry){await client.query("ROLLBACK");return res.status(404).json({error:"Atendimento não encontrado."});}
  if(!["waiting","called","in_service"].includes(entry.status)||["completed","cancelled"].includes(entry.journey_status)){
   await client.query("ROLLBACK");return res.status(409).json({error:"Este atendimento não está ativo ou a jornada já foi encerrada."});
  }
  await client.query("UPDATE public.queue_entries SET status='cancelled',service_finished_at=now() WHERE id=$1",[entryId]);
  const other=await client.query("SELECT 1 FROM public.queue_entries WHERE journey_id=$1 AND id<>$2 AND status IN ('waiting','called','in_service') LIMIT 1",[entry.journey_id,entryId]);
  if(!other.rowCount)await client.query("UPDATE public.patient_journeys SET status='cancelled',completed_at=now(),tracking_revoked_at=now() WHERE id=$1",[entry.journey_id]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'attendance.administratively_closed','queue_entry',$2,$3::jsonb)",[req.staff.id,entryId,JSON.stringify({reason,previousStatus:entry.status,journeyId:entry.journey_id,queueId:entry.queue_id})]);
  await client.query("COMMIT");return res.json({status:"cancelled",message:"Atendimento encerrado administrativamente. Não representa conclusão clínica."});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});console.error("Admin attendance close failed",{code:error.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível encerrar o atendimento."});}finally{client.release();}
}
export async function adminAudit(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const action=typeof req.query.action==="string"?req.query.action.slice(0,100):"";
 const from=typeof req.query.from==="string"?req.query.from:"";
 const to=typeof req.query.to==="string"?req.query.to:"";
 const actor=typeof req.query.actor==="string"?req.query.actor.slice(0,160):"";
 if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))return res.status(400).json({error:"Datas inválidas"});
 try{
  const {rows}=await getPool().query(`SELECT a.id,a.created_at,a.action,a.resource_type,a.resource_id,a.request_id,a.metadata,
   s.display_name AS actor_name,s.role AS actor_role, qe.ticket_code,qd.name AS queue_name FROM public.audit_events a
   LEFT JOIN public.staff_users s ON s.id=a.actor_user_id
   LEFT JOIN public.queue_entries qe ON qe.id=a.resource_id AND a.resource_type='queue_entry'
   LEFT JOIN public.queue_instances qi ON qi.id=qe.queue_id
   LEFT JOIN public.queue_sessions qs ON qs.id=qi.session_id
   LEFT JOIN public.queue_definitions qd ON qd.id=qs.definition_id
   WHERE ($1='' OR a.action ILIKE '%'||$1||'%') AND ($2='' OR a.created_at >= $2::date)
   AND ($3='' OR a.created_at < $3::date+interval '1 day') AND ($4='' OR s.display_name ILIKE '%'||$4||'%')
   ORDER BY a.created_at DESC,a.id DESC LIMIT 500`,[action,from,to,actor]);
  return res.json({events:rows});
 }catch(e){return fail(res,e);}
}
export async function adminCatalog(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 try{
  const pool=getPool();const [specialties,rooms,queues,doctors]=await Promise.all([
   pool.query("SELECT id,name,active FROM public.specialties ORDER BY name"),
   pool.query("SELECT id,name,active FROM public.rooms ORDER BY name"),
   pool.query(`SELECT q.id,q.name,q.stage_type,q.queue_mode,q.specialty_id,q.active,
    s.name AS specialty_name FROM public.queue_definitions q LEFT JOIN public.specialties s ON s.id=q.specialty_id
    WHERE q.stage_type IN ('consultation','exam') ORDER BY q.name`),
   pool.query(`SELECT s.id,s.display_name,s.active,p.room_id,p.queue_definition_id FROM public.staff_users s
    JOIN public.doctor_profiles p ON p.staff_user_id=s.id WHERE s.role='doctor' ORDER BY s.display_name`)
  ]);return res.json({specialties:specialties.rows,rooms:rooms.rows,queues:queues.rows,doctors:doctors.rows});
 }catch(e){return fail(res,e);}
}
export async function adminCatalogWrite(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {kind,id}=req.params;const {name,active}=req.body??{};
 if(!["specialties","rooms"].includes(kind)||id&&!uuid(id)||typeof name!=="string"||name.trim().length<2||name.trim().length>100||typeof active!=="boolean")
  return res.status(400).json({error:"Dados inválidos"});
 const table=kind==="rooms"?"rooms":"specialties";const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  if(id&&!active){
   const current=await client.query(`SELECT active FROM public.${table} WHERE id=$1 FOR UPDATE`,[id]);
   if(!current.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Registro não encontrado"});}
   if(current.rows[0].active){
    const linked=kind==="specialties"?
     await client.query("SELECT 1 FROM public.queue_definitions WHERE specialty_id=$1 AND active=true LIMIT 1",[id]):
     await client.query("SELECT 1 FROM public.doctor_profiles p JOIN public.queue_definitions q ON q.id=p.queue_definition_id WHERE p.room_id=$1 AND p.enabled=true AND q.active=true LIMIT 1",[id]);
    if(linked.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:kind==="specialties"?"Desative primeiro todas as filas ativas desta especialidade.":"Este consultório está vinculado a uma fila ativa. Desvincule-o antes de desativar."});}
   }
  }
  const result=id?await client.query(`UPDATE public.${table} SET name=$2,active=$3 WHERE id=$1 RETURNING id`,[id,name.trim(),active]):
   await client.query(`INSERT INTO public.${table}(name,active) VALUES($1,$2) RETURNING id`,[name.trim(),active]);
  if(!result.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Registro não encontrado"});}
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4)",[req.staff.id,id?"catalog.updated":"catalog.created",table,result.rows[0].id]);
  await client.query("COMMIT");return res.json({id:result.rows[0].id});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="23505")return res.status(409).json({error:"Já existe um registro com este nome"});return fail(res,e);}finally{client.release();}
}
export async function adminSeedSpecialties(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const names=["Clínica Geral","Pediatria","Cardiologia","Dermatologia","Ginecologia","Ortopedia e Traumatologia","Neurologia","Oftalmologia","Endocrinologia","Psiquiatria"];
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const result=await client.query(`INSERT INTO public.specialties(name,active)
   SELECT n,true FROM unnest($1::text[]) AS n
   WHERE NOT EXISTS(SELECT 1 FROM public.specialties s WHERE lower(trim(s.name))=lower(trim(n)))
   ON CONFLICT(name) DO NOTHING RETURNING id`,[names]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,metadata) VALUES($1,'specialties.seeded','specialties',$2::jsonb)",[req.staff.id,JSON.stringify({created:result.rowCount})]);
  await client.query("COMMIT");
  return res.json({created:result.rowCount,total:names.length});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});return fail(res,e);}finally{client.release();}
}
export async function adminCatalogDelete(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {kind,id}=req.params;
 if(!["specialties","rooms"].includes(kind)||!uuid(id))return res.status(400).json({error:"Registro inválido"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const found=await client.query(`SELECT id,name,active FROM public.${kind} WHERE id=$1 FOR UPDATE`,[id]);
  if(!found.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Registro não encontrado"});}
  if(found.rows[0].active){await client.query("ROLLBACK");return res.status(409).json({error:"Desative o registro antes de excluí-lo."});}
  if(kind==="specialties"){
   const linked=await client.query(`SELECT
    (SELECT count(*)::int FROM public.queue_definitions WHERE specialty_id=$1) AS queues,
    (SELECT count(*)::int FROM public.professional_specialties WHERE specialty_id=$1) AS doctors`,[id]);
   if(linked.rows[0].queues||linked.rows[0].doctors){
    await client.query("ROLLBACK");
    return res.status(409).json({error:"Esta especialidade está vinculada a filas ou médicos. Desative-a para preservar os vínculos e o histórico."});
   }
  }
  if(kind==="rooms"){
   const linked=await client.query(`SELECT
    (SELECT count(*)::int FROM public.doctor_profiles WHERE room_id=$1) AS doctors,
    (SELECT count(*)::int FROM public.session_professionals WHERE room_id=$1) AS sessions,
    (SELECT count(*)::int FROM public.call_events WHERE room_id=$1) AS calls`,[id]);
   if(Object.values(linked.rows[0]).some(Boolean)){
    await client.query("ROLLBACK");
    return res.status(409).json({error:"Este consultório possui vínculos ou histórico. Desative-o em vez de excluir."});
   }
  }
  await client.query(`DELETE FROM public.${kind} WHERE id=$1`,[id]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'catalog.deleted',$2,$3,$4::jsonb)",[req.staff.id,kind,id,JSON.stringify({name:found.rows[0].name})]);
  await client.query("COMMIT");
  return res.json({deleted:true});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});if(e.code==="23503")return res.status(409).json({error:"Registro vinculado a outros dados. Desative-o em vez de excluir."});return fail(res,e);}
 finally{client.release();}
}
export async function adminQueuesWrite(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {name,specialtyId,doctorIds,queueMode,active}=req.body??{};
 if(typeof name!=="string"||name.trim().length<2||name.trim().length>120||!uuid(specialtyId)||!Array.isArray(doctorIds)||doctorIds.length>30||!doctorIds.every(uuid)||new Set(doctorIds).size!==doctorIds.length||!["shared","individual"].includes(queueMode)||typeof active!=="boolean")
  return res.status(400).json({error:"Selecione especialidade e modalidade"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const valid=await client.query("SELECT id FROM public.staff_users WHERE id=ANY($1::uuid[]) AND role='doctor' AND active=true",[doctorIds]);
  if(valid.rowCount!==doctorIds.length){await client.query("ROLLBACK");return res.status(409).json({error:"Um ou mais médicos estão inativos"});}
  const specialty=await client.query("SELECT 1 FROM public.specialties WHERE id=$1 AND active=true",[specialtyId]);
  if(!specialty.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Especialidade inativa"});}
  if(queueMode==="individual"&&doctorIds.length!==1){await client.query("ROLLBACK");return res.status(400).json({error:"Fila individual exige exatamente um médico"});}
  for(const doctorId of doctorIds){
   const previous=await client.query("SELECT queue_definition_id FROM public.doctor_profiles WHERE staff_user_id=$1 FOR UPDATE",[doctorId]);
   if(!previous.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Cadastre o consultório do médico antes de configurar a fila"});}
   const occupied=await client.query("SELECT 1 FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id WHERE qs.definition_id=$1 AND e.status IN ('waiting','called','in_service') LIMIT 1",[previous.rows[0].queue_definition_id]);
   if(previous.rows[0].queue_definition_id&&occupied.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Existem pacientes ativos na fila anterior. Conclua os atendimentos antes de alterar a equipe"});}
  }
  const q=await client.query(`INSERT INTO public.queue_definitions(name,stage_type,specialty_id,queue_mode,active)
   VALUES($1,'consultation',$2,$3,$4) RETURNING id`,[name.trim(),specialtyId,queueMode,active]);
  for(const doctorId of doctorIds){
   await client.query("UPDATE public.doctor_profiles SET queue_definition_id=$2,updated_at=now() WHERE staff_user_id=$1",[doctorId,q.rows[0].id]);
   await client.query("INSERT INTO public.professional_specialties(staff_user_id,specialty_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[doctorId,specialtyId]);
  }
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'queue.configured','queue_definition',$2,$3::jsonb)",[req.staff.id,q.rows[0].id,JSON.stringify({mode:queueMode,doctorCount:doctorIds.length})]);
  await client.query("COMMIT");return res.status(201).json({id:q.rows[0].id});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});return fail(res,e);}finally{client.release();}
}
