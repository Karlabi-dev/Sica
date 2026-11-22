import { useMemo, useState } from "react";
import { CALL_TIMEOUT_MS, formatRemaining, useClock } from "../../services/medicalCallDemo.js";
import "./DoctorPage.css";

const INITIAL = [
  { id:"demo-1",ticket:"C-024",name:"Ana Martins",specialty:"Clínica Geral",category:"Convênio",priority:false,status:"waiting",history:["Recepção · Cadastro confirmado","Encaminhada para Clínica Geral"] },
  { id:"demo-2",ticket:"CP-008",name:"Maria Santos",specialty:"Clínica Geral",category:"Convênio",priority:true,status:"waiting",history:["Recepção · Cadastro confirmado","Encaminhada para Clínica Geral"] },
  { id:"demo-3",ticket:"P-016",name:"Carlos Oliveira",specialty:"Clínica Geral",category:"Particular",priority:false,status:"waiting",history:["Recepção · Cadastro confirmado","Encaminhado para Clínica Geral"] }
];
const label={waiting:"Aguardando",called:"Chamado",in_service:"Em consulta",completed:"Concluído",returned:"Devolvido à recepção",no_show:"Não compareceu"};
export default function DoctorPage(){
 const [patients,setPatients]=useState(INITIAL);
 const [selected,setSelected]=useState(null);
 const [calledAt,setCalledAt]=useState(null);
 const [dialog,setDialog]=useState(null);
 const [reason,setReason]=useState("");
 const [notice,setNotice]=useState("");
 const now=useClock();
 const active=patients.find(p=>p.status==="called"||p.status==="in_service");
 const waiting=useMemo(()=>patients.filter(p=>p.status==="waiting").sort((a,b)=>Number(b.priority)-Number(a.priority)),[patients]);
 const current=patients.find(p=>p.id===selected)??active??waiting[0]??null;
 const remaining=active?.status==="called"&&calledAt?Math.max(0,calledAt+CALL_TIMEOUT_MS-now):null;
 function update(id,status,message){setPatients(ps=>ps.map(p=>p.id===id?{...p,status,history:[...p.history,message]}:p));setNotice(message);setDialog(null);setReason("");if(status==="returned"||status==="completed"||status==="no_show"){setSelected(null);setCalledAt(null);}}
 function call(){if(!current||active)return;setSelected(current.id);setCalledAt(Date.now());update(current.id,"called","Senha chamada para o consultório.");}
 function finish(){if(!current||current.status!=="in_service")return;update(current.id,dialog==="return"?"returned":"completed",dialog==="return"?"Retorno à recepção solicitado"+(reason.trim()?" · Motivo registrado":""):"Atendimento médico concluído.");}
 return <div className="medical-screen medical-desktop">
  <header className="medical-header"><div className="medical-brand"><span className="medical-logo">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div><div className="medical-header-right"><div className="medical-identity"><strong>Médico de demonstração</strong><span>Clínica Geral · Consultório 01</span></div><span className="medical-profile">MD</span></div></header>
  <main className="medical-main medical-workspace">
   <div className="medical-intro"><p className="medical-kicker">ÁREA MÉDICA · PRÉVIA VISUAL</p><h1>Painel de atendimento</h1><p>Gerencie a fila, confirme a chegada e decida o destino do paciente.</p></div>
   <div className="medical-demo-banner" role="status">Prévia com dados fictícios. As ações abaixo ainda não alteram o Neon, a recepção ou o acompanhamento do paciente.</div>
   <div className="medical-stats"><div><span>Na fila</span><strong>{waiting.length}</strong></div><div><span>Em chamada</span><strong>{patients.filter(p=>p.status==="called").length}</strong></div><div><span>Em consulta</span><strong>{patients.filter(p=>p.status==="in_service").length}</strong></div><div><span>Concluídos</span><strong>{patients.filter(p=>p.status==="completed").length}</strong></div></div>
   <div className="medical-columns">
    <section className="medical-panel medical-queue-panel"><div className="medical-panel-heading"><div><h2>Fila de espera</h2><p>Convênio, particular e prioridade</p></div><span>{waiting.length} aguardando</span></div>
     {waiting.map(p=><button key={p.id} type="button" className={"medical-queue-item"+(current?.id===p.id?" is-selected":"")} onClick={()=>setSelected(p.id)} disabled={Boolean(active)&&active.id!==p.id}><strong>{p.ticket}</strong><span><b>{p.name}</b><small>{p.category} {p.priority?"· Prioridade":""}</small></span><span className="medical-queue-status">Aguardando</span></button>)}
     {!waiting.length&&<p className="medical-quiet">Nenhum paciente aguardando.</p>}
    </section>
    <section className="medical-panel medical-care-panel"><div className="medical-panel-heading"><div><h2>Atendimento atual</h2><p>{current?"Ficha e ações do paciente":"Fila finalizada"}</p></div><span>{current?label[current.status]:"Sem paciente"}</span></div>
     {current?<><div className="medical-current"><span>SENHA</span><strong>{current.ticket}</strong><div><h3>{current.name}</h3><p>{current.specialty} · {current.category}{current.priority?" · Prioritário":""}</p></div></div>
      {current.status==="called"&&<div className={"medical-countdown"+(remaining===0?" medical-countdown--expired":"")}><span>TEMPO PARA COMPARECIMENTO</span><strong>{formatRemaining(remaining??0)}</strong><p>{remaining===0?"Tempo esgotado. Confirme a ausência ou a chegada.":"O paciente tem dois minutos para comparecer."}</p></div>}
      <div className="medical-action-stack">
       {current.status==="waiting"&&<button className="medical-primary" onClick={call} disabled={Boolean(active)}>Chamar paciente</button>}
       {current.status==="called"&&<><button className="medical-primary" onClick={()=>update(current.id,"in_service","Chegada confirmada. Consulta iniciada.")}>Confirmar chegada e iniciar consulta</button>{remaining===0&&<button className="medical-secondary" onClick={()=>setDialog("no_show")}>Registrar não comparecimento</button>}</>}
       {current.status==="in_service"&&<><button className="medical-primary" onClick={()=>setDialog("complete")}>Encerrar atendimento</button><button className="medical-secondary" onClick={()=>setDialog("return")}>Encaminhar novamente à recepção</button></>}
      </div>
      <div className="medical-history"><h3>Histórico da jornada</h3>{current.history.map((h,i)=><p key={i}><span aria-hidden="true">●</span>{h}</p>)}</div>
     </>:<div className="medical-empty"><h2>Fila concluída</h2><p>Não há pacientes aguardando nesta prévia.</p><button className="medical-secondary" onClick={()=>{setPatients(INITIAL);setSelected(null);setNotice("");}}>Reiniciar prévia</button></div>}
    </section>
   </div>
   {notice&&<p className="medical-info" role="status">{notice}</p>}
  </main>
  {dialog&&current&&<div className="medical-confirm-overlay"><section className="medical-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="medical-dialog-title"><h2 id="medical-dialog-title">{dialog==="return"?"Devolver à recepção?":dialog==="complete"?"Encerrar atendimento?":"Registrar ausência?"}</h2><p>Senha <strong>{current.ticket}</strong> · {current.name}</p><p>{dialog==="return"?"Na integração real, o paciente voltará ao final da fila de recepção da mesma categoria e prioridade.":dialog==="complete"?"Esta ação concluirá a jornada do paciente.":"A senha ficará marcada como não compareceu, para eventual recuperação excepcional."}</p>{dialog==="return"&&<label className="medical-reason">Motivo do retorno (opcional)<textarea maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ex.: Agendamento de exame"/></label>}<div className="medical-actions"><button className="medical-secondary" onClick={()=>setDialog(null)}>Cancelar</button><button className="medical-primary" onClick={()=>dialog==="no_show"?update(current.id,"no_show","Paciente não compareceu à chamada."):finish()}>Confirmar</button></div></section></div>}
 </div>;
}
