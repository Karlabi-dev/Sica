import { createHash, randomBytes } from "node:crypto";
import { getPool } from "../config/database.js";
const hash = token => createHash("sha256").update(token).digest("hex");
const tokenFrom = req => (req.get("x-device-token") ?? "").trim();
const validToken = token => /^[a-f0-9]{64}$/.test(token);
const failure = (res,err) => {console.error("Device access failed",{code:err.code??"UNKNOWN"});return res.status(503).json({error:"Serviço de dispositivos indisponível"});};
export async function requestDevice(req,res) {
 res.set("Cache-Control","no-store");
 const existing=tokenFrom(req);
 const token=validToken(existing)?existing:randomBytes(32).toString("hex");
 try {
  const {rows}=await getPool().query(`INSERT INTO public.authorized_devices(device_token_hash) VALUES($1)
   ON CONFLICT(device_token_hash) DO UPDATE SET device_token_hash=EXCLUDED.device_token_hash
   RETURNING id,name,role,status`,[hash(token)]);
  return res.status(200).json({...rows[0],token});
 } catch(err){return failure(res,err);}
}
export async function deviceStatus(req,res) {
 res.set("Cache-Control","no-store");
 const token=tokenFrom(req);
 if(!validToken(token)) return res.status(401).json({error:"Dispositivo não registrado"});
 try {
  const {rows}=await getPool().query(`SELECT d.id,d.name,d.role,d.status,r.name AS room_name FROM public.authorized_devices d
   LEFT JOIN public.rooms r ON r.id=d.room_id WHERE d.device_token_hash=$1`,[hash(token)]);
  if(!rows.length) return res.status(401).json({error:"Dispositivo não registrado"});
  return res.json(rows[0]);
 } catch(err){return failure(res,err);}
}
export async function deviceAuth(req,res,next) {
 const token=tokenFrom(req);
 if(!validToken(token)) return res.status(401).json({error:"Dispositivo não autorizado"});
 try {
  const {rows}=await getPool().query(`SELECT d.id,d.name,d.role,d.staff_user_id,r.name AS room_name
   FROM public.authorized_devices d LEFT JOIN public.rooms r ON r.id=d.room_id
   JOIN public.staff_users su ON su.id=d.staff_user_id\n   WHERE d.device_token_hash=$1 AND d.status='active' AND su.active=true AND su.role=d.role`,[hash(token)]);
  if(!rows.length) return res.status(403).json({error:"Dispositivo aguardando aprovação ou revogado"});
  req.staff={id:rows[0].staff_user_id,role:rows[0].role,displayName:rows[0].name};
  req.device=rows[0];
  return next();
 } catch(err){return failure(res,err);}
}
export async function operationalAuth(req,res,next) {
 if(validToken(tokenFrom(req))) return deviceAuth(req,res,next);
 return res.status(401).json({error:"Este computador precisa ser autorizado pela administração"});
}
export async function listDevices(req,res) {
 if(req.staff?.role!=="admin") return res.status(403).json({error:"Somente administradores"});
 try {
  const {rows}=await getPool().query(`SELECT d.id,d.name,d.role,d.status,d.requested_at,d.approved_at,d.last_seen_at,
   d.room_id,d.staff_user_id,r.name AS room_name FROM public.authorized_devices d
   LEFT JOIN public.rooms r ON r.id=d.room_id ORDER BY CASE d.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,d.requested_at DESC`);
  return res.json({devices:rows});
 }catch(err){return failure(res,err);}
}
export async function approveDevice(req,res) {
 if(req.staff?.role!=="admin") return res.status(403).json({error:"Somente administradores"});
 const {name,role,roomId,doctorId}=req.body??{};
 if(typeof name!=="string"||!name.trim()||name.trim().length>120||!["attendant","doctor"].includes(role)) return res.status(400).json({error:"Nome e função inválidos"});
 if(roomId!=null&&!/^[0-9a-f-]{36}$/i.test(roomId)) return res.status(400).json({error:"Sala inválida"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const {rows}=await client.query("SELECT * FROM public.authorized_devices WHERE id=$1 FOR UPDATE",[req.params.id]);
  const device=rows[0];
  if(!device||device.status==="revoked") {await client.query("ROLLBACK");return res.status(409).json({error:"Dispositivo inexistente ou revogado"});}
  let staffId=device.staff_user_id;
  let assignedRoom=roomId??null;
  if(role==="doctor") {
   if(typeof doctorId!=="string"||!/^[0-9a-f-]{36}$/i.test(doctorId)){await client.query("ROLLBACK");return res.status(400).json({error:"Selecione um médico cadastrado"});}
   const doctor=await client.query("SELECT p.room_id FROM public.doctor_profiles p JOIN public.staff_users s ON s.id=p.staff_user_id WHERE s.id=$1 AND s.role='doctor' AND s.active=true AND p.enabled=true",[doctorId]);
   if(!doctor.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Médico não cadastrado ou inativo"});}
   const occupied=await client.query("SELECT id FROM public.authorized_devices WHERE staff_user_id=$1 AND id<>$2 AND status='active'",[doctorId,device.id]);
   if(occupied.rowCount){await client.query("ROLLBACK");return res.status(409).json({error:"Médico já autorizado em outro computador"});}
   staffId=doctorId;assignedRoom=doctor.rows[0].room_id;
  }
  if(!staffId) {
   const staff=await client.query(`INSERT INTO public.staff_users(firebase_uid,display_name,role,active)
     VALUES($1,$2,$3,true) RETURNING id`,["device:"+device.id,name.trim(),role]);
   staffId=staff.rows[0].id;
  }else if(role!=="doctor"){
   await client.query("UPDATE public.staff_users SET display_name=$2,role=$3,active=true,updated_at=now() WHERE id=$1",[staffId,name.trim(),role]);
  }
  await client.query(`UPDATE public.authorized_devices SET name=$2,role=$3,room_id=$4,staff_user_id=$5,status='active',approved_at=now(),approved_by=$6 WHERE id=$1`,[device.id,name.trim(),role,assignedRoom,staffId,req.staff.id]);
  await client.query("COMMIT");
  return res.json({status:"active"});
 }catch(err){await client.query("ROLLBACK").catch(()=>{});return failure(res,err);}finally{client.release();}
}
export async function revokeDevice(req,res) {
 if(req.staff?.role!=="admin") return res.status(403).json({error:"Somente administradores"});
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const {rows}=await client.query("SELECT staff_user_id FROM public.authorized_devices WHERE id=$1 FOR UPDATE",[req.params.id]);
  if(!rows.length){await client.query("ROLLBACK");return res.status(404).json({error:"Dispositivo não encontrado"});}
  await client.query("UPDATE public.authorized_devices SET status='revoked' WHERE id=$1",[req.params.id]);
  if(rows[0].staff_user_id) await client.query("UPDATE public.staff_users SET active=false WHERE id=$1 AND firebase_uid LIKE 'device:%'",[rows[0].staff_user_id]);
  await client.query("COMMIT");
  return res.json({status:"revoked"});
 }catch(err){await client.query("ROLLBACK").catch(()=>{});return failure(res,err);}finally{client.release();}
}
