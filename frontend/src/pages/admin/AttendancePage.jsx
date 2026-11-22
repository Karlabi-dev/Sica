import { useCallback,useEffect,useMemo,useState } from "react";
import { adminApi } from "./adminApi.js";
import { QRCodeSVG } from "qrcode.react";
import "./AttendancePage.css";
const statusText={waiting:"Aguardando",called:"Chamado",in_service:"Em atendimento"};
const stageText={reception:"Recepção",triage:"Triagem",consultation:"Consulta",exam:"Exame"};
const fmt=v=>v?new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"medium"}):"—";
const elapsed=(value,now)=>value?Math.max(0,Math.floor((now-new Date(value).getTime())/60000))+" min":"—";
export default function AttendancePage(){
 const [tracking,setTracking]=useState({entryId:null,url:"",loading:false,error:""});
 const [data,setData]=useState({queues:[],entries:[]}),[queue,setQueue]=useState("all"),[status,setStatus]=useState("all"),[search,setSearch]=useState(""),[selected,setSelected]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[lastUpdate,setLastUpdate]=useState(null),[now,setNow]=useState(Date.now());
 const refresh=useCallback(async()=>{try{const result=await adminApi("/admin/attendance");setData(result);setLastUpdate(new Date());setError("");}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh();const interval=setInterval(refresh,5000);const clock=setInterval(()=>setNow(Date.now()),15000);return()=>{clearInterval(interval);clearInterval(clock);};},[refresh]);
 const rows=useMemo(()=>data.entries.filter(e=>(queue==="all"||e.definition_id===queue)&&(status==="all"||e.status===status)&&([e.ticket_code,e.patient_name,e.queue_name,e.specialty_name,e.professional_name].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))),[data,queue,status,search]);
 const counts={waiting:rows.filter(e=>e.status==="waiting").length,called:rows.filter(e=>e.status==="called").length,in_service:rows.filter(e=>e.status==="in_service").length};
 const alerts=rows.filter(e=>e.delay?.level).sort((a,b)=>(b.delay.level==="critical")-(a.delay.level==="critical")||b.delay.elapsedMinutes-a.delay.elapsedMinutes);
 const detail=data.entries.find(e=>e.id===selected);
 function closeDetail(){setSelected(null);setTracking({entryId:null,url:"",loading:false,error:""});}
 function selectDetail(id){setSelected(id);setTracking({entryId:null,url:"",loading:false,error:""});}
 async function showTracking(entry){
  setTracking({entryId:entry.id,url:"",loading:true,error:""});
  try{
   const result=await adminApi("/admin/attendance/"+entry.id+"/tracking-link",{method:"POST"});
   const url=window.location.origin+"/acompanhar/"+encodeURIComponent(result.trackingToken);
   setTracking({entryId:entry.id,url,loading:false,error:""});
  }catch(e){setTracking({entryId:entry.id,url:"",loading:false,error:e.message});}
 }
 async function copyTracking(){
  try{await navigator.clipboard.writeText(tracking.url);}catch{setTracking(s=>({...s,error:"Não foi possível copiar automaticamente. Selecione o link para copiar."}));}
 }
 return <main className="admin-page attendance-page">
  <div className="admin-page-heading"><div><p className="admin-eyebrow">OPERAÇÃO EM TEMPO REAL</p><h1>Atendimentos</h1><p>Acompanhe as fichas ativas de todas as filas da clínica, diretamente do Neon.</p></div><button type="button" className="admin-primary" onClick={refresh}>Atualizar agora</button></div>
  <div className="attendance-sync"><span className={"attendance-dot"+(error?" is-offline":"")}/>{error?"Conexão indisponível — últimos dados carregados":"Atualização automática a cada 5 segundos"}<span>Última atualização: {lastUpdate?lastUpdate.toLocaleTimeString("pt-BR"):"Aguardando..."}</span></div>
  {error&&<p className="admin-form-notice" role="alert">{error}</p>}
  <section className="attendance-filters admin-panel" aria-label="Filtros de atendimento">
   <label>Fila / especialidade<select value={queue} onChange={e=>setQueue(e.target.value)}><option value="all">Todas as filas</option>{data.queues.map(q=><option key={q.id} value={q.id}>{q.name}{q.specialty_name?" · "+q.specialty_name:""}{q.doctors?" · "+q.doctors:""}</option>)}</select></label>
   <label>Situação<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todas as situações</option><option value="waiting">Aguardando</option><option value="called">Chamado</option><option value="in_service">Em atendimento</option></select></label>
   <label>Buscar ficha<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Senha, nome ou especialidade"/></label>
   <button type="button" className="admin-secondary" onClick={()=>{setQueue("all");setStatus("all");setSearch("");}}>Limpar filtros</button>
  </section>
  <section className="attendance-alerts admin-panel" aria-live="polite">
   <div className="admin-panel-title"><div><h2>Alertas de demora {alerts.length>0&&<span className="attendance-alert-count">{alerts.length}</span>}</h2><p>Monitoramento automático das fichas ativas. Atualiza a cada 5 segundos.</p></div></div>
   {alerts.length? <div className="attendance-alert-list">{alerts.map(e=><button type="button" key={e.id} className={"attendance-alert attendance-alert-"+e.delay.level} onClick={()=>selectDetail(e.id)}>
    <span className="attendance-alert-symbol" aria-hidden="true">{e.delay.level==="critical"?"!":"⏱"}</span>
    <span><strong>{e.ticket_code} · {e.queue_name}</strong><small>{e.status==="waiting"?"Espera na fila":e.status==="called"?"Aguardando chegada":"Atendimento em andamento"} · {e.delay.elapsedMinutes} min · limite {e.delay.thresholdMinutes} min</small></span>
    <span className="attendance-alert-label">{e.delay.level==="critical"?"Crítico":"Atenção"}</span></button>)}</div>:
   <p className="attendance-alert-ok">Nenhuma demora identificada nas fichas exibidas.</p>}
   <p className="admin-section-note">Critérios iniciais: chamada sem chegada após 2 min; demais etapas após 150% da média dos últimos 30 dias (mínimo de 5 atendimentos concluídos), com limites mínimos de segurança. Sem histórico suficiente, usamos referências provisórias por etapa. Alertas não alteram as filas.</p>
  </section>
  <div className="attendance-stats"><div><span>Fichas exibidas</span><strong>{rows.length}</strong></div><div><span>Aguardando</span><strong>{counts.waiting}</strong></div><div><span>Chamadas</span><strong>{counts.called}</strong></div><div><span>Em atendimento</span><strong>{counts.in_service}</strong></div></div>
  <section className="admin-panel"><div className="admin-panel-title"><div><h2>Fichas ativas</h2><p>{loading?"Consultando o banco...":"Somente senhas aguardando, chamadas ou em atendimento"}</p></div></div>
   <div className="admin-table-wrap"><table className="admin-table attendance-table"><thead><tr><th>Senha</th><th>Paciente</th><th>Fila</th><th>Profissional / sala</th><th>Situação</th><th>Tempo</th><th>Alerta</th><th>Detalhes</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td><strong>{e.ticket_code}</strong>{e.legal_priority&&<small className="attendance-priority">Prioritário</small>}</td><td>{e.patient_name??"Não identificado"}</td><td><strong>{e.queue_name}</strong><small>{e.specialty_name??stageText[e.stage_type]??"—"}</small></td><td>{e.professional_name??"Fila compartilhada"}<small>{e.room_name??"Consultório não informado"}</small></td><td><span className={"attendance-status attendance-status-"+e.status}>{statusText[e.status]}</span></td><td>{elapsed(e.status==="waiting"?e.enqueued_at:e.status==="called"?e.called_at:e.service_started_at,now)}</td><td>{e.delay?.level?<span className={"attendance-status attendance-alert-"+e.delay.level}>{e.delay.level==="critical"?"Crítico":"Demora"}</span>:"—"}</td><td><button type="button" onClick={()=>selectDetail(e.id)}>Visualizar</button></td></tr>)}</tbody></table>{!loading&&!rows.length&&<div className="attendance-empty"><strong>Nenhuma ficha encontrada</strong><p>Não há senhas ativas correspondentes aos filtros selecionados.</p></div>}</div>
  </section>
  <p className="admin-section-note">Os registros finalizados permanecem disponíveis em Pacientes. Esta tela é de consulta e não altera a ordem das chamadas.</p>
  {detail&&<div className="admin-modal-backdrop" onClick={closeDetail}><section className="admin-modal attendance-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-detail-title" onClick={e=>e.stopPropagation()}><div className="admin-modal-head"><div><p className="admin-eyebrow">FICHA EM TEMPO REAL</p><h2 id="attendance-detail-title">Senha {detail.ticket_code}</h2></div><button aria-label="Fechar" onClick={closeDetail}>×</button></div><span className={"attendance-status attendance-status-"+detail.status}>{statusText[detail.status]}</span>
   {detail.delay?.level&&<div className={"attendance-detail-warning attendance-alert-"+detail.delay.level}><strong>{detail.delay.level==="critical"?"Demora crítica":"Tempo acima do esperado"}</strong><p>{detail.delay.elapsedMinutes} minutos decorridos; limite de alerta: {detail.delay.thresholdMinutes} minutos. {detail.delay.source==="historical"?"Referência: média histórica da fila de "+detail.delay.averageMinutes+" minutos.":"Referência provisória por etapa, até haver histórico suficiente."}</p></div>}
   <dl className="attendance-detail-grid"><div><dt>Paciente</dt><dd>{detail.patient_name??"Ainda não identificado"}</dd></div><div><dt>Categoria</dt><dd>{detail.payment_category==="insurance"?"Convênio":"Particular"}{detail.legal_priority?" · Prioritário":""}</dd></div><div><dt>Fila</dt><dd>{detail.queue_name}</dd></div><div><dt>Especialidade</dt><dd>{detail.specialty_name??"—"}</dd></div><div><dt>Profissional</dt><dd>{detail.professional_name??"Fila compartilhada"}</dd></div><div><dt>Consultório</dt><dd>{detail.room_name??"Não informado"}</dd></div><div><dt>Entrada na fila</dt><dd>{fmt(detail.enqueued_at)}</dd></div><div><dt>Chamada</dt><dd>{fmt(detail.called_at)}</dd></div><div><dt>Início do atendimento</dt><dd>{fmt(detail.service_started_at)}</dd></div></dl>
   <section className="attendance-tracking"><h3>Link e QR Code de acompanhamento</h3><p>Recupere o mesmo link emitido pelo Totem, como na recepção. A consulta fica registrada na auditoria.</p>
    {!tracking.url&&<button type="button" className="admin-secondary" disabled={tracking.loading} onClick={()=>showTracking(detail)}>{tracking.loading?"Carregando...":"Visualizar QR Code e link original"}</button>}
    {tracking.error&&<p role="alert" className="admin-form-notice">{tracking.error}</p>}
    {tracking.url&&tracking.entryId===detail.id&&<div className="attendance-tracking-content"><div className="attendance-qr"><QRCodeSVG value={tracking.url} size={184} level="M"/></div><a href={tracking.url} target="_blank" rel="noopener noreferrer" className="attendance-tracking-link">{tracking.url}</a><div className="attendance-modal-actions"><button type="button" className="admin-secondary" onClick={copyTracking}>Copiar link</button><a className="admin-primary" href={tracking.url} target="_blank" rel="noopener noreferrer">Abrir acompanhamento</a></div><small>Link pessoal: não compartilhe publicamente. O QR Code original permanece o mesmo durante os encaminhamentos.</small></div>}
   </section>
   <div className="attendance-modal-actions"><button className="admin-secondary" onClick={()=>setSelected(null)}>Fechar</button><button className="admin-primary" onClick={()=>{const id=detail.journey_id;closeDetail();window.location.assign("/admin/pacientes?journey="+encodeURIComponent(id));}}>Abrir histórico do paciente</button></div>
  </section></div>}
 </main>;
}
