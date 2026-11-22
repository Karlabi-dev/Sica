import { getAdminSession } from "../../services/adminSession.js";
import { useCallback, useEffect, useState } from "react";
import { auth } from "../../services/firebase.js";

const API=import.meta.env.VITE_API_BASE_URL??"http://localhost:3001";
const empty={name:"",roomId:"",queueId:"",active:true};

export default function DoctorsPage(){
 const [data,setData]=useState({doctors:[],rooms:[],queues:[]});
 const [form,setForm]=useState(empty);
 const [editing,setEditing]=useState(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const api=useCallback(async(path,options={})=>{
  if(!auth.currentUser) throw new Error("Entre como administrador.");
  const token=await auth.currentUser.getIdToken();
  const response=await fetch(API+path,{...options,cache:"no-store",headers:{"Authorization":"Bearer "+token,"X-Admin-Session":getAdminSession(auth.currentUser.uid),"Content-Type":"application/json",...(options.headers??{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error??"Operação não autorizada");
  return body;
 },[]);
 const refresh=useCallback(async()=>{try{setData(await api("/admin/doctors"));setError("");}catch(e){setError(e.message);}},[api]);
 useEffect(()=>{refresh();},[refresh]);
 const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 const edit=d=>{setEditing(d.id);setForm({name:d.display_name,roomId:d.room_id??"",queueId:d.queue_definition_id??"",active:d.active});setNotice("");};
 const reset=()=>{setEditing(null);setForm(empty);};
 async function save(e){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   await api(editing?"/admin/doctors/"+editing:"/admin/doctors",{method:editing?"PATCH":"POST",body:JSON.stringify(form)});
   setNotice(editing?"Médico atualizado no Neon.":"Médico cadastrado no Neon. Autorize o computador na seção Dispositivos.");
   reset();await refresh();
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <main className="admin-page">
  <div className="admin-page-heading"><div><p className="admin-eyebrow">EQUIPE CLÍNICA</p><h1>Cadastro de médicos</h1><p>Cadastre o profissional, vincule seu consultório e escolha a fila de atendimento.</p></div><button className="admin-primary" onClick={refresh}>Atualizar</button></div>
  {error&&<p className="admin-form-notice" role="alert">{error}</p>}
  {notice&&<p className="admin-form-notice" role="status">{notice}</p>}
  <section className="admin-panel admin-settings"><h2>{editing?"Editar médico":"Novo médico"}</h2>
   <form onSubmit={save}>
    <label>Nome completo do médico<input required minLength={3} maxLength={160} value={form.name} onChange={e=>change("name",e.target.value)} placeholder="Ex.: Dra. Maria Silva"/></label>
    <label>Consultório<select required value={form.roomId} onChange={e=>change("roomId",e.target.value)}><option value="">Selecione um consultório</option>{data.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    <label>Fila / especialidade<select required value={form.queueId} onChange={e=>change("queueId",e.target.value)}><option value="">Selecione uma fila</option>{data.queues.map(q=><option key={q.id} value={q.id}>{q.name} — {q.queue_mode==="shared"?"Compartilhada":"Individual"}</option>)}</select></label>
    {editing&&<label><input type="checkbox" checked={form.active} onChange={e=>change("active",e.target.checked)}/> Médico ativo</label>}
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button className="admin-primary" disabled={busy||!form.roomId||!form.queueId}>{busy?"Salvando...":editing?"Salvar alterações":"Cadastrar médico"}</button>{editing&&<button type="button" className="admin-secondary" onClick={reset}>Cancelar edição</button>}</div>
   </form>
   <p className="admin-section-note">O cadastro não autoriza automaticamente o acesso. O administrador também precisa aprovar o dispositivo do consultório. Uma fila compartilhada aceita vários médicos; uma individual, apenas um.</p>
  </section>
  <section className="admin-panel"><h2>Médicos cadastrados</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nome</th><th>Consultório</th><th>Fila</th><th>Modalidade</th><th>Status</th><th>Ação</th></tr></thead><tbody>{data.doctors.map(d=><tr key={d.id}><td>{d.display_name}</td><td>{d.room_name??"Não vinculado"}</td><td>{d.queue_name??"Não vinculada"}</td><td>{d.queue_mode==="shared"?"Compartilhada":d.queue_mode==="individual"?"Individual":"—"}</td><td>{d.active?"Ativo":"Inativo"}</td><td><button onClick={()=>edit(d)}>Editar</button></td></tr>)}</tbody></table>{!data.doctors.length&&<p>Nenhum médico cadastrado.</p>}</div></section>
 </main>;
}
