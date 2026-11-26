import { getPool } from "../config/database.js";
import { decryptTrackingToken } from "../security/trackingToken.js";

const allowed = (req,res) => {
  if (!["attendant","admin"].includes(req.staff?.role)) { res.status(403).json({error:"Acesso negado"}); return false; }
  return true;
};
const fail = (res,error) => { console.error("Reception error",{code:error.code??"UNKNOWN"}); return res.status(503).json({error:"Operação indisponível. Tente novamente."}); };

export async function receptionOverview(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  try {
    const pool=getPool();
    const date=req.query.date??null;
    if(date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'Data inválida'});
    const [queues, entries] = await Promise.all([
      pool.query(`SELECT qd.id,qd.name,qd.stage_type, count(e.id) FILTER (WHERE e.status='waiting')::int AS waiting
        FROM public.queue_definitions qd LEFT JOIN public.queue_sessions qs ON qs.definition_id=qd.id AND qs.status='active'
        LEFT JOIN public.queue_instances qi ON qi.session_id=qs.id AND qi.active=true
        LEFT JOIN public.queue_entries e ON e.queue_id=qi.id
        WHERE qd.active=true GROUP BY qd.id,qd.name,qd.stage_type ORDER BY qd.stage_type,qd.name`),
      pool.query(`SELECT e.id,e.ticket_code,e.status,e.legal_priority,e.payment_category,e.enqueued_at,e.called_at,e.journey_id,
        qd.name AS queue_name,qd.stage_type,p.full_name AS patient_name,p.phone AS patient_phone,
        COALESCE(rm.name,desk.name) AS destination_name, j.started_at AS issued_at, tr.reason AS return_observation
        FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
        JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions qd ON qd.id=qs.definition_id
        JOIN public.patient_journeys j ON j.id=e.journey_id LEFT JOIN public.patients p ON p.id=j.patient_id
        LEFT JOIN LATERAL (SELECT room_id,called_by FROM public.call_events WHERE queue_entry_id=e.id ORDER BY called_at DESC LIMIT 1) ce ON true
        LEFT JOIN public.rooms rm ON rm.id=ce.room_id
        LEFT JOIN public.authorized_devices desk ON desk.staff_user_id=ce.called_by AND desk.role='attendant' AND desk.status='active'
        LEFT JOIN LATERAL (SELECT reason FROM public.queue_transfers WHERE to_entry_id=e.id ORDER BY created_at DESC LIMIT 1) tr ON true
        WHERE (j.started_at AT TIME ZONE 'America/Fortaleza')::date=COALESCE($1::date,(now() AT TIME ZONE 'America/Fortaleza')::date)
        ORDER BY CASE WHEN e.status='waiting' THEN 0 ELSE 1 END,e.legal_priority DESC,e.enqueued_at ASC LIMIT 300`,[date])
    ]);
    return res.json({queues:queues.rows,entries:entries.rows});
  } catch(error) { return fail(res,error); }
}

export async function receptionCall(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  const {entryId}=req.params;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return res.status(400).json({error:"Senha inválida"});
  const client=await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sica-reception-call'))");
    let target=entryId;
    if(req.body?.automatic===true){const next=await client.query(`SELECT e.id FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions q ON q.id=qs.definition_id WHERE e.status='waiting' AND q.stage_type='reception' AND q.active AND qi.active AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now() ORDER BY (e.legal_priority=COALESCE((SELECT NOT x.legal_priority FROM public.call_events ce JOIN public.queue_entries x ON x.id=ce.queue_entry_id JOIN public.queue_instances xi ON xi.id=x.queue_id JOIN public.queue_sessions xs ON xs.id=xi.session_id JOIN public.queue_definitions xd ON xd.id=xs.definition_id WHERE xd.stage_type='reception' AND ce.called_at >= date_trunc('day',now() AT TIME ZONE 'America/Fortaleza') AT TIME ZONE 'America/Fortaleza' ORDER BY ce.called_at DESC,ce.id DESC LIMIT 1),true)) DESC,e.enqueued_at,e.id LIMIT 1 FOR UPDATE OF e`);if(!next.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Nenhuma senha aguardando'});}target=next.rows[0].id;}
    const {rows}=await client.query(`SELECT e.id,e.status,qd.stage_type FROM public.queue_entries e
      JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id
      JOIN public.queue_definitions qd ON qd.id=qs.definition_id WHERE e.id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now() AND qi.active=true FOR UPDATE OF e`,[target]);
    if (!rows[0] || rows[0].stage_type!=="reception" || rows[0].status!=="waiting") {
      await client.query("ROLLBACK");return res.status(409).json({error:"Senha não está aguardando na recepção"});
    }
    const active=await client.query(`SELECT 1 FROM public.queue_entries e JOIN public.call_events c ON c.queue_entry_id=e.id
      WHERE e.status='called' AND c.called_by=$1 AND e.id<>$2 LIMIT 1`,[req.staff.id,target]);
    if (active.rows.length) {await client.query("ROLLBACK");return res.status(409).json({error:"Conclua a chamada atual antes de chamar outra senha"});}
    await client.query("UPDATE public.queue_entries SET status='called',called_at=now() WHERE id=$1",[target]);
    await client.query("INSERT INTO public.call_events(queue_entry_id,called_by,room_id,called_at) VALUES($1,$2,$3,now())",[target,req.staff.id,req.device?.room_id??null]);
    await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id) VALUES($1,'reception.call','queue_entry',$2)",[req.staff.id,entryId]);
    await client.query("COMMIT");
    return res.json({status:"called",entryId:target});
  } catch(error) {await client.query("ROLLBACK").catch(()=>{});return fail(res,error);} finally {client.release();}
}

