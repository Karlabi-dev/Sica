import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDemoRows, SECTION_META } from "./adminDemoData.js";
import DevicesPage from "./DevicesPage.jsx";
import DoctorsPage from "./DoctorsPage.jsx";
import "./AdminPage.css";
import "./AdminSectionPage.css";

function Reports() {
  const values = [48,64,52,80,67,91,75];
  return <><div className="admin-kpis"><div className="admin-kpi"><span>Atendimentos</span><strong>128</strong><small>Período demonstrativo</small></div><div className="admin-kpi"><span>Finalizados</span><strong>76</strong><small>59% do total</small></div><div className="admin-kpi"><span>Tempo médio</span><strong>24 min</strong><small>Espera estimada</small></div><div className="admin-kpi"><span>Taxa de conclusão</span><strong>59%</strong><small>Indicador demonstrativo</small></div></div><section className="admin-panel"><div className="admin-panel-title"><div><h2>Atendimentos por dia</h2><p>Dados fictícios da semana</p></div></div><div className="admin-chart">{values.map((v,i)=><div className="admin-chart-column" key={i}><div className="admin-chart-bar" style={{height:v+"%"}}/><small>{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][i]}</small></div>)}</div></section></>;
}
function Settings() {
  const [name,setName]=useState("Clínica SICA - Demonstração");
  const [time,setTime]=useState("2");
  const [notice,setNotice]=useState("");
  return <section className="admin-panel admin-settings"><h2>Configurações gerais</h2><p>Parâmetros demonstrativos. Alterações não são enviadas ao servidor.</p><form onSubmit={e=>{e.preventDefault();setNotice("Configurações de demonstração salvas nesta tela.");}}><label>Nome da clínica<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Tempo de tolerância para chegada (minutos)<input type="number" min="1" max="30" value={time} onChange={e=>setTime(e.target.value)} required/></label><button type="submit" className="admin-primary">Salvar demonstração</button></form>{notice&&<p className="admin-form-notice" role="status">{notice}</p>}<p className="admin-section-note">O cronômetro real do protótipo permanece fixo em 2 minutos até a integração das configurações ao backend.</p></section>;
}

export default function AdminSectionPage() {
  const { section: currentSection } = useParams();
  if(currentSection==="dispositivos") return <DevicesPage/>;
  if(currentSection==="profissionais") return <DoctorsPage/>;
  return <DemoSectionPage/>;
}

function DemoSectionPage() {
  const { section } = useParams();
  const meta = SECTION_META[section];
  const [edits, setEdits] = useState({});
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("Todos");
  const rows = useMemo(() => edits[section] ?? getDemoRows(section), [edits, section]);
  const filtered = rows.filter(row => row.values.some(value => String(value).toLowerCase().includes(query.toLowerCase())) && (filter === "Todos" || row.values.at(-1) === filter));
  const statuses = ["Todos", ...new Set(rows.map(row => row.values.at(-1)))];

  function openModal(row = null) {setForm(Object.fromEntries((meta?.fields ?? []).map((field,i)=>[field,row?.values[i]??""])));setModal(row?.id ?? "new");setNotice("");}
  function save(event) {
    event.preventDefault();
    const values = meta.fields.map(field => String(form[field]??"").trim());
    if (values.some(v=>!v)) return;
    const id = modal === "new" ? "new-"+Date.now() : modal;
    setEdits(current => ({...current,[section]:modal==="new" ? [...rows,{id,values}] : rows.map(row=>row.id===id?{...row,values}:row)}));
    setModal(null);setNotice("Registro atualizado somente nesta demonstração.");
  }
  function remove(id) {
    if (!window.confirm("Excluir este registro da demonstração?")) return;
    setEdits(current=>({...current,[section]:rows.filter(row=>row.id!==id)}));
    setNotice("Registro removido somente desta demonstração.");
  }

  if (!meta && section !== "relatorios" && section !== "configuracoes") return <main className="admin-page"><h1>Seção não encontrada</h1><Link to="/admin">Voltar ao dashboard</Link></main>;
  return <main className="admin-page">
    <div className="admin-page-heading"><div><p className="admin-eyebrow">ADMINISTRAÇÃO</p><h1>{meta?.title ?? (section==="relatorios"?"Relatórios e indicadores":"Configurações")}</h1><p>{meta?.description ?? (section==="relatorios"?"Analise o desempenho da clínica.":"Configure os parâmetros do sistema.")}</p></div>{meta && <button className="admin-primary" onClick={()=>openModal()}>+ Novo registro</button>}</div>
    {section==="relatorios" ? <Reports/> : section==="configuracoes" ? <Settings/> : <>
      <div className="admin-section-kpis"><div><span>Total de registros</span><strong>{rows.length}</strong></div><div><span>Resultados exibidos</span><strong>{filtered.length}</strong></div><div><span>Área</span><strong>{meta.title}</strong></div></div>
      <section className="admin-panel admin-records"><div className="admin-panel-title"><div><h2>Lista de {meta.title.toLowerCase()}</h2><p>Visualize e gerencie os registros demonstrativos</p></div></div><div className="admin-records-tools"><input aria-label="Pesquisar registros" placeholder="Pesquisar registros..." value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Filtrar status" value={filter} onChange={e=>setFilter(e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{meta.columns.map(c=><th key={c}>{c}</th>)}<th>Ações</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{row.values.map((value,i)=><td key={i}>{i===row.values.length-1?<span className="admin-tag">{value}</span>:value}</td>)}<td><div className="admin-row-actions"><button onClick={()=>openModal(row)}>Editar</button><button onClick={()=>remove(row.id)}>Excluir</button></div></td></tr>)}</tbody></table>{filtered.length===0&&<p className="admin-no-results">Nenhum registro encontrado.</p>}</div></section>
      {notice&&<p className="admin-form-notice" role="status">{notice}</p>}
      <p className="admin-section-note">Dados fictícios. As ações de criar, editar e excluir funcionam apenas nesta sessão da página, sem alterar o Neon ou as contas do Firebase.</p>
      {modal!==null&&<div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title"><div className="admin-modal-head"><h2 id="admin-modal-title">{modal==="new"?"Novo registro":"Editar registro"}</h2><button onClick={()=>setModal(null)} aria-label="Fechar">×</button></div><form onSubmit={save}>{meta.fields.map(field=><label key={field}>{field}<input required value={form[field]??""} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))}/></label>)}<div className="admin-modal-actions"><button type="button" className="admin-secondary" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="admin-primary">Salvar registro</button></div></form></section></div>}
    </>}
  </main>;
}
