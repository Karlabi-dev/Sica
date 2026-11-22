import { getPool } from "../config/database.js";
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const deny=(req,res)=>req.staff?.role!=="doctor"?(res.status(403).json({error:"Acesso exclusivo do médico"}),true):false;
const fail=(res,e)=>{console.error("Medical queue error",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Fila médica temporariamente indisponível"});};
const scope=`SELECT p.staff_user_id,p.room_id,p.queue_definition_id,q.queue_mode,r.name AS room_name,q.name AS queue_name,s.display_name
 FROM public.doctor_profiles p JOIN public.staff_users s ON s.id=p.staff_user_id
 JOIN public.rooms r ON r.id=p.room_id JOIN public.queue_definitions q ON q.id=p.queue_definition_id
 WHERE p.staff_user_id=$1 AND p.enabled=true AND s.active=true AND r.active=true AND q.active=true`;
const entries=`SELECT e.id,e.ticket_code,e.status,e.legal_priority,e.payment_category,e.enqueued_at,e.called_at,
 p.full_name AS patient_name
 FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
 JOIN public.queue_sessions qs ON qs.id=qi.session_id
 JOIN public.patient_journeys j ON j.id=e.journey_id
 LEFT JOIN public.patients p ON p.id=j.patient_id
 WHERE qs.definition_id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now()
 AND qi.active=true AND ($2='shared' AND qi.professional_id IS NULL OR $2='individual' AND qi.professional_id=$3)
 AND e.status IN ('waiting','called','in_service')
 ORDER BY CASE WHEN e.status='in_service' THEN 0 WHEN e.status='called' THEN 1 ELSE 2 END,
 e.legal_priority DESC,e.enqueued_at,e.id LIMIT 200`;
export async function medicalOverview(req,res){
 res.set("Cache-Control","no-store");if(deny(req,res))return;
 try{const pool=getPool();const doctor=(await pool.query(scope,[req.staff.id])).rows[0];
  if(!doctor)return res.status(409).json({error:"Este computador ainda não está vinculado a um médico cadastrado. Solicite ao administrador a vinculação."});
  const result=await pool.query(entries,[doctor.queue_definition_id,doctor.queue_mode,req.staff.id]);
  return res.json({doctor,entries:result.rows});
 }catch(e){return fail(res,e);}
}
export async function medicalAction(req,res){
 res.set("Cache-Control","no-store");if(deny(req,res))return;
 const {entryId,action}=req.params;
 if(!uuid(entryId)||!["call","arrival","complete","return","no-show"].includes(action))return res.status(400).json({error:"Ação inválida"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const doctor=(await client.query(scope,[req.staff.id])).rows[0];
  if(!doctor){await client.query("ROLLBACK");return res.status(403).json({error:"Médico não vinculado"});}
  const {rows}=await client.query(`SELECT e.*,qi.professional_id,qs.definition_id,qd.queue_mode FROM public.queue_entries e
   JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id
   JOIN public.queue_definitions qd ON qd.id=qs.definition_id
   WHERE e.id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now() FOR UPDATE OF e`,[entryId]);
  const e=rows[0];
  if(!e||e.definition_id!==doctor.queue_definition_id||(doctor.queue_mode==="individual"&&e.professional_id!==req.staff.id)||(doctor.queue_mode==="shared"&&e.professional_id!==null)){
   await client.query("ROLLBACK");return res.status(404).json({error:"Senha não pertence à fila deste médico"});
  }
  const expected=action==="call"?"waiting":action==="arrival"||action==="no-show"?"called":"in_service";
  if(e.status!==expected){await client.query("ROLLBACK");return res.status(409).json({error:"A senha mudou de situação. Atualize a fila."});}
  if(action==="call"){
   const busy=await client.query(`SELECT 1 FROM public.queue_entries x JOIN public.call_events ce ON ce.queue_entry_id=x.id
    WHERE x.status IN ('called','in_service') AND ce.called_by=$1 AND x.id<>$2 LIMIT 1`,[req.staff.id,entryId]);
   if(busy.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Finalize o paciente atual antes de chamar outro"});}
   await client.query("UPDATE public.queue_entries SET status='called',called_at=now() WHERE id=$1",[entryId]);
   await client.query("INSERT INTO public.call_events(queue_entry_id,called_by,room_id) VALUES($1,$2,$3)",[entryId,req.staff.id,doctor.room_id]);
  }else if(action==="arrival"){
   await client.query("UPDATE public.queue_entries SET status='in_service',service_started_at=now() WHERE id=$1",[entryId]);
  }else if(action==="no-show"){
   const late=await client.query("SELECT called_at<=now()-interval '2 minutes' AS expired FROM public.queue_entries WHERE id=$1",[entryId]);
   if(!late.rows[0]?.expired){await client.query("ROLLBACK");return res.status(409).json({error:"Aguarde os dois minutos antes de registrar ausência"});}
   await client.query("UPDATE public.queue_entries SET status='no_show',service_finished_at=now() WHERE id=$1",[entryId]);
  }else if(action==="complete"){
   await client.query("UPDATE public.queue_entries SET status='completed',service_finished_at=now() WHERE id=$1",[entryId]);
   await client.query("UPDATE public.patient_journeys SET status='completed',completed_at=now() WHERE id=$1",[e.journey_id]);
  }else{
   const reception=await client.query(`SELECT qi.id FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id
    JOIN public.queue_definitions q ON q.id=qs.definition_id
    WHERE q.stage_type='reception' AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now()
    AND qi.professional_id IS NULL AND qi.active=true ORDER BY qs.starts_at DESC LIMIT 1`);
   if(!reception.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Não existe fila de recepção ativa"});}
   await client.query("UPDATE public.queue_entries SET status='transferred',service_finished_at=now() WHERE id=$1",[entryId]);
   const next=await client.query(`INSERT INTO public.queue_entries(journey_id,queue_id,ticket_code,payment_category,legal_priority)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,[e.journey_id,reception.rows[0].id,e.ticket_code,e.payment_category,e.legal_priority]);
   await client.query(`INSERT INTO public.queue_transfers(journey_id,from_entry_id,to_entry_id,transferred_by,reason)
    VALUES($1,$2,$3,$4,$5)`,[e.journey_id,entryId,next.rows[0].id,req.staff.id,"Retorno à recepção"]);
  }
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
   VALUES($1,$2,'queue_entry',$3,$4::jsonb)`,[req.staff.id,"medical."+action,entryId,JSON.stringify({statusFrom:e.status})]);
  await client.query("COMMIT");return res.json({status:action==="return"?"transferred":action});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});return fail(res,error);}finally{client.release();}
}
