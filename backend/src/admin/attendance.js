import { getPool } from "../config/database.js";
export async function adminAttendance(req,res){
 res.set("Cache-Control","no-store");
 if(req.staff?.role!=="admin")return res.status(403).json({error:"Acesso restrito"});
 try{
  const pool=getPool();
  const [queues,entries]=await Promise.all([
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
     e.legal_priority DESC,e.enqueued_at,e.id LIMIT 1000`)
  ]);
  return res.json({queues:queues.rows,entries:entries.rows,serverTime:new Date().toISOString()});
 }catch(e){console.error("Admin attendance error",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível carregar os atendimentos do Neon"});}
}
