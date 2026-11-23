import {getPool} from "../config/database.js";
const periods={7:7,30:30,90:90};
export async function adminAnalytics(req,res){
 res.set("Cache-Control","no-store");
 if(req.staff?.role!=="admin")return res.status(403).json({error:"Acesso restrito à administração"});
 const days=Number(req.query.days??30);
 if(!periods[days])return res.status(400).json({error:"Período inválido"});
 const queueId=String(req.query.queue??"");
 const stage=String(req.query.stage??"");
 const specialtyId=String(req.query.specialty??"");
 const status=String(req.query.status??"");
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if((queueId&&!uuid.test(queueId))||(specialtyId&&!uuid.test(specialtyId))||(stage&&!["reception","triage","consultation","exam"].includes(stage))||(status&&!["waiting","called","in_service","completed","transferred","cancelled","no_show"].includes(status)))return res.status(400).json({error:"Filtros inválidos"});
 const args=[days,queueId||null,stage||null,specialtyId||null,status||null];
 const scope=` FROM public.queue_entries e
 JOIN public.queue_instances qi ON qi.id=e.queue_id
 JOIN public.queue_sessions qs ON qs.id=qi.session_id
 JOIN public.queue_definitions q ON q.id=qs.definition_id
 WHERE e.enqueued_at>=current_date-($1::int-1)*interval '1 day'
 AND ($2::uuid IS NULL OR q.id=$2::uuid)
 AND ($3::text IS NULL OR q.stage_type=$3::text)
 AND ($4::uuid IS NULL OR q.specialty_id=$4::uuid)
 AND ($5::text IS NULL OR e.status=$5::text)`;
 try{
  const pool=getPool();
  const [summary,daily,byQueue,byStage,byStatus,filters]=await Promise.all([
   pool.query(`SELECT
    count(*)::int AS total,
    count(*) FILTER(WHERE e.status='completed')::int AS completed,
    count(*) FILTER(WHERE e.status='transferred')::int AS transferred,
    count(*) FILTER(WHERE e.status='cancelled')::int AS cancelled,
    count(*) FILTER(WHERE e.status='no_show')::int AS no_show,
    count(*) FILTER(WHERE e.status='waiting')::int AS waiting,
    count(*) FILTER(WHERE e.status='called')::int AS called,
    count(*) FILTER(WHERE e.status='in_service')::int AS in_service,
    count(DISTINCT e.journey_id)::int AS journeys,
    round(avg(extract(epoch FROM (e.service_started_at-e.enqueued_at))/60) FILTER(WHERE e.service_started_at>=e.enqueued_at)::numeric,1)::float AS avg_wait_minutes,
    round(avg(extract(epoch FROM (e.service_finished_at-e.service_started_at))/60) FILTER(WHERE e.service_finished_at>=e.service_started_at)::numeric,1)::float AS avg_service_minutes
    \${scope}`,args),
   pool.query(`SELECT to_char(d.day,'YYYY-MM-DD') AS day,count(e.id)::int AS total,
    count(e.id) FILTER(WHERE e.status='completed')::int AS completed,
    count(e.id) FILTER(WHERE e.status='cancelled')::int AS cancelled
    FROM generate_series(current_date-($1::int-1)*interval '1 day',current_date,interval '1 day') d(day)
    LEFT JOIN (SELECT e.* ${scope}) e ON e.enqueued_at>=d.day AND e.enqueued_at<d.day+interval '1 day'
    GROUP BY d.day ORDER BY d.day`,args),
   pool.query(`SELECT q.id,q.name,q.stage_type,s.name AS specialty,count(e.id)::int AS total,
    count(e.id) FILTER(WHERE e.status='completed')::int AS completed,
    count(e.id) FILTER(WHERE e.status IN ('waiting','called','in_service'))::int AS active,
    count(e.id) FILTER(WHERE e.status='cancelled')::int AS cancelled,
    round(avg(extract(epoch FROM (e.service_started_at-e.enqueued_at))/60) FILTER(WHERE e.service_started_at>=e.enqueued_at)::numeric,1)::float AS avg_wait_minutes,
    round(avg(extract(epoch FROM (e.service_finished_at-e.service_started_at))/60) FILTER(WHERE e.service_finished_at>=e.service_started_at)::numeric,1)::float AS avg_service_minutes
    FROM public.queue_definitions q LEFT JOIN public.specialties s ON s.id=q.specialty_id
    LEFT JOIN (SELECT e.*,qs.definition_id ${scope}) e ON e.definition_id=q.id
    WHERE ($2::uuid IS NULL OR q.id=$2::uuid)
    AND ($3::text IS NULL OR q.stage_type=$3::text)
    AND ($4::uuid IS NULL OR q.specialty_id=$4::uuid)
    GROUP BY q.id,q.name,q.stage_type,s.name ORDER BY total DESC,q.name`,args),
   pool.query(`SELECT q.stage_type AS stage,count(e.id)::int AS total,
    count(e.id) FILTER(WHERE e.status='completed')::int AS completed
    ${scope} GROUP BY q.stage_type ORDER BY total DESC`,args),
   pool.query(`SELECT e.status,count(*)::int AS total ${scope} GROUP BY e.status ORDER BY total DESC`,args),
   pool.query(`SELECT q.id,q.name,q.stage_type,q.specialty_id,s.name AS specialty_name
     FROM public.queue_definitions q LEFT JOIN public.specialties s ON s.id=q.specialty_id
     ORDER BY q.name`)
  ]);
  return res.json({periodDays:days,generatedAt:new Date().toISOString(),summary:summary.rows[0],daily:daily.rows,queues:byQueue.rows,stages:byStage.rows,statuses:byStatus.rows,availableQueues:filters.rows,appliedFilters:{queue:queueId,stage,specialty:specialtyId,status}});
 }catch(error){console.error("Analytics failed",{code:error.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível consultar os indicadores no banco."});}
}
