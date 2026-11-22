import { useEffect,useState } from "react";
import { adminApi } from "./adminApi.js";
export default function CatalogPage({kind}){
 const [data,setData]=useState({rooms:[],specialties:[]}),[form,setForm]=useState({id:null,name:"",active:true}),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const title=kind==="rooms"?"Salas e consultórios":"Especialidades";
 async function load(){try{setData(await adminApi("/admin/catalog"));setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{setForm({id:null,name:"",active:true});load();},[kind]);
 async function remove(item){
  if(!window.confirm(`Excluir ${item.name}? Esta ação não poderá ser desfeita.`))return;
  setBusy(true);setError("");setNotice("");
  try{await adminApi("/admin/catalog/"+kind+"/"+item.id,{method:"DELETE"});setNotice("Registro excluído do Neon.");if(form.id===item.id)setForm({id:null,name:"",active:true});await load();}
  catch(err){setError(err.message);}finally{setBusy(false);}
 }
 async function save(e){e.preventDefault();setBusy(true);setError("");setNotice("");try{await adminApi("/admin/catalog/"+kind+(form.id?"/"+form.id:""),{method:form.id?"PATCH":"POST",body:JSON.stringify({name:form.name,active:form.active})});setNotice("Registro salvo no Neon.");setForm({id:null,name:"",active:true});await load();}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <main className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">CADASTRO DA CLÍNICA</p><h1>{title}</h1><p>Cadastre, edite, desative ou exclua registros sem vínculos. Especialidades utilizadas por médicos ou filas devem ser desativadas para preservar o histórico.</p></div></div>{error&&<p role="alert" className="admin-form-notice">{error}</p>}{notice&&<p role="status" className="admin-form-notice">{notice}</p>}
 <section className="admin-panel admin-settings"><h2>{form.id?"Editar":"Cadastrar"} {kind==="rooms"?"consultório":"especialidade"}</h2><form onSubmit={save}><label>Nome<input required minLength={2} maxLength={100} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></label><label><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/> Ativar</label><div style={{display:"flex",gap:12}}><button className="admin-primary" disabled={busy}>Salvar no banco</button>{form.id&&<button type="button" className="admin-secondary" onClick={()=>setForm({id:null,name:"",active:true})}>Cancelar</button>}</div></form></section>
 <section className="admin-panel"><h2>Registros cadastrados</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nome</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{data[kind]?.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.active?"Ativo":"Inativo"}</td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy} onClick={()=>{setForm(r);setNotice("");window.scrollTo({top:0,behavior:"smooth"});}}>Editar</button><button disabled={busy} onClick={()=>remove(r)}>Excluir</button></div></td></tr>)}</tbody></table></div></section></main>;
}
