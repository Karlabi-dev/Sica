import {getPool} from "../config/database.js";
const DEFAULTS={theme:"light",fontScale:100,highContrast:false,reducedMotion:false,arrivalToleranceMinutes:2};
const admin=(req,res)=>req.staff?.role==="admin"||((res.status(403).json({error:"Acesso restrito à administração"})),false);
function validate(p){
 if(!p||typeof p!=="object"||Array.isArray(p))return false;
 const keys=Object.keys(DEFAULTS);
 return Object.keys(p).every(k=>keys.includes(k))&&
 (!("theme" in p)||["light","dark","system"].includes(p.theme))&&
 (!("fontScale" in p)||Number.isInteger(p.fontScale)&&p.fontScale>=85&&p.fontScale<=135)&&
 (!("highContrast" in p)||typeof p.highContrast==="boolean")&&
 (!("reducedMotion" in p)||typeof p.reducedMotion==="boolean")&&
 (!("arrivalToleranceMinutes" in p)||Number.isInteger(p.arrivalToleranceMinutes)&&p.arrivalToleranceMinutes>=1&&p.arrivalToleranceMinutes<=30);
}
export async function readClinicSettings(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 try{const {rows}=await getPool().query("SELECT name,website_url,timezone,preferences FROM public.clinic_settings WHERE id=1");
  const row=rows[0]??{};return res.json({name:row.name??"SICA",websiteUrl:row.website_url??"",timezone:row.timezone??"America/Fortaleza",preferences:{...DEFAULTS,...row.preferences}});
 }catch(e){console.error("Clinic settings read failed",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Configurações indisponíveis. Verifique se a migração 0012 foi aplicada."});}
}
export async function updateClinicSettings(req,res){
 res.set("Cache-Control","no-store");if(!admin(req,res))return;
 const {name,websiteUrl="",preferences}=req.body??{};
 if(typeof name!=="string"||name.trim().length<2||name.trim().length>160||typeof websiteUrl!=="string"||websiteUrl.length>500||(websiteUrl&&!/^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(websiteUrl))||!validate(preferences))
  return res.status(400).json({error:"Revise o nome, endereço do site e preferências."});
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const current=await client.query("SELECT name,website_url,preferences FROM public.clinic_settings WHERE id=1 FOR UPDATE");
  const old=current.rows[0]??{};
  const next={...DEFAULTS,...old.preferences,...preferences};
  await client.query(`INSERT INTO public.clinic_settings(id,name,website_url,timezone,preferences)
   VALUES(1,$1,$2,'America/Fortaleza',$3::jsonb)
   ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,website_url=EXCLUDED.website_url,preferences=EXCLUDED.preferences,updated_at=now()`,[name.trim(),websiteUrl.trim()||null,JSON.stringify(next)]);
  const changed=Object.keys(next).filter(k=>JSON.stringify(old.preferences?.[k]??DEFAULTS[k])!==JSON.stringify(next[k]));
  await client.query("INSERT INTO public.audit_events(actor_user_id,action,resource_type,metadata) VALUES($1,'clinic.settings.updated','clinic_settings',$2::jsonb)",[req.staff.id,JSON.stringify({changedFields:[...(old.name!==name.trim()?["name"]:[]),...(old.website_url!==(websiteUrl.trim()||null)?["websiteUrl"]:[]),...changed]})]);
  await client.query("COMMIT");
  return res.json({name:name.trim(),websiteUrl:websiteUrl.trim(),preferences:next,message:"Configurações salvas com sucesso."});
 }catch(e){await client.query("ROLLBACK").catch(()=>{});console.error("Clinic settings update failed",{code:e.code??"UNKNOWN"});return res.status(503).json({error:"Não foi possível salvar as configurações. Verifique a migração 0012."});}finally{client.release();}
}
