import { useCallback, useEffect, useMemo, useState } from "react";
import { deviceRequest } from "../../services/device.js";
import { QRCodeSVG } from "qrcode.react";
import "./AttendantPage.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const statusLabels = {waiting:"Aguardando",called:"Chamado",in_service:"No balcão",no_show:"Não compareceu",transferred:"Encaminhado",completed:"Encerrado"};
const label = stage => ({reception:"Recepção",consultation:"Consulta",triage:"Triagem",exam:"Exames"})[stage] ?? stage;

export default function AttendantPage() {
  const [data,setData]=useState({queues:[],entries:[]});
  const [tab,setTab]=useState("dashboard");
  const [date,setDate]=useState(()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()));
  const [history,setHistory]=useState([]);
  const [selectedQueue,setSelectedQueue]=useState(null);
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const [loading,setLoading]=useState(true);
  const [patientName,setPatientName]=useState("");
  const [whatsapp,setWhatsapp]=useState("");
  const [destinationQueue,setDestinationQueue]=useState("");
  const [trackingLink,setTrackingLink]=useState("");
  const [receipt,setReceipt]=useState(null);

  const api=useCallback((path,options={})=>deviceRequest(path,options),[]);
  const refresh=useCallback(async ()=>{
    try { const result=await api("/staff/reception/overview");setData(result);setError(""); }
    catch(err){setError(err.message);}
    finally {setLoading(false);}
  },[api]);
  useEffect(()=>{refresh();const id=setInterval(refresh,8000);return()=>clearInterval(id);},[refresh]);

  useEffect(()=>{let alive=true;const load=()=>api("/staff/reception/overview?date="+encodeURIComponent(date)).then(r=>{if(alive)setHistory(r.entries??[]);}).catch(e=>{if(alive)setError(e.message);});load();const timer=setInterval(load,8000);return()=>{alive=false;clearInterval(timer);};},[api,date]);
  const waiting=data.entries.filter(e=>e.status==="waiting"&&e.stage_type==="reception");
  const active=data.entries.filter(e=>e.stage_type==="reception"&&e.own_call&&["called","in_service"].includes(e.status));
  const current=data.entries.find(e=>e.id===selected)??active.find(e=>e.stage_type==="reception")??null;
  const remaining=current?.status==="called"?Math.max(0,Math.ceil((new Date(current.called_at).getTime()+(current.call_count>1?60000:120000)-now)/1000)):null;
  const filtered=useMemo(()=>history.filter(e=>(!selectedQueue||data.queues.find(q=>q.id===selectedQueue)?.name===e.queue_name)&&[e.ticket_code,e.patient_name??"",e.queue_name].some(v=>v.toLowerCase().includes(search.toLowerCase()))),[history,data,selectedQueue,search]);
  const next=[...waiting].sort((a,b)=>Number(b.legal_priority)-Number(a.legal_priority)||new Date(a.enqueued_at)-new Date(b.enqueued_at))[0];

  useEffect(()=>{setPatientName(current?.patient_name??"");setWhatsapp(current?.patient_phone??"");setDestinationQueue("");setTrackingLink("");setReceipt(null);},[current?.id]);
  async function perform(entry,action,automatic=false) {
    if (busy) return;
    setBusy(true);setNotice("");setError("");
    try {
      const result=await api(`/staff/reception/entries/${entry.id}/${action}`,{method:"POST",body:JSON.stringify({automatic})});
      setSelected(["return","complete","no-show"].includes(action)?null:(result.entryId??entry.id));setTab(action==="return"?"pacientes":"atendimento");if(action==="return")setHistory(old=>old.map(e=>e.id===entry.id?{...e,status:"waiting",service_finished_at:null}:e));setTrackingLink("");setReceipt(null);
      setNotice(action==="call"?"Senha chamada. O paciente verá o cronômetro no acompanhamento.":action==="complete"?"Atendimento encerrado.":action==="return"?"Paciente devolvido à fila.":action==="recall"?"Nova chamada realizada.":action==="no-show"?"Ausência registrada.":"Chegada confirmada na recepção.");
      await refresh();
    } catch(err) {setError(err.message);}
    finally {setBusy(false);}
  }

  const destinations=data.queues.filter(q=>["consultation","exam"].includes(q.stage_type));
  async function handoff(entry) {
    if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const result=await api(`/staff/reception/entries/${entry.id}/handoff`,{method:"POST",body:JSON.stringify({patientName,whatsapp,queueId:destinationQueue})});
      const link=await api(`/staff/reception/entries/${result.entryId}/tracking-link`,{method:"POST"});
      const url=window.location.origin+"/acompanhar/"+encodeURIComponent(link.trackingToken);
      setTrackingLink(url);
      setReceipt({ticketCode:entry.ticket_code,patientName:patientName.trim(),queueName:result.queueName,trackingLink:url,issuedAt:new Date().toLocaleString("pt-BR")});
      setNotice(`Paciente encaminhado para ${result.queueName}. Compartilhe o link de acompanhamento.`);
      await refresh();
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function showTracking(entry) {
    setBusy(true);setError("");
    try{
      const result=await api(`/staff/reception/entries/${entry.id}/tracking-link`,{method:"POST"});
      const url=window.location.origin+"/acompanhar/"+encodeURIComponent(result.trackingToken);
      setTrackingLink(url);
      setReceipt({ticketCode:entry.ticket_code,patientName:entry.patient_name,queueName:entry.queue_name,trackingLink:url,issuedAt:new Date().toLocaleString("pt-BR")});
      setSelected(entry.id);setTab("atendimento");
      setNotice("Link original do Totem recuperado. O QR Code permanece o mesmo.");
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }

  return <div className="attendant-app attendant-live">
    <header className="attendant-topbar">
      <div className="attendant-brand"><span className="attendant-brand-icon">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div>
      <div className="attendant-user"><span className="attendant-user-dot">AT</span><span>Recepção <small>Fila conectada ao Neon</small></span></div>
    </header>
    <div className="attendant-container">
      <div className="attendant-title-row"><div><p className="attendant-eyebrow">ÁREA OPERACIONAL</p><h1>Painel do atendente</h1><p>Senhas emitidas pelo Totem e filas da clínica.</p></div><button type="button" className="attendant-outline" onClick={refresh}>Atualizar filas</button></div>
      <nav className="attendant-tabs" aria-label="Navegação do atendente">
        {[["dashboard","Visão geral"],["fila","Fila de espera"],["atendimento","Atendimento"],["pacientes","Histórico de atendimento"]].map(([id,title])=><button key={id} type="button" className={tab===id?"selected":""} onClick={()=>setTab(id)}>{title}</button>)}
      </nav>
      {error&&<div className="attendant-alert" role="alert">{error}</div>}
      {notice&&<div className="attendant-alert" role="status">{notice}</div>}
      {loading?<p>Carregando dados reais...</p>:<>
        {tab==="dashboard"&&<>
          <div className="attendant-stats"><div><span>Aguardando na recepção</span><strong>{waiting.length}</strong><small>Senhas do Totem</small></div><div><span>Chamadas ativas</span><strong>{active.filter(e=>e.status==="called").length}</strong><small>Aguardando comparecimento</small></div><div><span>No balcão</span><strong>{active.filter(e=>e.status==="in_service").length}</strong><small>Chegada confirmada</small></div><div><span>Filas configuradas</span><strong>{data.queues.length}</strong><small>Disponíveis no banco</small></div></div>
          <div className="attendant-grid"><section className="attendant-card"><div className="attendant-card-head"><div><h2>Próxima senha</h2><p>Atendimento por ordem e prioridade</p></div><span className="attendant-chip">Recepção</span></div><div className="attendant-next"><span>PRÓXIMA CHAMADA</span><strong>{next?"Automática":"—"}</strong><p>{waiting.length} aguardando</p></div><button type="button" className="attendant-primary attendant-wide" disabled={!next||busy} onClick={()=>perform(next,"call",true)}>Chamar próxima senha</button></section>
          <section className="attendant-card"><div className="attendant-card-head"><div><h2>Filas da clínica</h2><p>Selecione para visualizar as senhas</p></div></div><div className="attendant-queue-grid">{data.queues.map(q=><button type="button" key={q.id} className="attendant-queue-button" onClick={()=>{setSelectedQueue(q.id);setTab("fila");}}><span>{q.name}</span><strong>{q.waiting}</strong><small>{label(q.stage_type)} · aguardando</small></button>)}</div>{!data.queues.length&&<p>Nenhuma fila configurada.</p>}</section></div>
        </>}
        {tab==="fila"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Filas de espera</h2><label>Data <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><p>Selecione uma fila para visualizar seus atendimentos</p></div></div><div className="attendant-queue-grid">{data.queues.map(q=><button key={q.id} type="button" className={selectedQueue===q.id?"attendant-queue-button active":"attendant-queue-button"} onClick={()=>setSelectedQueue(selectedQueue===q.id?null:q.id)}><span>{q.name}</span><strong>{q.waiting}</strong><small>{label(q.stage_type)}</small></button>)}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"20px 0",gap:12,flexWrap:"wrap"}}><h3>Senhas aguardando na recepção</h3><button className="attendant-primary" disabled={!next||busy} onClick={()=>perform(next,"call",true)}>Chamar próximo automaticamente</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:24}}>{[["insurance","Convênio"],["private","Particular"]].flatMap(([category,name])=>[true,false].map(priority=>{const list=filtered.filter(e=>e.stage_type==="reception"&&e.status==="waiting"&&e.payment_category===category&&e.legal_priority===priority);return <section key={category+priority} style={{border:"1px solid #dce6eb",borderRadius:12,padding:16}}><h3 style={{marginTop:0}}>{name} · {priority?"Prioritário":"Normal"} ({list.length})</h3>{list.map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 0",borderBottom:"1px solid #edf1f4"}}><strong>{e.ticket_code}</strong><button className="attendant-small-button" disabled={busy} onClick={()=>perform(e,"call")}>Chamar</button></div>)}{!list.length&&<p>Nenhuma senha aguardando.</p>}</section>;}))}</div><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Fila</th><th>Prioridade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><strong className="attendant-ticket">{e.ticket_code}</strong></td><td>{e.queue_name}</td><td>{e.legal_priority?"Prioritário":"Comum"}</td><td>{statusLabels[e.status]??e.status}</td><td>{e.stage_type==="reception"&&e.status==="waiting"?<button type="button" disabled={busy} className="attendant-small-button" onClick={()=>perform(e,"call")}>Chamar</button>:<button type="button" className="attendant-small-button" onClick={()=>{setSelected(e.id);setTab("atendimento");setTrackingLink("");}}>Ver detalhes</button>}</td></tr>)}</tbody></table>{!filtered.length&&<div className="attendant-empty">Nenhuma senha nesta seleção.</div>}</div></section>}
        {tab==="atendimento"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Atendimento da recepção</h2><p>Confira a senha e confirme a chegada ao balcão</p></div></div>{current?<><div className="attendant-highlight"><span>SENHA SELECIONADA</span><strong>{current.ticket_code}</strong><p>{current.queue_name}</p></div><div className="attendant-info-grid"><div><span>Situação</span><strong>{statusLabels[current.status]??current.status}</strong></div><div><span>Prioridade</span><strong>{current.legal_priority?"Prioritário":"Comum"}</strong></div><div><span>Paciente</span><strong>{current.patient_name??"Ainda não cadastrado"}</strong></div><div><span>Etapa</span><strong>{label(current.stage_type)}</strong></div></div>{current.stage_type==="reception"&&current.status==="called"&&<div style={{padding:16,margin:"12px 0",background:"#edf7f6",borderRadius:12}}><p>Tempo para comparecimento</p><strong style={{fontSize:32}}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</strong>{remaining===0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{current.call_count<3&&<button className="attendant-primary" disabled={busy} onClick={()=>perform(current,"recall")}>{current.call_count===1?"Realizar segunda chamada":"Chamar mais um minuto"}</button>}{current.call_count>=2&&<button className="attendant-outline" disabled={busy} onClick={()=>perform(current,"no-show")}>Registrar ausência</button>}</div>}</div>}{current.return_observation&&<p role="status">Observação do médico: {current.return_observation}</p>}{current.stage_type==="reception"&&["called","in_service"].includes(current.status)&&current.own_call&&<button type="button" className="attendant-outline" disabled={busy} onClick={()=>{if(window.confirm("Encerrar este atendimento?"))perform(current,"complete");}}>Encerrar atendimento</button>}{current.stage_type==="reception"&&current.status==="called"&&<button type="button" disabled={busy} className="attendant-primary attendant-wide" onClick={()=>perform(current,"arrival")}>Confirmar chegada ao balcão</button>}{current.stage_type==="reception"&&current.status==="in_service"&&<form onSubmit={event=>{event.preventDefault();handoff(current);}} style={{display:"grid",gap:12,marginTop:24}}>
          <h3>Cadastrar paciente e encaminhar</h3>
          <label>Nome completo *<input className="attendant-input" required minLength={2} maxLength={180} value={patientName} onChange={e=>setPatientName(e.target.value)} placeholder="Nome do paciente"/></label>
          <label>WhatsApp (opcional)<input className="attendant-input" type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="(85) 99999-9999"/></label>
          <small>O WhatsApp será cadastrado apenas para testes. Notificações automáticas ainda não estão disponíveis.</small>
          <label>Encaminhar para *<select className="attendant-input" required value={destinationQueue} onChange={e=>setDestinationQueue(e.target.value)}><option value="">Selecione a fila</option>{destinations.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label>
          <button type="submit" className="attendant-primary" disabled={busy||!destinationQueue||!patientName.trim()}>Salvar e encaminhar</button>
        </form>}
        {current.patient_name&&<button type="button" className="attendant-outline" disabled={busy} onClick={()=>showTracking(current)}>Ver link e QR Code originais</button>}
        {trackingLink&&<section style={{padding:16,marginTop:16,background:"#f1f7fb",borderRadius:12,overflowWrap:"anywhere"}}><h3>Acompanhamento pelo celular</h3><div style={{background:"#fff",padding:12,width:"fit-content",borderRadius:8,marginBottom:12}}><QRCodeSVG value={trackingLink} size={184} level="M" /></div><a href={trackingLink} target="_blank" rel="noopener noreferrer">{trackingLink}</a><div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="attendant-outline" onClick={()=>navigator.clipboard.writeText(trackingLink)}>Copiar link</button><a className="attendant-outline" href={trackingLink} target="_blank" rel="noopener noreferrer">Abrir acompanhamento</a></div><button type="button" className="attendant-primary" onClick={()=>window.print()} disabled={!receipt}>Imprimir comprovante</button><small>O link dá acesso ao status da senha. Não compartilhe publicamente. O QR Code é o mesmo do Totem e não muda com o encaminhamento.</small></section>}</>:<div className="attendant-empty">Chame ou selecione uma senha para começar.</div>}</section>}
        {tab==="pacientes"&&<section className="attendant-card"><div className="attendant-card-head"><div><h2>Senhas registradas</h2><label>Data <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><p>Dados operacionais disponíveis no Neon</p></div></div><input className="attendant-input attendant-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar senha, fila ou nome" aria-label="Buscar senhas"/><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Fila</th><th>Paciente</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td>{e.ticket_code}</td><td>{e.queue_name}</td><td>{e.patient_name??"Não cadastrado"}</td><td>{statusLabels[e.status]??e.status}</td><td><button type="button" className="attendant-small-button" onClick={()=>{setSelected(e.id);setTab("atendimento");setTrackingLink("");}}>Detalhes</button>{e.stage_type==="reception"&&["completed","no_show"].includes(e.status)&&<button type="button" className="attendant-small-button" disabled={busy||!e.own_call||!e.service_finished_at||now-new Date(e.service_finished_at).getTime()>=3600000} onClick={()=>{if(window.confirm("Devolver esta senha à fila?"))perform(e,"return");}}>Devolver à fila</button>}</td></tr>)}</tbody></table></div></section>}
      </>}
    </div>
    {receipt&&<div className="sica-print-receipt" aria-hidden="true">
      <div className="sica-print-brand">SICA</div>
      <h2>Comprovante de encaminhamento</h2>
      <p className="sica-print-ticket">{receipt.ticketCode}</p>
      <p><strong>Paciente:</strong> {receipt.patientName}</p>
      <p><strong>Fila:</strong> {receipt.queueName}</p>
      <p><strong>Emissão:</strong> {receipt.issuedAt}</p>
      <div className="sica-print-qr"><QRCodeSVG value={receipt.trackingLink} size={180} level="M" /></div>
      <p>Escaneie o QR Code para acompanhar sua senha pelo celular.</p>
      <p className="sica-print-link">{receipt.trackingLink}</p>
      <small>Guarde este comprovante. O link é pessoal e válido por tempo limitado.</small>
    </div>}
  </div>;
}
