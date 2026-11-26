import { useCallback,useEffect,useMemo,useState } from "react";
import { deviceRequest } from "../../services/device.js";
import { CALL_TIMEOUT_MS,formatRemaining,useClock } from "../../services/medicalCallDemo.js";
import "./DoctorPage.css";

export default function DoctorPage(){
 const [data,setData]=useState({doctor:null,entries:[]});
 const [selected,setSelected]=useState(null);
 const [dialog,setDialog]=useState(null);
 const [observation,setObservation]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const now=useClock();
 const refresh=useCallback(async()=>{try{const result=await deviceRequest("/staff/medical/overview");setData(result);setError("");}catch(e){setError(e.message);}finally{setLoading(false);}},[]);
 useEffect(()=>{refresh();const id=setInterval(refresh,8000);return()=>clearInterval(id);},[refresh]);
 const waiting=useMemo(()=>data.entries.filter(p=>p.status==="waiting"),[data.entries]);
 const active=data.entries.find(p=>(p.status==="in_service"||p.status==="called")&&p.called_room_id===data.doctor?.room_id);
 const otherCalls=data.entries.filter(p=>p.status!=="waiting"&&p.called_room_id!==data.doctor?.room_id);
 const current=active??waiting.find(p=>p.id===selected)??waiting[0]??null;
 const remaining=current?.status==="called"&&current.called_at?Math.max(0,new Date(current.called_at).getTime()+(current.call_count>1?60000:120000)-now):null;
 async function action(kind){
  if(!current||busy)return;
  setBusy(true);setNotice("");setError("");
  try{await deviceRequest("/staff/medical/entries/"+current.id+"/"+kind,{method:"POST",body:JSON.stringify({observation:kind==="return"?observation:""})});
   setNotice(({call:"Senha chamada.",recall:"Segunda chamada realizada.",arrival:"Chegada confirmada.",complete:"Atendimento encerrado.",return:"Paciente encaminhado de volta à recepção.", "no-show":"Ausência registrada."})[kind]);
   setSelected(null);setDialog(null);setObservation("");await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const doctor=data.doctor;
 return <div className="medical-screen medical-desktop">
  <header className="medical-header"><div className="medical-brand"><span className="medical-logo">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div><div className="medical-header-right"><div className="medical-identity"><strong>{doctor?.display_name??"Área médica"}</strong><span>{doctor?(doctor.queue_name??"Sem fila ativa")+" · "+doctor.room_name:"Aguardando identificação"}</span></div><span className="medical-profile">MD</span></div></header>
  <main className="medical-main medical-workspace"><div className="medical-intro"><p className="medical-kicker">ÁREA MÉDICA · FILA CONECTADA AO NEON</p><h1>Painel de atendimento</h1><p>Gerencie as chamadas e encaminhamentos com registro no banco de dados.</p></div>
   {error&&<div className="medical-demo-banner" role="alert">{error}</div>}
   {notice&&<p className="medical-info" role="status">{notice}</p>}
   {loading?<p>Carregando fila médica...</p>:doctor&&<>
    <div className="medical-stats"><div><span>Na fila</span><strong>{waiting.length}</strong></div><div><span>Em chamada</span><strong>{data.entries.filter(p=>p.status==="called").length}</strong></div><div><span>Em consulta</span><strong>{data.entries.filter(p=>p.status==="in_service").length}</strong></div><div><span>Fila</span><strong style={{fontSize:16}}>{doctor.queue_mode==="shared"?"Compartilhada":"Individual"}</strong></div></div>
    <div className="medical-columns"><section className="medical-panel medical-queue-panel"><div className="medical-panel-heading"><div><h2>Fila de espera</h2><p>Ordem de chegada · selecione outra senha se necessário</p></div><span>{waiting.length} aguardando</span></div>
     {waiting.map(p=><button key={p.id} type="button" className={"medical-queue-item"+(current?.id===p.id?" is-selected":"")} onClick={()=>setSelected(p.id)} disabled={Boolean(active)||busy}><strong>{p.ticket_code}</strong><span><b>{p.patient_name??"Paciente sem identificação"}</b><small>{p.payment_category==="insurance"?"Convênio":"Particular"}{p.legal_priority?" · Prioridade":""}</small></span><span className="medical-queue-status">Aguardando</span></button>)}
     {otherCalls.map(p=><div key={p.id} className="medical-queue-item"><strong>{p.ticket_code}</strong><span>{p.called_room_name??"Outro consultório"}</span><span>Em atendimento</span></div>)}{!waiting.length&&<p className="medical-quiet">Nenhum paciente aguardando.</p>}</section>
     <section className="medical-panel medical-care-panel"><div className="medical-panel-heading"><div><h2>Atendimento atual</h2><p>{current?"Ficha e ações do paciente":"Sem paciente selecionado"}</p></div><span>{current?({waiting:"Aguardando",called:"Chamado",in_service:"Em consulta"})[current.status]:"Livre"}</span></div>
      {current?<><div className="medical-current"><span>SENHA</span><strong>{current.ticket_code}</strong><div><h3>{current.patient_name??"Paciente sem identificação"}</h3><p>{doctor.queue_name} · {current.payment_category==="insurance"?"Convênio":"Particular"}{current.legal_priority?" · Prioritário":""}</p></div></div>
       {current.status==="called"&&<div className={"medical-countdown"+(remaining===0?" medical-countdown--expired":"")}><span>TEMPO PARA COMPARECIMENTO</span><strong>{formatRemaining(remaining??0)}</strong><p>{remaining===0?"Prazo encerrado. Confirme a chegada ou registre a ausência.":"Aguarde o prazo desta chamada."}</p></div>}
       <div className="medical-action-stack">
        {current.status==="waiting"&&<button className="medical-primary" disabled={busy||Boolean(active)} onClick={()=>action("call")}>{current.id===waiting[0]?.id?"Chamar próximo":"Chamar paciente selecionado"}</button>}
        {current.status==="called"&&<><button className="medical-primary" disabled={busy} onClick={()=>action("arrival")}>Confirmar chegada e iniciar consulta</button>{current.call_count<3&&<button className="medical-secondary" disabled={busy||remaining!==0} onClick={()=>action("recall")}>{current.call_count===1?"Realizar segunda chamada":"Chamar mais um minuto"}</button>}{remaining===0&&current.call_count>=2&&<button className="medical-secondary" disabled={busy} onClick={()=>setDialog("no-show")}>Registrar ausência</button>}</>}
        {current.status==="in_service"&&<><button className="medical-primary" disabled={busy} onClick={()=>setDialog("complete")}>Encerrar atendimento</button><button className="medical-secondary" disabled={busy} onClick={()=>setDialog("return")}>Encaminhar à recepção</button></>}
       </div></>:<p className="medical-quiet">Aguardando pacientes da recepção.</p>}
     </section></div></>}
  </main>
  {dialog&&current&&<div className="medical-confirm-overlay"><section className="medical-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="medical-dialog-title"><h2 id="medical-dialog-title">{dialog==="return"?"Devolver à recepção?":dialog==="complete"?"Encerrar atendimento?":"Registrar ausência?"}</h2><p>Senha <strong>{current.ticket_code}</strong> · {current.patient_name}</p><p>{dialog==="return"?"O paciente retornará ao final da fila da recepção, preservando a categoria e a prioridade.":dialog==="complete"?"O atendimento será concluído no banco de dados.":"A ausência será registrada no histórico."}</p>{dialog==="return"&&<label>Observação para a recepção<textarea value={observation} maxLength={120} onChange={e=>setObservation(e.target.value)} style={{width:"100%",minHeight:80}}/></label>}{error&&<p role="alert" className="medical-demo-banner">{error}</p>}<div className="medical-actions"><button className="medical-secondary" disabled={busy} onClick={()=>setDialog(null)}>Cancelar</button><button className="medical-primary" disabled={busy} onClick={()=>action(dialog)}>Confirmar</button></div></section></div>}
 </div>;
}