export async function receptionArrival(req,res) {
  res.set("Cache-Control","no-store");
  if (!allowed(req,res)) return;
  const {entryId}=req.params;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return res.status(400).json({error:"Senha inválida"});
  try {
    const result=await getPool().query(`WITH updated AS (UPDATE public.queue_entries e SET status='in_service',service_started_at=now()
      FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id
      JOIN public.queue_definitions qd ON qd.id=qs.definition_id
      WHERE e.id=$1 AND e.queue_id=qi.id AND qd.stage_type='reception' AND e.status='called' RETURNING e.id) INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id) SELECT $2,'reception.arrival','queue_entry',id FROM updated RETURNING resource_id`,[entryId,req.staff.id]);
    if (!result.rowCount) return res.status(409).json({error:"A senha não está chamada na recepção"});
    return res.json({status:"in_service"});
  } catch(error) {return fail(res,error);}
}

const validId = value => typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function receptionHandoff(req,res) {
 res.set("Cache-Control","no-store");
 if(!allowed(req,res)) return;
 const {entryId}=req.params;
 const {patientName,whatsapp,queueId}=req.body??{};
 if(!validId(entryId)||!validId(queueId)||typeof patientName!=="string"||patientName.trim().length<2||patientName.trim().length>180||
    (whatsapp!=null && (typeof whatsapp!=="string"|| (whatsapp.trim()&&!/^\+?[0-9 ()-]{8,22}$/.test(whatsapp.trim())))))
   return res.status(400).json({error:"Confira o nome, WhatsApp e fila de destino"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const entryResult=await client.query(`SELECT e.*,qd.stage_type FROM public.queue_entries e
   JOIN public.queue_instances qi ON qi.id=e.queue_id JOIN public.queue_sessions qs ON qs.id=qi.session_id
   JOIN public.queue_definitions qd ON qd.id=qs.definition_id WHERE e.id=$1 FOR UPDATE OF e`,[entryId]);
  const entry=entryResult.rows[0];
  if(!entry||entry.stage_type!=="reception"||entry.status!=="in_service"){
   await client.query("ROLLBACK");return res.status(409).json({error:"Confirme a chegada na recepção antes do encaminhamento"});
  }
  const def=await client.query("SELECT id,name,stage_type,queue_mode FROM public.queue_definitions WHERE id=$1 AND active=true AND stage_type IN ('consultation','exam')",[queueId]);
  if(!def.rows[0]) {await client.query("ROLLBACK");return res.status(400).json({error:"Fila de destino indisponível"});}
  const q=def.rows[0];
  const professional=await client.query(`SELECT p.staff_user_id AS id FROM public.doctor_profiles p
   JOIN public.staff_users s ON s.id=p.staff_user_id
   WHERE p.queue_definition_id=$1 AND p.enabled=true AND s.active=true
   ORDER BY s.display_name LIMIT 1`,[q.id]);
  if(q.queue_mode==='individual'&&!professional.rows[0]) {await client.query("ROLLBACK");return res.status(409).json({error:"Cadastre e ative um médico para esta fila"});}
  const settings=await client.query("SELECT timezone FROM public.clinic_settings WHERE id=1");
  const tz=settings.rows[0]?.timezone??"America/Fortaleza";
  const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",["sica-demo-destination:"+q.id+":"+localDate]);
  const assignedProfessional=q.queue_mode==="individual"?professional.rows[0].id:null;
  let instance=await client.query(`SELECT qi.id FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id
   WHERE qs.definition_id=$1 AND qs.status='active' AND qs.starts_at<=now() AND qs.ends_at>now()
   AND qi.professional_id IS NOT DISTINCT FROM $2::uuid AND qi.active=true LIMIT 1`,[q.id,assignedProfessional]);
  if(!instance.rows[0]){
   let session=await client.query(`SELECT id FROM public.queue_sessions WHERE definition_id=$1 AND status='active'
    AND starts_at<=now() AND ends_at>now() ORDER BY starts_at DESC LIMIT 1`,[q.id]);
   if(!session.rows[0])session=await client.query(`INSERT INTO public.queue_sessions(definition_id,starts_at,ends_at,status)
    VALUES($1,now(),(($2::date + 1)::timestamp AT TIME ZONE $3),'active') RETURNING id`,[q.id,localDate,tz]);
   instance=await client.query("INSERT INTO public.queue_instances(session_id,professional_id) VALUES($1,$2) RETURNING id",[session.rows[0].id,assignedProfessional]);
  }
  const patient=await client.query("INSERT INTO public.patients(full_name,phone) VALUES($1,$2) RETURNING id",[patientName.trim(),whatsapp?.trim()||null]);
  await client.query("UPDATE public.patient_journeys SET patient_id=$2 WHERE id=$1",[entry.journey_id,patient.rows[0].id]);
  await client.query("UPDATE public.queue_entries SET status='transferred',service_finished_at=now() WHERE id=$1",[entryId]);
  const next=await client.query(`INSERT INTO public.queue_entries(journey_id,queue_id,ticket_code,payment_category,legal_priority)
   VALUES($1,$2,$3,$4,$5) RETURNING id`,[entry.journey_id,instance.rows[0].id,entry.ticket_code,entry.payment_category,entry.legal_priority]);
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id,metadata) VALUES($1,'reception.handoff','queue_entry',$2,$3::jsonb)",[req.staff.id,entryId,JSON.stringify({destinationQueueId:q.id,nextEntryId:next.rows[0].id})]);
  await client.query("COMMIT");
  return res.json({status:"transferred",entryId:next.rows[0].id,queueName:q.name,whatsappConfigured:false});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});return fail(res,error);}finally{client.release();}
}

