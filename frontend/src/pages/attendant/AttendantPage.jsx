import { useCallback, useEffect, useMemo, useState } from "react";
import { deviceRequest } from "../../services/device.js";
import "./AttendantPage.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const statusLabels = {waiting:"Aguardando",called:"Chamado",in_service:"No balcão",no_show:"Não compareceu",transferred:"Encaminhado"};
const label = stage => ({reception:"Recepção",consultation:"Consulta",triage:"Triagem",exam:"Exames"})[stage] ?? stage;

export default function AttendantPage() {
  const [data,setData]=useState({queues:[],entries:[]});
  const [tab,setTab]=useState("dashboard");
  const [selectedQueue,setSelectedQueue]=useState(null);
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);

  const api=useCallback((path,options={})=>deviceRequest(path,options),[]);
  const refresh=useCallback(async ()=>{
    try { const result=await api("/staff/reception/overview");setData(result);setError(""); }
    catch(err){setError(err.message);}
    finally {setLoading(false);}
  },[api]);
  useEffect(()=>{refresh();const id=setInterval(refresh,8000);return()=>clearInterval(id);},[refresh]);

  const waiting=data.entries.filter(e=>e.status==="waiting"&&e.stage_type==="reception");
  const active=data.entries.filter(e=>e.status==="called"||e.status==="in_service");
  const current=data.entries.find(e=>e.id===selected)??active.find(e=>e.stage_type==="reception")??null;
  const filtered=useMemo(()=>data.entries.filter(e=>(!selectedQueue||data.queues.find(q=>q.id===selectedQueue)?.name===e.queue_name)&&[e.ticket_code,e.patient_name??"",e.queue_name].some(v=>v.toLowerCase().includes(search.toLowerCase()))),[data,selectedQueue,search]);
  const next=[...waiting].sort((a,b)=>Number(b.legal_priority)-Number(a.legal_priority)||new Date(a.enqueued_at)-new Date(b.enqueued_at))[0];

  async function perform(entry,action) {
    if (busy) return;
    setBusy(true);setNotice("");setError("");
    try {
      await api(`/staff/reception/entries/${entry.id}/${action}`,{method:"POST"});
      setSelected(entry.id);setTab("atendimento");
      setNotice(action==="call"?`Senha ${entry.ticket_code} chamada. O paciente verá o cronômetro no acompanhamento.`:"Chegada confirmada na recepção.");
      await refresh();
    } catch(err) {setError(err.message);}
    finally {setBusy(false);}
  }

  return <div className="attendant-app attendant-live">
    <header className="attendant-topbar">
      <div className="attendant-brand"><span className="attendant-brand-icon">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div>
      <div className="attendant-user"><span className="attendant-user-dot">AT</span><span>Recepção <small>Fila conectada ao Neon</small></span></div>
    </header>
    <div className="attendant-container">
      <div className="attendant-title-row"><div><p className="attendant-eyebrow">ÁREA OPERACIONAL</p><h1>Painel do atendente</h1><p>Senhas emitidas pelo Totem e filas da clínica.</p></div><button type="button" className="attendant-outline" onClick={refresh}>Atualizar filas</button></div>
      <nav className="attendant-tabs" aria-label="Navegação do atendente">
        {[["dashboard","Visão geral"],["fila","Fila de espera"],["atendimento","Atendimento"],["pacientes","Senhas do dia"]].map(([id,title])=><button key={id} type="button" className={tab===id?"selected":""} onClick={()=>setTab(id)}>{title}</button>)}
      </nav>
      {error&&<div className="attendant-alert" role="alert">{error}</div>}
      {notice&&<div className="attendant-alert" role="status">{notice}</div>}
      {loading?<p>Carregando dados reais...</p>:<>
        {tab==="dashboard"&&<>
          <div className="attendant-stats"><div><span>Aguardando na recepção</span><strong>{waiting.length}</strong><small>Senhas do Totem</small></div><div><span>Chamadas ativas</span><strong>{active.filter(e=>e.status==="called").length}</strong><small>Aguardando comparecimento</small></div><div><span>No balcão</span><strong>{active.filter(e=>e.status==="in_service").length}</strong><small>Chegada confirmada</small></div><div><span>Filas configuradas</span><strong>{data.queues.length}</strong><small>Disponíveis no banco</small></div></div>
          <div className="attendant-grid"><section className="attendant-card"><div className="attendant-card-head"><div><h2>Próxima senha</h2><p>Atendimento por ordem e prioridade</p></div><span className="attendant-chip">Recepção</span></div><div className="attendant-next"><span>PRÓXIMA CHAMADA</span><strong>{next?.ticket_code??"—"}</strong><p>{waiting.length} aguardando</p></div><button type="button" className="attendant-primary attendant-wide" disabled={!next||busy} onClick={()=>perform(next,"call")}>Chamar próxima senha</button></section>
          <section className="attendant-card"><div className="attendant-card-head"><div><h2>Filas da clínica</h2><p>Selecione para visualizar as senhas</p></div></div><div className="attendant-queue-grid">{data.queues.map(q=><button type="button" key={q.id} className="attendant-queue-button" onClick={()=>{setSelectedQueue(q.id);setTab("fila");}}><span>{q.name}</span><strong>{q.waiting}</strong><small>{label(q.stage_type)} · aguardando</small></button>)}</div>{!data.queues.length&&<p>Nenhuma fila configurada.</p>}</section></div>
        </>}
        {tab==="fila"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Filas de espera</h2><p>Selecione uma fila para visualizar seus atendimentos</p></div></div><div className="attendant-queue-grid">{data.queues.map(q=><button key={q.id} type="button" className={selectedQueue===q.id?"attendant-queue-button active":"attendant-queue-button"} onClick={()=>setSelectedQueue(selectedQueue===q.id?null:q.id)}><span>{q.name}</span><strong>{q.waiting}</strong><small>{label(q.stage_type)}</small></button>)}</div><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Fila</th><th>Prioridade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><strong className="attendant-ticket">{e.ticket_code}</strong></td><td>{e.queue_name}</td><td>{e.legal_priority?"Prioritário":"Comum"}</td><td>{statusLabels[e.status]??e.status}</td><td>{e.stage_type==="reception"&&e.status==="waiting"?<button type="button" disabled={busy} className="attendant-small-button" onClick={()=>perform(e,"call")}>Chamar</button>:<button type="button" className="attendant-small-button" onClick={()=>{setSelected(e.id);setTab("atendimento");}}>Ver detalhes</button>}</td></tr>)}</tbody></table>{!filtered.length&&<div className="attendant-empty">Nenhuma senha nesta seleção.</div>}</div></section>}
        {tab==="atendimento"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Atendimento da recepção</h2><p>Confira a senha e confirme a chegada ao balcão</p></div></div>{current?<><div className="attendant-highlight"><span>SENHA SELECIONADA</span><strong>{current.ticket_code}</strong><p>{current.queue_name}</p></div><div className="attendant-info-grid"><div><span>Situação</span><strong>{statusLabels[current.status]??current.status}</strong></div><div><span>Prioridade</span><strong>{current.legal_priority?"Prioritário":"Comum"}</strong></div><div><span>Paciente</span><strong>{current.patient_name??"Ainda não cadastrado"}</strong></div><div><span>Etapa</span><strong>{label(current.stage_type)}</strong></div></div>{current.stage_type==="reception"&&current.status==="called"&&<button type="button" disabled={busy} className="attendant-primary attendant-wide" onClick={()=>perform(current,"arrival")}>Confirmar chegada ao balcão</button>}<p className="attendant-disclaimer">Cadastro de dados, envio de WhatsApp e encaminhamento estão em preparação; não registre informações clínicas nesta versão.</p></>:<div className="attendant-empty">Chame ou selecione uma senha para começar.</div>}</section>}
        {tab==="pacientes"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Senhas registradas</h2><p>Dados operacionais disponíveis no Neon</p></div></div><input className="attendant-input attendant-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar senha, fila ou nome" aria-label="Buscar senhas"/><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Fila</th><th>Paciente</th><th>Situação</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td>{e.ticket_code}</td><td>{e.queue_name}</td><td>{e.patient_name??"Não cadastrado"}</td><td>{statusLabels[e.status]??e.status}</td></tr>)}</tbody></table></div></section>}
      </>}
    </div>
  </div>;
}
