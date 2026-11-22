import { decryptTrackingToken } from "../security/trackingToken.js";
import { getPool } from "../config/database.js";
export async function adminAttendance(req,res){
 res.set("Cache-Control","no-store");
 if(req.staff?.role!=="admin")return res.status(403).json({error:"Acesso restrito"});
 try{
  const pool=getPool();
  const [queues,entries,averages]=await Promise.all([
   pool.query(`SELECT q.id,q.name,q.stage_type,q.queue_mode,s.name AS specialty_name,
    STRING_AGG(DISTINCT su.display_name,', ') AS doctors
    FROM public.queue_definitions q LEFT JOIN public.specialties s ON s.id=q.specialty_id
    LEFT JOIN public.doctor_profiles dp ON dp.queue_definition_id=q.id AND dp.enabled=true
    LEFT JOIN public.staff_users su ON su.id=dp.staff_user_id AND su.active=true
    GROUP BY q.id,s.name ORDER BY q.stage_type,q.name`),
   pool.query(`SELECT e.id,e.journey_id,e.ticket_code,e.status,e.legal_priority,e.payment_category,
    e.enqueued_at,e.called_at,e.service_started_at,e.service_finished_at,
    p.full_name AS patient_name,q.id AS definition_id,q.name AS queue_name,
    q.stage_type,q.queue_mode,s.name AS specialty_name,pro.display_name AS professional_name,
    r.name AS room_name
    FROM public.queue_entries e
    JOIN public.queue_instances qi ON qi.id=e.queue_id
    JOIN public.queue_sessions qs ON qs.id=qi.session_id
    JOIN public.queue_definitions q ON q.id=qs.definition_id
    LEFT JOIN public.specialties s ON s.id=q.specialty_id
    LEFT JOIN public.patient_journeys j ON j.id=e.journey_id
    LEFT JOIN public.patients p ON p.id=j.patient_id
    LEFT JOIN public.staff_users pro ON pro.id=qi.professional_id
    LEFT JOIN LATERAL (SELECT ce.room_id FROM public.call_events ce WHERE ce.queue_entry_id=e.id ORDER BY ce.called_at DESC LIMIT 1) last_call ON true
    LEFT JOIN public.rooms r ON r.id=last_call.room_id
    WHERE e.status IN ('waiting','called','in_service')
    ORDER BY CASE e.status WHEN 'in_service' THEN 0 WHEN 'called' THEN 1 ELSE 2 END,
     e.legal_priority DESC,e.enqueued_at,e.id LIMIT 1000`),
   pool.query(`SELECT q.id AS definition_id,COUNT(*)::int AS sample_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (e.service_finished_at-e.service_started_at))/60)::numeric,1)::float AS avg_minutes
    FROM public.queue_entries e JOIN public.queue_instances qi ON qi.id=e.queue_id
    JOIN public.queue_sessions qs ON qs.id=qi.session_id JOIN public.queue_definitions q ON q.id=qs.definition_id
    WHERE e.status IN ('completed','transferred') AND e.service_started_at IS NOT NULL
    AND e.service_finished_at>e.service_started_at AND e.service_finished_at>=now()-interval '30 days'
    GROUP BY q.id`)
  ]);
  const defaults={reception:10,triage:15,consultation:30,exam:30};
  const averagesByQueue=new Map(averages.rows.map(a=>[a.definition_id,a]));
  const enriched=entries.rows.map(e=>{
   const history=averagesByQueue.get(e.definition_id);
   const enoughHistory=history&&history.sample_count>=5;
   const baselineMinutes=enoughHistory?Math.max(1,history.avg_minutes):defaults[e.stage_type]??30;
   const baselineSource=enoughHistory?"historical":"reference";
   const started=e.status==="in_service"?e.service_started_at:e.status==="called"?e.called_at:e.enqueued_at;
   const elapsedMinutes=started?Math.max(0,(Date.now()-new Date(started).getTime())/60000):0;
   const thresholdMinutes=e.status==="called"?2:e.status==="waiting"?Math.max(15,Math.ceil(baselineMinutes*1.5)):Math.max(5,Math.ceil(baselineMinutes*1.5));
   const alertLevel=elapsedMinutes>=thresholdMinutes*1.5?"critical":elapsedMinutes>=thresholdMinutes?"warning":null;
   return {...e,delay:{level:alertLevel,elapsedMinutes:Math.floor(elapsedMinutes),thresholdMinutes,
    averageMinutes:baselineMinutes,source:baselineSource,sampleCount:history?.sample_count??0}};
  });
  return res.json({queues:queues.rows,entries:enriched,serverTime:new Date().toISOString()});
 }catch(e){console.error("Admin attendance error",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível carregar os atendimentos do Neon"});}
}

export async function adminAttendanceTracking(req,res){
 res.set("Cache-Control","no-store");
 if(req.staff?.role!=="admin")return res.status(403).json({error:"Acesso restrito"});
 const id=req.params.entryId;
 if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return res.status(400).json({error:"Ficha inválida"});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const result=await client.query(`SELECT j.id AS journey_id,j.tracking_token_encrypted
   FROM public.queue_entries e JOIN public.patient_journeys j ON j.id=e.journey_id
   WHERE e.id=$1 AND e.status IN ('waiting','called','in_service')
   AND j.tracking_revoked_at IS NULL AND j.tracking_expires_at>now()
   AND j.status NOT IN ('completed','cancelled')`,[id]);
  if(!result.rowCount||!result.rows[0].tracking_token_encrypted){
   await client.query("ROLLBACK");
   return res.status(404).json({error:"Link de acompanhamento indisponível ou expirado"});
  }
  const token=decryptTrackingToken(result.rows[0].tracking_token_encrypted);
  await client.query(`INSERT INTO public.audit_events(actor_user_id,action,resource_type,resource_id)
   VALUES($1,'attendance.tracking.viewed','patient_journey',$2)`,[req.staff.id,result.rows[0].journey_id]);
  await client.query("COMMIT");
  return res.json({trackingToken:token});
 }catch(error){await client.query("ROLLBACK").catch(()=>{});console.error("Admin tracking access error",{code:error.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível recuperar o acompanhamento"});}
 finally{client.release();}
}