export async function receptionTrackingLink(req,res){
 res.set("Cache-Control","no-store");
 if(!allowed(req,res)) return;
 if(!validId(req.params.entryId)) return res.status(400).json({error:"Senha inválida"});
 try{
  const pool=getPool();
  const result=await pool.query(`SELECT j.id,j.tracking_token_encrypted,j.tracking_revoked_at,j.tracking_expires_at FROM public.queue_entries e JOIN public.patient_journeys j ON j.id=e.journey_id
   WHERE e.id=$1 AND j.patient_id IS NOT NULL AND j.tracking_revoked_at IS NULL`,[req.params.entryId]);
  if(!result.rows[0]) return res.status(404).json({error:"Paciente não encaminhado ou não encontrado"});
  const record=result.rows[0];
  if(!record.tracking_token_encrypted) return res.status(409).json({error:"Senha antiga: o link original não pode ser recuperado. Emita uma nova senha de teste."});
  if(new Date(record.tracking_expires_at).getTime()<=Date.now()) return res.status(410).json({error:"Prazo de acompanhamento encerrado"});
  const token=decryptTrackingToken(record.tracking_token_encrypted);
  return res.json({trackingToken:token});
 }catch(error){return fail(res,error);}
}

export async function receptionReturn(req,res){
 if(!allowed(req,res))return;
 const id=req.params.entryId;if(!validId(id))return res.status(400).json({error:"Senha inválida"});
 const client=await getPool().connect();try{await client.query("BEGIN");
 const result=await client.query(`UPDATE public.queue_entries e SET status='waiting',called_at=NULL,service_started_at=NULL,service_finished_at=NULL,enqueued_at=now()
 FROM public.queue_instances qi JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions q ON q.id=qs.definition_id
 WHERE e.id=$1 AND e.queue_id=qi.id AND q.stage_type='reception' AND qs.status='active' AND e.status IN ('called','in_service')
 AND EXISTS(SELECT 1 FROM public.call_events ce WHERE ce.id=(SELECT id FROM public.call_events WHERE queue_entry_id=e.id ORDER BY called_at DESC,id DESC LIMIT 1) AND ce.called_by=$2) RETURNING e.id`,[id,req.staff.id]);
 if(!result.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Senha não está em atendimento neste guichê."});}
 await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id) VALUES($1,'reception.return','queue_entry',$2)",[req.staff.id,id]);await client.query("COMMIT");return res.json({status:"waiting"});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});return fail(res,e);}finally{client.release();}
}
