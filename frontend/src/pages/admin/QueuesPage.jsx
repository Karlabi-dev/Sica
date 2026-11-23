import {useEffect,useMemo,useState} from "react";
import {adminApi} from "./adminApi.js";
import "./QueuesPage.css";

const normalizeName=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g," ");
const initialForm={name:"",specialtyId:"",doctorIds:[],queueMode:"shared",active:true,roomAssignments:{}};
export default function QueuesPage(){
 const [data,setData]=useState({specialties:[],doctors:[],queues:[],rooms:[]});
 const [form,setForm]=useState(initialForm);
 const [editingQueue,setEditingQueue]=useState(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [blockedQueue,setBlockedQueue]=useState(null);
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("all");
 const [doctorSearch,setDoctorSearch]=useState("");
 async function load(){try{setData(await adminApi("/admin/catalog"));setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{load();},[]);
 const doctors=useMemo(()=>data.doctors.filter(d=>d.active),[data.doctors]);
 const selected=doctors.filter(d=>form.doctorIds.includes(d.id));
 const searchTerms=normalizeName(doctorSearch).split(" ").filter(Boolean);
 const available=doctors.filter(d=>!form.doctorIds.includes(d.id)&&searchTerms.every(term=>normalizeName(d.display_name).includes(term)));
 const filtered=data.queues.filter(q=>(filter==="all"||(filter==="active"?q.active:!q.active))&&[q.name,q.specialty_name].some(x=>(x??"").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))));
 const assignedCount=data.queues.filter(q=>data.doctors.some(d=>d.queue_definition_id===q.id)).length;
 const reset=()=>{setEditingQueue(null);setForm(initialForm);setDoctorSearch("");};
 function add(id){if(!id||form.doctorIds.includes(id))return;setForm(f=>({...f,doctorIds:[...f.doctorIds,id]}));setDoctorSearch("");}
 function editQueue(q){
  setEditingQueue(q.id);
  setForm({name:q.name,specialtyId:q.specialty_id,doctorIds:data.doctors.filter(d=>d.queue_definition_id===q.id).map(d=>d.id),queueMode:q.queue_mode,active:q.active,roomAssignments:Object.fromEntries(data.doctors.filter(d=>d.queue_definition_id===q.id).map(d=>[d.id,d.room_id??""]))});
  setNotice("");setError("");setDoctorSearch("");
  window.scrollTo({top:0,behavior:"smooth"});
 }
 async function toggleQueue(q){
  setBusy(true);setError("");setNotice("");setBlockedQueue(null);
  try{await adminApi("/admin/catalog/queues/"+q.id+"/status",{method:"PATCH",body:JSON.stringify({active:!q.active})});setNotice(q.active?"Fila desativada.":"Fila ativada.");await load();}
  catch(err){setError(err.message);if(q.active)setBlockedQueue({id:q.id,message:err.message});}finally{setBusy(false);}
 }
 async function removeQueue(q){
  if(q.active)return;
  if(!window.confirm('Excluir a fila "'+q.name+'"? Esta ação só será permitida se não houver histórico de atendimentos a preservar.'))return;
  setBusy(true);setError("");setNotice("");setBlockedQueue(null);
  try{await adminApi("/admin/catalog/queues/"+q.id,{method:"DELETE"});if(editingQueue===q.id)reset();setNotice("Fila excluída com sucesso.");await load();}
  catch(err){setError(err.message);setBlockedQueue({id:q.id,message:err.message});}finally{setBusy(false);}
 }
 async function save(e){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   if(editingQueue){
    await adminApi("/admin/catalog/queues/"+editingQueue+"/doctors",{method:"PATCH",body:JSON.stringify({doctorIds:form.doctorIds,roomAssignments:form.roomAssignments})});
    setNotice("Equipe da fila atualizada com sucesso.");
   }else{
    const created=await adminApi("/admin/catalog/queues",{method:"POST",body:JSON.stringify({...form,doctorIds:[]})});if(form.doctorIds.length){await adminApi("/admin/catalog/queues/"+created.id+"/doctors",{method:"PATCH",body:JSON.stringify({doctorIds:form.doctorIds,roomAssignments:form.roomAssignments})});}
    setNotice("Fila criada com sucesso. Você pode vincular mais médicos a qualquer momento.");
   }
   reset();await load();
  }catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <main className="admin-page queue-page">
  <header className="admin-page-heading queue-heading">
   <div><p className="admin-eyebrow">GESTÃO DE ATENDIMENTOS</p><h1>Filas e equipes médicas</h1><p>Organize os atendimentos por especialidade e defina quais profissionais atendem em cada fila.</p></div>
   <button type="button" className="admin-secondary" onClick={load}>↻ Atualizar dados</button>
  </header>
  <div className="queue-stats">
   <div><span>Filas cadastradas</span><strong>{data.queues.length}</strong></div>
   <div><span>Filas ativas</span><strong>{data.queues.filter(q=>q.active).length}</strong></div>
   <div><span>Com equipe vinculada</span><strong>{assignedCount}</strong></div>
  </div>
  {error&&<div role="alert" className="queue-feedback queue-error">{error}</div>}
  {notice&&<div role="status" className="queue-feedback queue-success">{notice}</div>}
  <div className="queue-layout">
   <section className="admin-panel queue-editor">
    <div className="queue-panel-heading"><span className="queue-step">01</span><div><h2>{editingQueue?"Gerenciar equipe da fila":"Criar nova fila"}</h2><p>{editingQueue?"Adicione ou remova profissionais vinculados à fila selecionada.":"Defina a especialidade e escolha os profissionais que poderão atender."}</p></div></div>
    <form onSubmit={save} className="queue-form">
     <div className="queue-form-grid">
      <label>Nome da fila<input required disabled={!!editingQueue} maxLength={120} minLength={2} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex.: Atendimento de Pediatria"/></label>
      <label>Especialidade<select required disabled={!!editingQueue} value={form.specialtyId} onChange={e=>setForm(f=>({...f,specialtyId:e.target.value}))}><option value="">Selecione a especialidade</option>{data.specialties.filter(s=>s.active||s.id===form.specialtyId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     </div>
     <div className="queue-divider"/>
     <div className="queue-field-heading"><div><h3>Modalidade de atendimento</h3><p>Escolha como os pacientes serão direcionados.</p></div></div>
     <div className="queue-modes">
      <label className={"queue-mode "+(form.queueMode==="shared"?"selected":"")}><input type="radio" name="queueMode" disabled={!!editingQueue} checked={form.queueMode==="shared"} onChange={()=>setForm(f=>({...f,queueMode:"shared"}))}/><span><strong>Fila compartilhada</strong><small>Uma fila para vários médicos. A recepção não precisa escolher o profissional.</small></span></label>
      <label className={"queue-mode "+(form.queueMode==="individual"?"selected":"")}><input type="radio" name="queueMode" disabled={!!editingQueue} checked={form.queueMode==="individual"} onChange={()=>setForm(f=>({...f,queueMode:"individual",doctorIds:f.doctorIds.slice(0,1)}))}/><span><strong>Fila individual</strong><small>Atendimento direcionado a um único médico.</small></span></label>
     </div>
     <div className="queue-divider"/>
     <div className="queue-field-heading"><div><h3>Profissionais vinculados</h3><p>{form.queueMode==="shared"?"Adicione quantos médicos precisar, agora ou depois.":"Selecione um médico para esta fila individual."}</p></div><span className="queue-count">{selected.length} selecionado{selected.length===1?"":"s"}</span></div>
     <label className="queue-doctor-search">Buscar médico<input type="search" autoComplete="off" value={doctorSearch} onChange={e=>setDoctorSearch(e.target.value)} placeholder="Nome completo ou parte do nome" aria-controls="queue-doctor-select"/></label>
     <label className="queue-doctor-select">Adicionar profissional<select id="queue-doctor-select" key={doctorSearch} value="" disabled={form.queueMode==="individual"&&form.doctorIds.length>=1} onChange={e=>add(e.target.value)}><option value="">{available.length?`Selecione um médico (${available.length} disponível${available.length===1?"":"is"})`:"Nenhum médico encontrado"}</option>{available.map(d=><option key={d.id} value={d.id}>{d.display_name}</option>)}</select></label><p className="queue-search-feedback" role="status" aria-live="polite">{doctorSearch.trim()?`${available.length} médico${available.length===1?"":"s"} encontrado${available.length===1?"":"s"} para “${doctorSearch.trim()}”.`:"Digite para filtrar os médicos por nome; o seletor será atualizado automaticamente."}</p>
     <div className="queue-room-assignments">{selected.map(d=><label key={d.id}>Consultório de {d.display_name}<select required value={form.roomAssignments[d.id]??""} onChange={e=>setForm(f=>({...f,roomAssignments:{...f.roomAssignments,[d.id]:e.target.value}}))}><option value="">Selecione um consultório</option>{data.rooms?.filter(room=>(room.active||room.id===form.roomAssignments[d.id])&&!selected.some(other=>other.id!==d.id&&form.roomAssignments[other.id]===room.id)).map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select></label>)}</div>
     <div className="queue-selected">
      {selected.length?selected.map(d=><div className="queue-doctor-chip" key={d.id}><span className="queue-avatar">{d.display_name.trim().charAt(0).toUpperCase()}</span><span>{d.display_name}</span><button type="button" aria-label={"Remover "+d.display_name} onClick={()=>setForm(f=>({...f,doctorIds:f.doctorIds.filter(id=>id!==d.id)}))}>×</button></div>):<div className="queue-empty-doctors">Nenhum médico selecionado. {form.queueMode==="shared"?"Você pode criar a fila e vincular a equipe posteriormente.":"Selecione um profissional para continuar."}</div>}
     </div>
     {!editingQueue&&<label className="queue-active"><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/><span>Ativar fila ao cadastrar</span></label>}
     <div className="queue-form-actions"><button type="submit" className="admin-primary" disabled={busy||(form.queueMode==="individual"&&form.doctorIds.length!==1)||form.doctorIds.some(id=>!form.roomAssignments[id])||new Set(form.doctorIds.map(id=>form.roomAssignments[id])).size!==form.doctorIds.length}>{busy?"Salvando...":editingQueue?"Salvar vínculos da equipe":"Criar fila"}</button>{editingQueue&&<button type="button" className="admin-secondary" onClick={reset}>Cancelar edição</button>}</div>
    </form>
   </section>
   <aside className="admin-panel queue-help"><div className="queue-panel-heading"><span className="queue-step">?</span><div><h2>Como funciona?</h2><p>Fluxo simples para a clínica.</p></div></div>
    <div className="queue-help-step"><span>1</span><div><strong>Cadastre os médicos</strong><p>No menu Profissionais, sem precisar escolher uma fila.</p></div></div>
    <div className="queue-help-step"><span>2</span><div><strong>Crie a fila da especialidade</strong><p>Por exemplo, Pediatria, com um ou mais profissionais.</p></div></div>
    <div className="queue-help-step"><span>3</span><div><strong>Encaminhe o paciente</strong><p>A recepção escolhe a fila compartilhada; a equipe atende conforme a operação da clínica.</p></div></div>
    <div className="queue-help-note">Para adicionar outro médico depois, use <strong>Gerenciar equipe</strong> na tabela abaixo.</div>
   </aside>
  </div>
  <section className="admin-panel queue-list">
   <div className="queue-list-heading"><div><h2>Filas cadastradas</h2><p>Consulte a situação e gerencie os profissionais de cada fila.</p></div><span>{filtered.length} resultado{filtered.length===1?"":"s"}</span></div>
   <div className="queue-toolbar"><input aria-label="Pesquisar filas" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar fila ou especialidade"/><select aria-label="Filtrar situação" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todas as situações</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></div>
   <div className="admin-table-wrap"><table className="admin-table queue-table"><thead><tr><th>Fila</th><th>Especialidade</th><th>Tipo</th><th>Médicos vinculados</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{filtered.map(q=>{const team=data.doctors.filter(d=>d.queue_definition_id===q.id);return <tr key={q.id}><td><strong>{q.name}</strong></td><td>{q.specialty_name??"—"}</td><td>{q.queue_mode==="shared"?"Compartilhada":"Individual"}</td><td>{team.length?<div className="queue-team">{team.map(d=><span key={d.id}>{d.display_name}</span>)}</div>:<span className="queue-muted">Sem médicos vinculados</span>}</td><td><span className={"queue-status "+(q.active?"active":"inactive")}>{q.active?"Ativa":"Inativa"}</span></td><td><div className="queue-row-actions"><button type="button" className="queue-edit-button" onClick={()=>editQueue(q)}>Gerenciar equipe</button><button type="button" className="queue-edit-button" disabled={busy} onClick={()=>toggleQueue(q)}>{q.active?"Desativar":"Ativar"}</button><button type="button" className="queue-delete-button" disabled={busy||q.active} title={q.active?"Desative a fila antes de excluir":"Excluir fila inativa"} onClick={()=>removeQueue(q)}>Excluir</button>{blockedQueue?.id===q.id&&<p className="queue-inline-warning" role="alert"><strong>Operação não permitida.</strong> {blockedQueue.message}</p>}</div></td></tr>})}</tbody></table>{!filtered.length&&<div className="queue-no-results">Nenhuma fila encontrada para os filtros selecionados.</div>}</div>
  </section>
 </main>;
}
