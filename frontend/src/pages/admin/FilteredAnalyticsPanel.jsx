import {useEffect,useState} from "react";
import {adminApi} from "./adminApi.js";
const number=n=>new Intl.NumberFormat("pt-BR").format(Number(n)||0);
const stageNames={reception:"Recepção",triage:"Triagem",consultation:"Consulta",exam:"Exames"};
const statusNames={waiting:"Aguardando",called:"Chamado",in_service:"Em atendimento",completed:"Concluído",transferred:"Encaminhado",cancelled:"Cancelado",no_show:"Ausente"};
const minutes=n=>n==null?"Sem dados":new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(n))+" min";
function Bars({rows}){const max=Math.max(1,...rows.map(r=>Number(r.total)||0));return <div className="analytics-bars" role="img" aria-label="Atendimentos por dia">{rows.map(r=><div className="analytics-bar-item" key={r.day} title={r.day+": "+r.total+" atendimentos"}><span>{r.total||""}</span><div style={{height:Math.max(3,100*Number(r.total)/max)+"%"}}/><small>{r.day.slice(5).replace("-","/")}</small></div>)}</div>;}
export default function FilteredAnalyticsPanel({kind,globalFilters,availableQueues}){
 const [local,setLocal]=useState({queue:"",status:"",days:"",stage:""});
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const filters={...globalFilters,...Object.fromEntries(Object.entries(local).filter(([,v])=>v!=="").map(([k,v])=>[k,v==="*"?"":v]))};
 const key=JSON.stringify(filters);
 useEffect(()=>{let active=true;setLoading(true);setError("");adminApi("/admin/analytics?"+new URLSearchParams(filters).toString()).then(result=>{if(active)setData(result);}).catch(e=>{if(active){setError(e.message);setData(null);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[key]);
 const title={trend:"Evolução dos atendimentos",statuses:"Situação dos atendimentos",stages:"Atendimentos por etapa",queues:"Desempenho por fila e especialidade"}[kind];
 const description={trend:"Volume diário de entradas nas filas",statuses:"Distribuição das situações registradas",stages:"Movimentações por setor",queues:"Volume, conclusão e tempos observados"}[kind];
 const visibleQueues=availableQueues.filter(q=>(!filters.stage||q.stage_type===filters.stage)&&(!filters.specialty||q.specialty_id===filters.specialty));
 const effective=data?.appliedFilters;
 const filtered=Object.values(local).some(Boolean);
 return <section className={"analytics-panel analytics-panel-filtered analytics-panel-"+kind}>
  <div className="analytics-panel-head"><div><h2>{title}</h2><p>{description}</p></div>{filtered&&<button type="button" className="analytics-chart-reset" onClick={()=>setLocal({queue:"",status:"",days:"",stage:""})}>Usar filtros gerais</button>}</div>
  <div className="analytics-chart-filters" aria-label={"Filtros de "+title}>
   <label>Período<select aria-label={"Período de "+title} value={local.days} onChange={e=>setLocal(v=>({...v,days:e.target.value}))}><option value="">Período geral</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option></select></label>
   <label>Fila<select aria-label={"Fila de "+title} value={local.queue} onChange={e=>setLocal(v=>({...v,queue:e.target.value}))}><option value="">Fila geral</option><option value="*">Todas as filas</option>{visibleQueues.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label>
   <label>Situação<select aria-label={"Situação de "+title} value={local.status} onChange={e=>setLocal(v=>({...v,status:e.target.value}))}><option value="">Situação geral</option><option value="*">Todas as situações</option>{Object.entries(statusNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label>Etapa<select aria-label={"Etapa de "+title} value={local.stage} onChange={e=>setLocal(v=>({...v,stage:e.target.value,queue:""}))}><option value="">Etapa geral</option><option value="*">Todas as etapas</option>{Object.entries(stageNames).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
  </div>
  <div className="analytics-chart-content" aria-busy={loading}>
  {loading&&<p className="analytics-chart-message" role="status">Atualizando este gráfico...</p>}
  {error&&<p className="analytics-error" role="alert">{error}</p>}
  {!loading&&data&&kind==="trend"&&<Bars rows={data.daily}/>}
  {!loading&&data&&kind==="statuses"&&<div className="analytics-status-list">{data.statuses.length?data.statuses.map(item=><div key={item.status}><span>{statusNames[item.status]??item.status}</span><div className="analytics-progress"><i style={{width:Math.min(100,100*item.total/Math.max(1,data.summary.total))+"%"}}/></div><strong>{number(item.total)}</strong></div>):<p>Sem registros para os filtros escolhidos.</p>}</div>}
  {!loading&&data&&kind==="stages"&&<div className="analytics-stage-list">{data.stages.length?data.stages.map(item=><div key={item.stage}><span>{stageNames[item.stage]??item.stage}</span><strong>{number(item.total)}</strong><small>{number(item.completed)} concluídos</small></div>):<p>Sem registros para os filtros escolhidos.</p>}</div>}
  {!loading&&data&&kind==="queues"&&<div className="analytics-table-wrap"><table><thead><tr><th>Fila / especialidade</th><th>Etapa</th><th>Total</th><th>Concluídos</th><th>Em aberto</th><th>Cancelados</th><th>Espera média</th><th>Duração média</th></tr></thead><tbody>{data.queues.map(q=><tr key={q.id}><td><strong>{q.name}</strong><small>{q.specialty??"Sem especialidade"}</small></td><td>{stageNames[q.stage_type]??q.stage_type}</td><td>{number(q.total)}</td><td>{number(q.completed)}</td><td>{number(q.active)}</td><td>{number(q.cancelled)}</td><td>{minutes(q.avg_wait_minutes)}</td><td>{minutes(q.avg_service_minutes)}</td></tr>)}</tbody></table>{!data.queues.length&&<p>Nenhuma fila corresponde aos filtros.</p>}</div>}
  </div><p className="analytics-chart-footnote">{filtered?"Filtros específicos deste gráfico ativos.":"Acompanhando os filtros gerais do Dashboard."} {effective?.queue&&"Fila selecionada."}</p>
 </section>;
}
