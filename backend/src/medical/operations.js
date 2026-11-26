import { getPool } from "../config/database.js";
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const deny=(req,res)=>req.staff?.role!=="doctor"?(res.status(403).json({error:"Acesso exclusivo do médico"}),true):false;
const fail=(res,e)=>{console.error("Medical queue error",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Fila médica temporariamente indisponível"});};
async function resolveDoctor(client,req){
 const roomId=req.device?.room_id;
 if(!roomId)return null;
 const room=(await client.query("SELECT id,name FROM public.rooms WHERE id=$1 AND active=true",[roomId])).rows[0];
 if(!room)return null;
 const {rows}=await client.query(`SELECT DISTINCT q.id AS queue_definition_id,q.name AS queue_name,q.queue_mode,qi.professional_id,
 COALESCE(s.display_name,'Atendimento médico') AS display_name
 FROM public.queue_sessions qs
 JOIN public.queue_definitions q ON q.id=qs.definition_id AND q.active=true AND q.stage_type IN ('consultation','exam')
 JOIN public.queue_instances qi ON qi.session_id=qs.id AND qi.active=true
 LEFT JOIN public.session_professionals sp ON sp.session_id=qs.id AND sp.room_id=$1
 LEFT JOIN public.staff_users s ON s.id=sp.professional_id
 WHERE qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now()
 AND (sp.room_id IS NOT NULL OR (q.queue_mode='shared' AND qi.professional_id IS NULL))
 AND (q.queue_mode='shared' OR qi.professional_id=sp.professional_id)
 ORDER BY q.name LIMIT 3`,[roomId]);
 if(rows.length>1){const err=new Error("Há mais de uma fila médica ativa. Configure a sessão da sala para identificar a fila correta.");err.status=409;throw err;}
 const q=rows[0];
 return {room_id:roomId,room_name:room.name,display_name:q?.display_name??"Atendimento médico",
 queue_definition_id:q?.queue_definition_id??null,queue_name:q?.queue_name??null,queue_mode:q?.queue_mode??null,
 staff_user_id:q?.professional_id??req.staff.id};
}
const entries=`SELECT e.id,e.ticket_code,e.status,e.legal_priority,e.payment_category,e.enqueued_at,e.called_at,(SELECT count(*)::int FROM public.call_events cc WHERE cc.queue_entry_id=e.id) AS call_count,
 CASE WHEN e.status='waiting' OR ce.room_id=$4 THEN p.full_name END AS patient_name, ce.room_id AS called_room_id, rm.name AS called_room_name
 FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
 JOIN public.queue_sessions qs ON qs.id=qi.session_id
 JOIN public.patient_journeys j ON j.id=e.journey_id
 LEFT JOIN public.patients p ON p.id=j.patient_id
 LEFT JOIN LATERAL (SELECT room_id FROM public.call_events WHERE queue_entry_id=e.id ORDER BY called_at DESC,id DESC LIMIT 1) ce ON true
 LEFT JOIN public.rooms rm ON rm.id=ce.room_id
 WHERE qs.definition_id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now()
 AND qi.active=true AND ($2='shared' AND qi.professional_id IS NULL OR $2='individual' AND qi.professional_id=$3)
 AND e.status IN ('waiting','called','in_service')
 ORDER BY CASE WHEN e.status='in_service' THEN 0 WHEN e.status='called' THEN 1 ELSE 2 END,
 e.legal_priority DESC,e.enqueued_at,e.id LIMIT 200`;
export async function medicalOverview(req,res){
 res.set("Cache-Control","no-store");if(deny(req,res))return;
 try{const pool=getPool();const doctor=await resolveDoctor(pool,req);
  if(!doctor)return res.status(409).json({error:"Este dispositivo precisa estar autorizado em uma sala ativa."});
  const result=doctor.queue_definition_id?await pool.query(entries,[doctor.queue_definition_id,doctor.queue_mode,doctor.staff_user_id,doctor.room_id]):{rows:[]};
  return res.json({doctor,entries:result.rows});
 }catch(e){if(e.status===409)return res.status(409).json({error:e.message});return fail(res,e);}
}
export async function medicalAction(req,res){
 res.set("Cache-Control","no-store");if(deny(req,res))return;
 const {entryId,action}=req.params;
 if(!uuid(entryId)||!["call","recall","arrival","complete","return","no-show"].includes(action))return res.status(400).json({error:"Ação inválida"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const doctor=await resolveDoctor(client,req);
  if(!doctor){await client.query("ROLLBACK");return res.status(403).json({error:"Dispositivo sem sala autorizada"});}
  if(!doctor.queue_definition_id){await client.query('ROLLBACK');return res.status(409).json({error:'Nenhuma fila médica ativa para este consultório.'});}
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['medical:'+doctor.queue_definition_id]);
  const {rows}=await client.query(`SELECT e.*,qi.professional_id,qs.definition_id,qd.queue_mode FROM public.queue_entries e
   JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id
   JOIN public.queue_definitions qd ON qd.id=qs.definition_id
   WHERE e.id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now() FOR UPDATE OF e`,[entryId]);
  const e=rows[0];
  if(!e||e.definition_id!==doctor.queue_definition_id||(doctor.queue_mode==="individual"&&e.professional_id!==doctor.staff_user_id)||(doctor.queue_mode==="shared"&&e.professional_id!==null)){
   await client.query("ROLLBACK");return res.status(404).json({error:"Senha não pertence à fila deste médico"});
  }
  const expected=action==="call"?"waiting":action==="arrival"||action==="no-show"||action==="recall"?"called":"in_service";
  if(e.status!==expected){await client.query("ROLLBACK");return res.status(409).json({error:"A senha mudou de situação. Atualize a fila."});}
  if(action!=="call"){
   const owner=(await client.query("SELECT room_id FROM public.call_events WHERE queue_entry_id=$1 ORDER BY called_at DESC,id DESC LIMIT 1",[entryId])).rows[0];
   if(owner?.room_id!==doctor.room_id){await client.query("ROLLBACK");return res.status(403).json({error:"Esta senha pertence a outro consultório."});}
  }
  if(action==="call"){
   const last=(await client.query(`SELECT x.legal_priority FROM public.call_events ce JOIN public.queue_entries x ON x.id=ce.queue_entry_id WHERE x.queue_id=$1 GROUP BY x.id,x.legal_priority ORDER BY min(ce.called_at) DESC LIMIT 1`,[e.queue_id])).rows[0];
   const preferred=last?!last.legal_priority:true;
   if(e.legal_priority!==preferred&&(await client.query("SELECT 1 FROM public.queue_entries WHERE queue_id=$1 AND status='waiting' AND legal_priority=$2 LIMIT 1",[e.queue_id,preferred])).rowCount){await client.query('ROLLBACK');return res.status(409).json({error:preferred?'Chame uma senha prioritária nesta vez.':'Chame uma senha comum nesta vez.'});}
   const busy=await client.query(`SELECT 1 FROM public.queue_entries x JOIN public.call_events ce ON ce.queue_entry_id=x.id
    WHERE x.status IN ('called','in_service') AND ce.room_id=$1 AND x.id<>$2 LIMIT 1`,[doctor.room_id,entryId]);
   if(busy.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Finalize o paciente atual antes de chamar outro"});}
   await client.query("UPDATE public.queue_entries SET status='called',called_at=now() WHERE id=$1",[entryId]);
   await client.query("INSERT INTO public.call_events(queue_entry_id,called_by,room_id) VALUES($1,$2,$3)",[entryId,req.staff.id,doctor.room_id]);
  }else if(action==="recall"){
   const count=Number((await client.query("SELECT count(*) FROM public.call_events WHERE queue_entry_id=$1",[entryId])).rows[0].count);
   if(count>=3||Date.now()-new Date(e.called_at).getTime()<(count===1?120000:60000)){await client.query("ROLLBACK");return res.status(409).json({error:"Aguarde o prazo da chamada ou registre ausência após a terceira."});}
   await client.query("UPDATE public.queue_entries SET called_at=now() WHERE id=$1",[entryId]);
   await client.query("INSERT INTO public.call_events(queue_entry_id,called_by,room_id) VALUES($1,$2,$3)",[entryId,req.staff.id,doctor.room_id]);
  }else if(action==="arrival"){
   await client.query("UPDATE public.queue_entries SET status='in_service',service_started_at=now() WHERE id=$1",[entryId]);
  }else if(action==="no-show"){
   const tolerance=await client.query("SELECT COALESCE((to_jsonb(c)->'preferences'->>'arrivalToleranceMinutes')::int,2) AS minutes FROM public.clinic_settings c WHERE id=1");
   const count=Number((await client.query("SELECT count(*) FROM public.call_events WHERE queue_entry_id=$1",[entryId])).rows[0].count);
   if(count<2){await client.query("ROLLBACK");return res.status(409).json({error:"Realize a segunda chamada antes de registrar ausência."});}
   const minutes=1;
   const late=await client.query("SELECT called_at<=now()-($2::int*interval '1 minute') AS expired FROM public.queue_entries WHERE id=$1",[entryId,minutes]);
   if(!late.rows[0]?.expired){await client.query("ROLLBACK");return res.status(409).json({error:`Aguarde ${minutes} minuto(s) após a chamada antes de registrar ausência.`});}
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
    VALUES($1,$2,$3,$4,$5)`,[e.journey_id,entryId,next.rows[0].id,req.staff.id,(typeof req.body?.observation==="string"&&req.body.observation.trim()?req.body.observation.trim().slice(0,120):"Retorno à recepção")]);
  }
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata)
   VALUES($1,$2,'queue_entry',$3,$4::jsonb)`,[req.staff.id,"medical."+action,entryId,JSON.stringify({statusFrom:e.status})]);
  await client.query("COMMIT");return res.json({status:action==="return"?"transferred":action});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});if(error.status===409)return res.status(409).json({error:error.message});return fail(res,error);}finally{client.release();}
}
