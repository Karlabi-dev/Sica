import { useEffect,useState } from "react";
import { adminApi } from "./adminApi.js";
const format=value=>value?new Date(value).toLocaleString("pt-BR"):"—";
export default function PatientsPage(){
 const [rows,setRows]=useState([]),[selected,setSelected]=useState(null),[query,setQuery]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 async function load(){try{const r=await adminApi("/admin/patients");setRows(r.patients);setError("");}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function detail(id){try{setSelected(await adminApi("/admin/patients/"+id));setError("");}catch(e){setError(e.message);}}
 const filtered=rows.filter(r=>([r.full_name,r.ticket_code,r.journey_status,r.current_status].join(" ").toLowerCase()).includes(query.toLowerCase()));
 return <main className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">JORNADAS NO NEON</p><h1>Pacientes e senhas</h1><p>Consulte a jornada completa e o link de acompanhamento quando ainda estiver válido.</p></div><button className="admin-primary" onClick={load}>Atualizar</button></div>
 {error&&<p role="alert" className="admin-form-notice">{error}</p>}
 <section className="admin-panel"><div className="admin-records-tools"><input aria-label="Pesquisar pacientes" placeholder="Nome, senha ou situação" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Senha</th><th>Paciente</th><th>Emissão</th><th>Situação</th><th>Histórico</th></tr></thead><tbody>{filtered.map(p=><tr key={p.journey_id}><td>{p.ticket_code}</td><td>{p.full_name??"Aguardando cadastro"}</td><td>{format(p.started_at)}</td><td>{p.current_status??p.journey_status}</td><td><button onClick={()=>detail(p.journey_id)}>Ver jornada</button></td></tr>)}</tbody></table>{!loading&&!filtered.length&&<p>Nenhuma senha encontrada.</p>}</div></section>
 {selected&&<div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="patient-detail-title" style={{maxWidth:760,maxHeight:"90vh",overflowY:"auto"}}><div className="admin-modal-head"><h2 id="patient-detail-title">Histórico do paciente</h2><button aria-label="Fechar" onClick={()=>setSelected(null)}>×</button></div><p><strong>{selected.journey.full_name??"Paciente sem identificação"}</strong> · Início: {format(selected.journey.started_at)}</p>
 {selected.trackingToken&&<p><a href={"/acompanhar/"+encodeURIComponent(selected.trackingToken)} target="_blank" rel="noopener noreferrer">Abrir acompanhamento da senha</a></p>}
 <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Etapa</th><th>Senha</th><th>Entrada</th><th>Chamada</th><th>Início</th><th>Saída</th><th>Status</th></tr></thead><tbody>{selected.events.map(e=><tr key={e.id}><td>{e.queue_name}{e.room_name?" · "+e.room_name:""}</td><td>{e.ticket_code}</td><td>{format(e.enqueued_at)}</td><td>{format(e.called_at)}</td><td>{format(e.service_started_at)}</td><td>{format(e.service_finished_at)}</td><td>{e.status}</td></tr>)}</tbody></table></div><button className="admin-secondary" onClick={()=>setSelected(null)}>Fechar</button></section></div>}
 </main>;
}
