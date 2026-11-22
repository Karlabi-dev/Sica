import {useCallback,useEffect,useState} from "react";
import {adminApi} from "./adminApi.js";
import "./DoctorsPage.css";
const days=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const empty={name:"",schedule:[],active:true};
export default function DoctorsPage(){
 const [data,setData]=useState({doctors:[]}),[search,setSearch]=useState(""),[weekdayFilter,setWeekdayFilter]=useState("all"),[form,setForm]=useState(empty),[editing,setEditing]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{setData(await adminApi("/admin/doctors"));setError("");}catch(e){setError(e.message);}},[]);
 useEffect(()=>{refresh();},[refresh]);
 const normalizedSearch=search.trim().toLocaleLowerCase("pt-BR");
 const filteredDoctors=data.doctors.filter(d=>{
  const matchesName=d.display_name.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
  const matchesDay=weekdayFilter==="all"||(d.schedule??[]).some(s=>Number(s.weekday)===Number(weekdayFilter));
  return matchesName&&matchesDay;
 });
  const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 const edit=d=>{setEditing(d.id);setForm({name:d.display_name,schedule:(d.schedule??[]).map(x=>({weekday:Number(x.weekday),start:x.start_time.slice(0,5),end:x.end_time.slice(0,5)})),active:d.active});setNotice("");window.scrollTo({top:0,behavior:"smooth"});};
 const reset=()=>{setEditing(null);setForm(empty);};
 const addDay=()=>{const next=[1,2,3,4,5,6,0].find(day=>!form.schedule.some(s=>s.weekday===day));if(next!==undefined)change("schedule",[...form.schedule,{weekday:next,start:"08:00",end:"12:00"}]);};
 const setSlot=(index,key,value)=>change("schedule",form.schedule.map((s,i)=>i===index?{...s,[key]:value}:s));
 async function save(e){e.preventDefault();setError("");setNotice("");
  if(!form.schedule.length){setError("Informe pelo menos um dia e horário de atendimento.");return;}
  if(form.schedule.some(s=>s.end<=s.start)){setError("O horário de término deve ser posterior ao início.");return;}
  setBusy(true);
  try{await adminApi(editing?"/admin/doctors/"+editing:"/admin/doctors",{method:editing?"PATCH":"POST",body:JSON.stringify(form)});setNotice(editing?"Dados do médico atualizados.":"Médico cadastrado. Vincule-o à fila e ao consultório em Filas e equipes.");reset();await refresh();}
  catch(err){setError(err.message);}finally{setBusy(false);}
 }
 return <main className="admin-page doctors-page">
  <header className="admin-page-heading"><div><p className="admin-eyebrow">EQUIPE CLÍNICA</p><h1>Cadastro de médicos</h1><p>Cadastre os profissionais e seus horários. A especialidade, a fila e o consultório são definidos na organização dos atendimentos.</p></div><button type="button" className="admin-secondary" onClick={refresh}>Atualizar lista</button></header>
  {error&&<p className="doctor-feedback error" role="alert">{error}</p>}{notice&&<p className="doctor-feedback success" role="status">{notice}</p>}
  <div className="doctor-layout"><section className="admin-panel doctor-form-panel"><div className="doctor-panel-title"><span>01</span><div><h2>{editing?"Editar profissional":"Novo profissional"}</h2><p>Preencha os dados e a disponibilidade semanal.</p></div></div>
   <form onSubmit={save} className="doctor-form"><label>Nome completo do médico<input required minLength={3} maxLength={160} value={form.name} onChange={e=>change("name",e.target.value)} placeholder="Ex.: Dra. Maria Silva"/></label>
    <div className="doctor-schedule-head"><div><h3>Dias e horários de atendimento</h3><p>Informe quando o profissional começa e termina os atendimentos em cada dia.</p></div><button type="button" className="admin-secondary" onClick={addDay} disabled={form.schedule.length>=7}>+ Adicionar dia</button></div>
    <div className="doctor-slots">{form.schedule.map((slot,i)=><div className="doctor-slot" key={i}><label>Dia da semana<select value={slot.weekday} onChange={e=>setSlot(i,"weekday",Number(e.target.value))}>{days.map((day,d)=><option key={d} value={d} disabled={form.schedule.some((s,j)=>j!==i&&s.weekday===d)}>{day}</option>)}</select></label><label>Início<input type="time" required value={slot.start} onChange={e=>setSlot(i,"start",e.target.value)}/></label><label>Término<input type="time" required value={slot.end} onChange={e=>setSlot(i,"end",e.target.value)}/></label><button type="button" className="doctor-remove" onClick={()=>change("schedule",form.schedule.filter((_,j)=>j!==i))} aria-label={"Remover "+days[slot.weekday]}>Remover</button></div>)}{!form.schedule.length&&<p className="doctor-empty">Nenhum horário informado. Clique em <strong>Adicionar dia</strong> para começar.</p>}</div>
    {editing&&<label className="doctor-active"><input type="checkbox" checked={form.active} onChange={e=>change("active",e.target.checked)}/><span>Médico ativo</span></label>}
    <div className="doctor-actions"><button className="admin-primary" disabled={busy}>{busy?"Salvando...":editing?"Salvar alterações":"Cadastrar médico"}</button>{editing&&<button type="button" className="admin-secondary" onClick={reset}>Cancelar edição</button>}</div>
   </form></section>
   <aside className="admin-panel doctor-info"><h2>Próximas etapas</h2><div><strong>1. Cadastre o médico</strong><p>Informe o nome e os dias e horários de atendimento.</p></div><div><strong>2. Organize a fila</strong><p>Em Filas e equipes, selecione a especialidade e adicione o médico à fila.</p></div><div><strong>3. Defina o consultório</strong><p>Escolha o consultório em que ele atenderá. Médicos da mesma fila podem usar consultórios diferentes.</p></div><p className="doctor-info-note">O acesso ao sistema depende também da autorização do dispositivo pelo administrador.</p></aside></div>
  <section className="admin-panel doctor-list"><div className="doctor-list-head"><h2>Médicos cadastrados</h2><span>{filteredDoctors.length} de {data.doctors.length} profissionais</span></div><div className="doctor-list-filters"><label>Buscar por nome<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite o nome do médico" aria-label="Buscar médicos pelo nome"/></label><label>Disponibilidade por dia<select value={weekdayFilter} onChange={e=>setWeekdayFilter(e.target.value)} aria-label="Filtrar médicos por dia da semana"><option value="all">Todos os dias</option>{days.map((day,index)=><option key={index} value={String(index)}>{day}</option>)}</select></label>{(search||weekdayFilter!=="all")&&<button type="button" className="admin-secondary" onClick={()=>{setSearch("");setWeekdayFilter("all");}}>Limpar filtros</button>}</div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Profissional</th><th>Disponibilidade</th><th>Fila</th><th>Consultório</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{filteredDoctors.map(d=><tr key={d.id}><td><strong>{d.display_name}</strong></td><td>{d.schedule?.length?d.schedule.map(s=>days[Number(s.weekday)].slice(0,3)+" "+s.start_time.slice(0,5)+"–"+s.end_time.slice(0,5)).join(" · "):"Não informada"}</td><td>{d.queue_name??"Não vinculado"}</td><td>{d.room_name??"Não definido"}</td><td><span className={"doctor-status "+(d.active?"on":"off")}>{d.active?"Ativo":"Inativo"}</span></td><td><button type="button" className="doctor-edit" onClick={()=>edit(d)}>Editar</button></td></tr>)}</tbody></table>{!filteredDoctors.length&&<p className="doctor-empty">{data.doctors.length?"Nenhum médico encontrado com os filtros selecionados.":"Nenhum médico cadastrado ainda."}</p>}</div></section>
 </main>;
}
