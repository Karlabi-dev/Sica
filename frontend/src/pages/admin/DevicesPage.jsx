import { getAdminSession } from "../../services/adminSession.js";
import { useCallback,useEffect,useState } from "react";
import { auth } from "../../services/firebase.js";
const API=import.meta.env.VITE_API_BASE_URL??"http://localhost:3001";
export default function DevicesPage(){
 const [devices,setDevices]=useState([]);
 const [doctors,setDoctors]=useState([]);
 const [forms,setForms]=useState({});
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const api=useCallback(async(path,options={})=>{
  const user=auth.currentUser;
  if(!user) throw new Error("Entre como administrador");
  const token=await user.getIdToken();
  const response=await fetch(API+path,{...options,headers:{Authorization:"Bearer "+token,"X-Admin-Session":getAdminSession(user.uid),...(options.headers??{})},cache:"no-store"});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error??"Operação não autorizada");
  return body;
 },[]);
 const refresh=useCallback(async()=>{try{const data=await api("/admin/devices");setDevices(data.devices);const catalog=await api("/admin/doctors");setDoctors(catalog.doctors.filter(d=>d.active&&d.enabled));setError("");}catch(e){setError(e.message);}},[api]);
 useEffect(()=>{refresh();const id=setInterval(refresh,10000);return()=>clearInterval(id);},[refresh]);
 async function action(device,type){
  if(type==="revoke"&&!window.confirm("Revogar o acesso deste computador?"))return;
  const form=forms[device.id]??{};
  setBusy(true);setError("");setNotice("");
  try{
   await api("/admin/devices/"+device.id+"/"+(type==="revoke"?"revoke":"approve"),{method:type==="revoke"?"POST":"PATCH",headers:{"Content-Type":"application/json"},body:type==="approve"?JSON.stringify({name:form.name??device.name??"",role:form.role??device.role??"attendant",doctorId:form.doctorId??device.staff_user_id??null}):undefined});
   setNotice(type==="revoke"?"Acesso revogado.":"Computador autorizado.");
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const change=(id,field,value)=>setForms(f=>({...f,[id]:{...f[id],[field]:value}}));
 return <main className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">SEGURANÇA</p><h1>Dispositivos autorizados</h1><p>Aprove e identifique os computadores dos guichês e consultórios. Somente administradores podem autorizar.</p></div><button className="admin-primary" onClick={refresh}>Atualizar</button></div>
 {error&&<p role="alert" className="admin-form-notice">{error}</p>}{notice&&<p role="status" className="admin-form-notice">{notice}</p>}
 <section className="admin-panel"><h2>Computadores da clínica</h2><p>Para solicitar acesso, abra /atendente ou /medico no computador que será autorizado.</p>
 <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Dispositivo</th><th>Função</th><th>Médico vinculado</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{devices.map(d=><tr key={d.id}><td><input aria-label="Nome do dispositivo" maxLength={120} placeholder="Ex.: Computador do Guichê 1" value={forms[d.id]?.name??d.name??""} onChange={e=>change(d.id,"name",e.target.value)}/><small style={{display:"block"}}>Solicitado: {new Date(d.requested_at).toLocaleString("pt-BR")}</small></td><td><select aria-label="Função do dispositivo" value={forms[d.id]?.role??d.role??"attendant"} onChange={e=>change(d.id,"role",e.target.value)}><option value="attendant">Atendente</option><option value="doctor">Médico</option></select></td><td>{(forms[d.id]?.role??d.role)==="doctor"?<select aria-label="Médico vinculado" value={forms[d.id]?.doctorId??d.staff_user_id??""} onChange={e=>change(d.id,"doctorId",e.target.value)}><option value="">Selecione o médico</option>{doctors.map(m=><option key={m.id} value={m.id}>{m.display_name} · {m.room_name}</option>)}</select>:"—"}</td><td>{d.status==="pending"?"Aguardando":d.status==="active"?"Autorizado":"Revogado"}</td><td>{d.status!=="revoked"&&<><button disabled={busy} onClick={()=>action(d,"approve")}>Salvar / autorizar</button>{" "}<button disabled={busy} onClick={()=>action(d,"revoke")}>Revogar</button></>}</td></tr>)}</tbody></table>{!devices.length&&<p>Nenhum computador solicitou autorização.</p>}</div></section></main>;
}
