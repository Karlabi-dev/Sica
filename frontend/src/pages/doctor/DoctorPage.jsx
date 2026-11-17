import { useMemo, useState } from "react";
import "./DoctorPage.css";

const INITIAL = [
  { id: 1, ticket: "CP008", name: "Maria Santos", specialty: "Cardiologia", priority: true, status: "Aguardando", time: "09:05" },
  { id: 2, ticket: "C024", name: "Ana Martins", specialty: "Clínica geral", priority: false, status: "Aguardando", time: "09:12" },
  { id: 3, ticket: "P016", name: "Carlos Oliveira", specialty: "Clínica geral", priority: false, status: "Aguardando", time: "09:18" },
  { id: 4, ticket: "PP003", name: "João Pereira", specialty: "Clínica geral", priority: true, status: "Aguardando", time: "09:21" },
];
const ORDER = { Aguardando: 0, Chamado: 1, "Em consulta": 2, Finalizado: 3 };

export default function DoctorPage() {
  const [patients, setPatients] = useState(INITIAL);
  const [tab, setTab] = useState("fila");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(null);
  const active = patients.find(p => p.id === activeId) ?? null;
  const waiting = patients.filter(p => p.status === "Aguardando");
  const inProgress = patients.filter(p => p.status === "Chamado" || p.status === "Em consulta");
  const finished = patients.filter(p => p.status === "Finalizado");
  const sorted = useMemo(() => [...patients].filter(p => [p.name, p.ticket, p.specialty].some(v => v.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => ORDER[a.status] - ORDER[b.status] || Number(b.priority) - Number(a.priority) || a.id - b.id), [patients, search]);

  function update(id, status) {
    setPatients(items => items.map(p => p.id === id ? { ...p, status } : p));
    setActiveId(id);
    setNotice(status === "Chamado" ? "Senha chamada para o consultório." : status === "Em consulta" ? "Consulta iniciada." : "Consulta finalizada.");
    setTab("atendimento");
    setConfirm(null);
  }
  function callNext() {
    if (inProgress.length) return setNotice("Finalize o atendimento atual antes de chamar outra senha.");
    const next = [...waiting].sort((a, b) => Number(b.priority) - Number(a.priority) || a.id - b.id)[0];
    if (!next) return setNotice("Não há pacientes aguardando.");
    update(next.id, "Chamado");
  }
  function callOne(patient) {
    if (inProgress.length) return setNotice("Finalize o atendimento atual antes de chamar outra senha.");
    update(patient.id, "Chamado");
  }

  return <div className="doctor-app">
    <header className="doctor-topbar"><div className="doctor-brand"><span>S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div><div className="doctor-user"><span className="doctor-avatar">MD</span><div><strong>Área médica</strong><small>Ambiente de demonstração</small></div></div></header>
    <main className="doctor-container">
      <div className="doctor-heading"><div><p className="doctor-eyebrow">ÁREA OPERACIONAL / CONSULTÓRIO</p><h1>Painel do médico</h1><p>Gerencie a chamada e o atendimento dos pacientes.</p></div><button className="doctor-primary" onClick={callNext}>Chamar próximo paciente</button></div>
      <nav className="doctor-tabs" aria-label="Seções do painel médico"><button className={tab === "fila" ? "selected" : ""} onClick={() => setTab("fila")}>Fila de espera</button><button className={tab === "atendimento" ? "selected" : ""} onClick={() => setTab("atendimento")}>Atendimento</button><button className={tab === "historico" ? "selected" : ""} onClick={() => setTab("historico")}>Finalizados</button></nav>
      {notice && <div className="doctor-notice" role="status">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice("")}>×</button></div>}
      <section className="doctor-stats" aria-label="Resumo do dia"><div><span>Aguardando consulta</span><strong>{waiting.length}</strong><small>Pacientes na fila</small></div><div><span>Em atendimento</span><strong>{inProgress.length}</strong><small>Chamados ou em consulta</small></div><div><span>Finalizados</span><strong>{finished.length}</strong><small>Consultas concluídas</small></div></section>
      {tab === "fila" && <div className="doctor-grid"><section className="doctor-card"><div className="doctor-card-head"><h2>Próxima senha</h2><span className="doctor-pill">Consultório</span></div><div className="doctor-next"><small>PRÓXIMO PACIENTE</small><strong>{[...waiting].sort((a,b) => Number(b.priority) - Number(a.priority) || a.id - b.id)[0]?.ticket ?? "—"}</strong><p>{waiting.length} paciente(s) aguardando</p></div><button className="doctor-primary doctor-full" onClick={callNext} disabled={!waiting.length || !!inProgress.length}>Chamar próxima senha</button></section><section className="doctor-card"><div className="doctor-card-head"><h2>Atendimento atual</h2><span className="doctor-pill">Hoje</span></div>{inProgress[0] ? <div className="doctor-current"><strong>{inProgress[0].ticket}</strong><h3>{inProgress[0].name}</h3><p>{inProgress[0].specialty}</p><span className="doctor-status">{inProgress[0].status}</span><button className="doctor-outline doctor-full" onClick={() => {setActiveId(inProgress[0].id);setTab("atendimento");}}>Abrir atendimento</button></div> : <div className="doctor-empty">Nenhum atendimento em andamento.</div>}</section></div>}
      {(tab === "fila" || tab === "historico") && <section className="doctor-card doctor-table-card"><div className="doctor-table-head"><div><h2>{tab === "fila" ? "Pacientes encaminhados" : "Atendimentos finalizados"}</h2><p>Dados fictícios para apresentação do protótipo</p></div><input aria-label="Buscar paciente" placeholder="Buscar nome ou senha..." value={search} onChange={e => setSearch(e.target.value)}/></div><div className="doctor-table-scroll"><table><thead><tr><th>Senha</th><th>Paciente</th><th>Especialidade</th><th>Chegada</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{sorted.filter(p => tab === "historico" ? p.status === "Finalizado" : p.status !== "Finalizado").map(p => <tr key={p.id}><td><strong>{p.ticket}</strong>{p.priority && <small className="doctor-priority">Prioritário</small>}</td><td>{p.name}</td><td>{p.specialty}</td><td>{p.time}</td><td><span className={"doctor-status " + (p.status === "Finalizado" ? "done" : p.status === "Aguardando" ? "waiting" : "called")}>{p.status}</span></td><td>{p.status === "Aguardando" ? <button className="doctor-link" onClick={() => callOne(p)} disabled={!!inProgress.length}>Chamar</button> : p.status !== "Finalizado" ? <button className="doctor-link" onClick={() => {setActiveId(p.id);setTab("atendimento");}}>Abrir</button> : <span>—</span>}</td></tr>)}</tbody></table>{!sorted.some(p => tab === "historico" ? p.status === "Finalizado" : p.status !== "Finalizado") && <div className="doctor-empty">Nenhum paciente encontrado.</div>}</div></section>}
      {tab === "atendimento" && <section className="doctor-card doctor-appointment"><div className="doctor-card-head"><h2>Atendimento médico</h2><span className="doctor-pill">Consultório</span></div>{active && active.status !== "Finalizado" ? <><div className="doctor-appointment-info"><div><small>SENHA ATUAL</small><strong>{active.ticket}</strong></div><div><small>PACIENTE</small><h3>{active.name}</h3><p>{active.specialty}</p></div><span className="doctor-status called">{active.status}</span></div><div className="doctor-actions">{active.status === "Chamado" && <button className="doctor-primary" onClick={() => update(active.id, "Em consulta")}>Confirmar chegada e iniciar consulta</button>}{active.status === "Em consulta" && <button className="doctor-primary" onClick={() => setConfirm(active.id)}>Finalizar consulta</button>}<button className="doctor-outline" onClick={() => setTab("fila")}>Ver fila</button></div></> : <div className="doctor-empty">Nenhum paciente em atendimento. Selecione uma senha na fila para começar.</div>}</section>}
      {confirm !== null && <div className="doctor-modal-backdrop" role="presentation"><div className="doctor-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-confirm-title"><h2 id="doctor-confirm-title">Finalizar consulta?</h2><p>Confirma o encerramento do atendimento da senha <strong>{patients.find(p => p.id === confirm)?.ticket}</strong>?</p><div className="doctor-actions"><button className="doctor-outline" onClick={() => setConfirm(null)}>Cancelar</button><button className="doctor-primary" onClick={() => update(confirm, "Finalizado")}>Confirmar finalização</button></div></div></div>}
      <p className="doctor-demo-note">Protótipo demonstrativo: esta fila é simulada nesta página e ainda não está sincronizada com a recepção, o totem ou a TV. Não utilize dados reais de pacientes.</p>
    </main>
  </div>;
}
