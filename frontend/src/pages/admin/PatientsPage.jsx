import {useEffect,useMemo,useState} from "react";
import {adminApi} from "./adminApi.js";
import "./PatientsPage.css";

const format=value=>value?new Date(value).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"—";
const normalize=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const statusLabels={no_show:"Não compareceu",waiting:"Aguardando",called:"Chamado",in_service:"Em atendimento",completed:"Concluído",finished:"Finalizado",cancelled:"Cancelado",missed:"Chamada perdida",linked:"Vinculado",active:"Em andamento"};
const statusLabel=value=>statusLabels[value]??(value?String(value).replace(/_/g," "):"Não informado");
const statusTone=value=>["waiting","called","in_service","active"].includes(value)?"ongoing":["completed","finished"].includes(value)?"done":["cancelled","missed"].includes(value)?"stopped":"neutral";

export default function PatientsPage(){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 const [closeEntry,setCloseEntry]=useState(null),[closeReason,setCloseReason]=useState(""),[closeBusy,setCloseBusy]=useState(false),[returnEntry,setReturnEntry]=useState(null),[returnReason,setReturnReason]=useState(""),[returnBusy,setReturnBusy]=useState(false),[notice,setNotice]=useState(""),[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[error,setError]=useState(""),[loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false);
 async function load(){setLoading(true);try{const r=await adminApi("/admin/patients");setRows(r.patients??[]);setError("");}catch(e){setError(e.message);}finally{setLoading(false);}}
 async function detail(id){setDetailLoading(true);try{setSelected(await adminApi("/admin/patients/"+id));setError("");}catch(e){setError(e.message);}finally{setDetailLoading(false);}}
 useEffect(()=>{load();const id=new URLSearchParams(window.location.search).get("journey");if(id&&/^[0-9a-f-]{36}$/i.test(id))detail(id);},[]);
 async function returnToQueue(e){
  e.preventDefault();
  if(!returnEntry||returnReason.trim().length<10)return;
  setReturnBusy(true);setError("");setNotice("");
  try{
   await adminApi("/admin/patients/entries/"+returnEntry.id+"/return-to-queue",{method:"POST",body:JSON.stringify({reason:returnReason.trim()})});
   setNotice("Paciente devolvido à fila com sucesso.");
   setReturnEntry(null);setReturnReason("");
   await Promise.all([load(),detail(selected.journey.id)]);
  }catch(err){setError(err.message);}finally{setReturnBusy(false);}
 }
 async function closeAttendance(event){
  event.preventDefault();
  if(!closeEntry||closeReason.trim().length<10)return;
  setCloseBusy(true);setError("");setNotice("");
  try{
   await adminApi("/admin/patients/entries/"+closeEntry.id+"/close",{method:"POST",body:JSON.stringify({reason:closeReason.trim()})});
   setNotice("Atendimento encerrado administrativamente. A operação foi registrada na auditoria.");
   setCloseEntry(null);setCloseReason("");
   await Promise.all([load(),detail(selected.journey.id)]);
  }catch(err){setError(err.message);}finally{setCloseBusy(false);}
 }
 const counts=useMemo(()=>({total:rows.length,waiting:rows.filter(r=>["waiting","called"].includes(r.current_status)).length,inService:rows.filter(r=>r.current_status==="in_service").length,completed:rows.filter(r=>["completed","finished"].includes(r.current_status)||r.journey_status==="completed").length}),[rows]);
 const filtered=useMemo(()=>rows.filter(r=>{
  const matches=[r.full_name,r.ticket_code,r.journey_status,r.current_status].some(x=>normalize(x).includes(normalize(query.trim())));
  return matches&&(filter==="all"||(filter==="waiting"?["waiting","called"].includes(r.current_status):filter==="in_service"?r.current_status==="in_service":filter==="completed"?r.journey_status==="completed"||["completed","finished"].includes(r.current_status):true));
 }),[rows,query,filter]);
 return <main className="admin-page patients-page">
  <header className="admin-page-heading patients-heading"><div><p className="admin-eyebrow">CENTRAL DE ATENDIMENTOS</p><h1>Gestão de pacientes</h1><p>Uma visão completa das jornadas, filas e atendimentos da clínica.</p></div><button type="button" className="admin-secondary" disabled={loading} onClick={load}>{loading?"Atualizando...":"↻ Atualizar painel"}</button></header>
  <div className="patients-kpis"><div className="patients-kpi-total"><span>Jornadas registradas</span><strong>{counts.total}</strong><small>Total consultado</small></div><div><span>Aguardando ou chamados</span><strong>{counts.waiting}</strong><small>Pacientes na fila</small></div><div><span>Em atendimento</span><strong>{counts.inService}</strong><small>Atendimentos em andamento</small></div><div><span>Concluídos</span><strong>{counts.completed}</strong><small>Jornadas finalizadas</small></div></div>
  {error&&<div className="patients-feedback" role="alert">{error}</div>}{notice&&<div className="patients-feedback patients-notice" role="status">{notice}</div>}
  <section className="admin-panel patients-list">
   <div className="patients-section-heading"><div><h2>Lista de pacientes</h2><p>Pesquise pelo nome, número da senha ou situação.</p></div><span>{filtered.length} resultado{filtered.length===1?"":"s"}</span></div>
   <div className="patients-toolbar"><label>Pesquisar paciente<input type="search" placeholder="Nome, senha ou situação..." value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Filtrar situação<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as situações</option><option value="waiting">Aguardando / chamados</option><option value="in_service">Em atendimento</option><option value="completed">Concluídos</option></select></label>{(query||filter!=="all")&&<button type="button" className="admin-secondary" onClick={()=>{setQuery("");setFilter("all");}}>Limpar filtros</button>}</div>
   <div className="admin-table-wrap"><table className="admin-table patients-table"><thead><tr><th>Senha</th><th>Paciente</th><th>Entrada</th><th>Situação atual</th><th>Ação</th></tr></thead><tbody>{filtered.map(p=>{const status=p.current_status??p.journey_status;return <tr key={p.journey_id}><td><span className="patients-ticket">{p.ticket_code??"—"}</span></td><td><div className="patients-person"><span className="patients-avatar" aria-hidden="true">{(p.full_name??"?").trim().charAt(0).toUpperCase()}</span><div><strong>{p.full_name??"Aguardando cadastro"}</strong><small>Jornada registrada</small></div></div></td><td>{format(p.started_at)}</td><td><span className={"patients-status "+statusTone(status)}>{statusLabel(status)}</span></td><td><button type="button" className="patients-detail-button" disabled={detailLoading} onClick={()=>detail(p.journey_id)}>Ver detalhes <span aria-hidden="true">→</span></button></td></tr>})}</tbody></table>{loading&&<div className="patients-empty">Carregando pacientes...</div>}{!loading&&!filtered.length&&<div className="patients-empty">{rows.length?"Nenhum paciente encontrado para os filtros selecionados.":"Nenhuma jornada de paciente cadastrada."}</div>}</div>
  </section>
  {selected&&<div className="admin-modal-backdrop"><section className="admin-modal patients-modal" role="dialog" aria-modal="true" aria-labelledby="patient-detail-title"><div className="admin-modal-head"><div><p className="admin-eyebrow">HISTÓRICO DA JORNADA</p><h2 id="patient-detail-title">{selected.journey.full_name??"Paciente sem identificação"}</h2></div><button type="button" aria-label="Fechar" onClick={()=>setSelected(null)}>×</button></div>
   <div className="patients-modal-summary"><div><span>Início da jornada</span><strong>{format(selected.journey.started_at)}</strong></div><div><span>Situação</span><strong>{statusLabel(selected.journey.status)}</strong></div><div><span>Etapas registradas</span><strong>{selected.events?.length??0}</strong></div></div>
   {selected.trackingToken&&<a className="patients-tracking" href={"/acompanhar/"+encodeURIComponent(selected.trackingToken)} target="_blank" rel="noopener noreferrer">Abrir acompanhamento da senha ↗</a>}
   <h3 className="patients-history-title">Linha do tempo dos atendimentos</h3>
   <div className="patients-history">{(selected.events??[]).map((e,i)=><article className="patients-event" key={e.id}><span className="patients-event-number">{i+1}</span><div className="patients-event-content"><div className="patients-event-top"><strong>{e.queue_name??"Etapa do atendimento"}</strong><span className={"patients-status "+statusTone(e.status)}>{statusLabel(e.status)}</span></div><p>{e.room_name?"Consultório: "+e.room_name+" · ":""}Senha: {e.ticket_code??"—"}</p>{["completed","no_show","cancelled"].includes(e.status)&&<button type="button" disabled={!e.service_finished_at||now-new Date(e.service_finished_at).getTime()>=3600000||selected.journey?.status==="completed"} className="patients-return-button" onClick={()=>{setReturnEntry(e);setReturnReason("");setError("");}}>↩ Devolver à fila</button>}{["waiting","called","in_service"].includes(e.status)&&<button type="button" className="patients-close-button" onClick={()=>{setCloseEntry(e);setCloseReason("");setError("");}}>Encerrar atendimento</button>}<div className="patients-event-times"><span><b>Entrada</b>{format(e.enqueued_at)}</span><span><b>Chamada</b>{format(e.called_at)}</span><span><b>Início</b>{format(e.service_started_at)}</span><span><b>Saída</b>{format(e.service_finished_at)}</span></div></div></article>)}{!selected.events?.length&&<p className="patients-empty">Nenhuma etapa registrada.</p>}</div>
   <div className="patients-modal-actions"><button type="button" className="admin-secondary" onClick={()=>setSelected(null)}>Fechar histórico</button></div>
  </section></div>}
 {closeEntry&&<div className="admin-modal-backdrop patients-confirm-overlay"><section className="admin-modal patients-return-modal" role="dialog" aria-modal="true" aria-labelledby="patients-close-title"><div className="admin-modal-head"><div><p className="admin-eyebrow">AÇÃO ADMINISTRATIVA</p><h2 id="patients-close-title">Encerrar atendimento</h2></div><button type="button" aria-label="Fechar" onClick={()=>setCloseEntry(null)}>×</button></div><p>Esta ação encerra operacionalmente o atendimento e impede novas chamadas desta senha. Não significa que a consulta foi clinicamente concluída.</p>{error&&<div className="patients-feedback" role="alert">{error}</div>}<form onSubmit={closeAttendance}><label>Motivo do encerramento <span aria-hidden="true">*</span><textarea required minLength={10} maxLength={300} rows={3} value={closeReason} onChange={e=>setCloseReason(e.target.value)} placeholder="Descreva o motivo do encerramento administrativo..."/></label><div className="patients-modal-actions"><button type="button" className="admin-secondary" onClick={()=>setCloseEntry(null)} disabled={closeBusy}>Cancelar</button><button type="submit" className="patients-confirm-close" disabled={closeBusy||closeReason.trim().length<10}>{closeBusy?"Encerrando...":"Confirmar encerramento"}</button></div></form></section></div>}
 {returnEntry&&<div className="admin-modal-backdrop"><section className="admin-modal patients-return-modal" role="dialog" aria-modal="true" aria-labelledby="patients-return-title"><div className="admin-modal-head"><h2 id="patients-return-title">Devolver paciente à fila</h2><button type="button" aria-label="Fechar" onClick={()=>setReturnEntry(null)}>×</button></div><p>O paciente voltará à espera na sua categoria original, dentro do prazo de uma hora. Essa ação ficará registrada na auditoria.</p><form onSubmit={returnToQueue}><label>Motivo obrigatório<textarea required minLength={10} maxLength={300} rows={3} value={returnReason} onChange={e=>setReturnReason(e.target.value)} placeholder="Ex.: O paciente perdeu a chamada e retornou à recepção."/></label><div className="patients-modal-actions"><button type="button" className="admin-secondary" onClick={()=>setReturnEntry(null)}>Cancelar</button><button type="submit" className="admin-primary" disabled={returnBusy||returnReason.trim().length<10||!returnEntry.service_finished_at||now-new Date(returnEntry.service_finished_at).getTime()>=3600000}>{returnBusy?"Salvando...":"Confirmar retorno"}</button></div></form></section></div>}
 </main>;
}
