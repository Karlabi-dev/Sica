import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './AttendantPage.css';

const START = [
  { id: 1, ticket: 'C024', name: 'Ana Martins', category: 'Convênio', priority: false, status: 'Aguardando', destination: 'Clínica geral' },
  { id: 2, ticket: 'P016', name: 'Carlos Oliveira', category: 'Particular', priority: false, status: 'Aguardando', destination: 'Clínica geral' },
  { id: 3, ticket: 'CP008', name: 'Maria Santos', category: 'Convênio', priority: true, status: 'Aguardando', destination: 'Cardiologia' },
  { id: 4, ticket: 'PP003', name: 'João Pereira', category: 'Particular', priority: true, status: 'Aguardando', destination: 'Clínica geral' },
  { id: 5, ticket: 'C025', name: 'Fernanda Lima', category: 'Convênio', priority: false, status: 'Aguardando', destination: 'Pediatria' }
];
const TABS = [{ id: 'dashboard', label: 'Visão geral' }, { id: 'fila', label: 'Fila de espera' }, { id: 'atendimento', label: 'Atendimento' }, { id: 'pacientes', label: 'Pacientes' }];
const statusClass = status => status === 'Aguardando' ? 'waiting' : status === 'Em atendimento' ? 'active' : 'done';

export default function AttendantPage() {
  const [patients, setPatients] = useState(START);
  const [tab, setTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [currentId, setCurrentId] = useState(null);
  const [modal, setModal] = useState(null);
  const [destination, setDestination] = useState('Clínica geral');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Convênio');
  const [newPriority, setNewPriority] = useState(false);
  const current = patients.find(p => p.id === currentId) || null;
  const waiting = patients.filter(p => p.status === 'Aguardando');
  const completed = patients.filter(p => p.status === 'Encaminhado');
  const filtered = useMemo(() => patients.filter(p => [p.name, p.ticket, p.category].some(v => v.toLowerCase().includes(search.toLowerCase()))), [patients, search]);
  const trackingUrl = current && typeof window !== 'undefined' ? new URL('/acompanhar/' + current.ticket, window.location.origin).href : '';

  function showNotice(message) { setNotice(message); }
  function callNext() {
    const next = [...waiting].sort((a, b) => Number(b.priority) - Number(a.priority) || a.id - b.id)[0];
    if (!next) return showNotice('Não há senhas aguardando.');
    setPatients(list => list.map(p => p.id === next.id ? { ...p, status: 'Em atendimento' } : p));
    setCurrentId(next.id);
    setTab('atendimento');
    showNotice('Senha ' + next.ticket + ' chamada para a recepção.');
  }
  function callPatient(id) {
    const p = patients.find(item => item.id === id);
    if (!p) return;
    setPatients(list => list.map(item => item.id === id ? { ...item, status: 'Em atendimento' } : item));
    setCurrentId(id);
    setTab('atendimento');
    showNotice('Senha ' + p.ticket + ' chamada para a recepção.');
  }
  function forward() {
    if (!current) return;
    setPatients(list => list.map(p => p.id === current.id ? { ...p, status: 'Encaminhado', destination } : p));
    setModal('receipt');
    showNotice('Paciente encaminhado para ' + destination + '.');
  }
  function addPatient(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const prefix = newCategory === 'Convênio' ? 'C' : 'P';
    const code = prefix + (newPriority ? 'P' : '');
    const max = patients.filter(p => p.ticket.startsWith(code) && /^\d+$/.test(p.ticket.slice(code.length))).reduce((n, p) => Math.max(n, Number(p.ticket.slice(code.length))), 0);
    const ticket = code + String(max + 1).padStart(3, '0');
    const patient = { id: Date.now(), ticket, name, category: newCategory, priority: newPriority, status: 'Aguardando', destination: 'Clínica geral' };
    setPatients(list => [...list, patient]);
    setNewName('');
    setNewPriority(false);
    setModal(null);
    setTab('fila');
    showNotice('Senha ' + ticket + ' criada para paciente fictício.');
  }
  return <div className="attendant-app">
    <header className="attendant-topbar">
      <div className="attendant-brand"><span className="attendant-brand-icon">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div>
      <div className="attendant-user"><span className="attendant-user-dot">AT</span><span>Atendente <small>Ambiente de demonstração</small></span></div>
    </header>
    <div className="attendant-container">
      <div className="attendant-title-row"><div><p className="attendant-eyebrow">ÁREA OPERACIONAL</p><h1>Painel do atendente</h1><p>Gerencie senhas e acompanhe os atendimentos da clínica.</p></div><button type="button" className="attendant-primary" onClick={() => setModal('new')}>+ Novo paciente</button></div>
      <nav className="attendant-tabs" aria-label="Navegação do atendente">{TABS.map(t => <button key={t.id} type="button" className={tab === t.id ? 'selected' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
      {notice && <div className="attendant-alert" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}>×</button></div>}
      {tab === 'dashboard' && <>
        <div className="attendant-stats"><div><span>Senhas aguardando</span><strong>{waiting.length}</strong><small>Fila da recepção</small></div><div><span>Em atendimento</span><strong>{patients.filter(p => p.status === 'Em atendimento').length}</strong><small>Chamadas ativas</small></div><div><span>Encaminhados</span><strong>{completed.length}</strong><small>Atendimentos realizados</small></div><div><span>Total de senhas</span><strong>{patients.length}</strong><small>Hoje • Demonstração</small></div></div>
        <div className="attendant-grid"><section className="attendant-card"><div className="attendant-card-head"><div><h2>Próxima chamada</h2><p>Controle da fila de atendimento</p></div><span className="attendant-chip">Recepção</span></div><div className="attendant-next"><span>PRÓXIMA SENHA</span><strong>{[...waiting].sort((a,b)=>Number(b.priority)-Number(a.priority)||a.id-b.id)[0]?.ticket || '—'}</strong><p>{waiting.length} pessoa(s) aguardando</p></div><button type="button" className="attendant-primary attendant-wide" onClick={callNext}>Chamar próxima senha</button></section><section className="attendant-card"><div className="attendant-card-head"><div><h2>Atendimento atual</h2><p>Paciente selecionado</p></div></div>{current ? <div className="attendant-current"><span className="attendant-mini-label">SENHA</span><strong>{current.ticket}</strong><p>{current.name}</p><span className={'attendant-status '+statusClass(current.status)}>{current.status}</span><button type="button" className="attendant-outline" onClick={() => setTab('atendimento')}>Abrir atendimento</button></div> : <div className="attendant-empty">Nenhum paciente chamado. Selecione a próxima senha.</div>}</section></div>
      </>}
      {tab === 'fila' && <section className="attendant-card"><div className="attendant-card-head"><div><h2>Fila de espera</h2><p>Senhas aguardando chamada</p></div><button type="button" className="attendant-primary" onClick={callNext}>Chamar próxima</button></div><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Paciente</th><th>Atendimento</th><th>Prioridade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{waiting.map(p => <tr key={p.id}><td><strong className="attendant-ticket">{p.ticket}</strong></td><td>{p.name}</td><td>{p.category}</td><td>{p.priority ? 'Prioritário' : 'Comum'}</td><td><span className="attendant-status waiting">Aguardando</span></td><td><button type="button" className="attendant-small-button" onClick={() => callPatient(p.id)}>Chamar</button></td></tr>)}</tbody></table>{!waiting.length && <div className="attendant-empty">Nenhuma senha aguardando.</div>}</div></section>}
      {tab === 'atendimento' && <div className="attendant-grid"><section className="attendant-card"><div className="attendant-card-head"><div><h2>Atendimento da recepção</h2><p>Confirme os dados e encaminhe o paciente</p></div></div>{current ? <><div className="attendant-highlight"><span>SENHA ATUAL</span><strong>{current.ticket}</strong><p>{current.name}</p></div><div className="attendant-info-grid"><div><span>Tipo de atendimento</span><strong>{current.category}</strong></div><div><span>Prioridade</span><strong>{current.priority ? 'Prioritário' : 'Comum'}</strong></div><div><span>Situação</span><strong>{current.status}</strong></div><div><span>Etapa</span><strong>Recepção</strong></div></div><label className="attendant-label" htmlFor="attendant-destination">Encaminhar para</label><select id="attendant-destination" className="attendant-input" value={destination} onChange={e => setDestination(e.target.value)}><option>Clínica geral</option><option>Cardiologia</option><option>Pediatria</option><option>Triagem</option><option>Exames</option></select><button type="button" className="attendant-primary attendant-wide" disabled={current.status === 'Encaminhado'} onClick={() => setModal('confirm')}>{current.status === 'Encaminhado' ? 'Encaminhamento concluído' : 'Confirmar encaminhamento'}</button></> : <div className="attendant-empty">Chame uma senha para começar o atendimento.</div>}</section><section className="attendant-card"><div className="attendant-card-head"><div><h2>Comprovante do paciente</h2><p>Acompanhamento por QR Code</p></div></div>{current ? <div className="attendant-receipt"><span>SICA • ACOMPANHAMENTO</span><strong>{current.ticket}</strong><p>{current.name}</p>{trackingUrl && <QRCodeSVG value={trackingUrl} size={150} marginSize={1} />}<small>Escaneie para acompanhar a senha</small><a href={trackingUrl} target="_blank" rel="noreferrer">Abrir acompanhamento</a></div> : <div className="attendant-empty">O comprovante aparecerá após a chamada.</div>}</section></div>}
      {tab === 'pacientes' && <section className="attendant-card"><div className="attendant-card-head"><div><h2>Pacientes do dia</h2><p>Registros fictícios para apresentação</p></div><button type="button" className="attendant-primary" onClick={() => setModal('new')}>+ Cadastrar</button></div><input className="attendant-input attendant-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou senha" aria-label="Buscar pacientes"/><div className="attendant-table-wrap"><table className="attendant-table"><thead><tr><th>Senha</th><th>Paciente</th><th>Tipo</th><th>Prioridade</th><th>Situação</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><strong className="attendant-ticket">{p.ticket}</strong></td><td>{p.name}</td><td>{p.category}</td><td>{p.priority ? 'Sim' : 'Não'}</td><td><span className={'attendant-status '+statusClass(p.status)}>{p.status}</span></td></tr>)}</tbody></table>{!filtered.length && <div className="attendant-empty">Nenhum paciente encontrado.</div>}</div></section>}
      <p className="attendant-disclaimer">Protótipo demonstrativo: informações fictícias, sem persistência no banco de dados.</p>
    </div>
    {modal && <div className="attendant-modal-backdrop" role="presentation" onMouseDown={e => {if(e.target === e.currentTarget) setModal(null);}}><div className="attendant-modal" role="dialog" aria-modal="true" aria-label={modal === 'new' ? 'Novo paciente' : modal === 'confirm' ? 'Confirmar encaminhamento' : 'Comprovante'}><button type="button" className="attendant-modal-close" onClick={() => setModal(null)} aria-label="Fechar">×</button>{modal === 'new' ? <form onSubmit={addPatient}><p className="attendant-eyebrow">CADASTRO DEMONSTRATIVO</p><h2>Novo paciente</h2><label className="attendant-label" htmlFor="new-name">Nome fictício do paciente</label><input id="new-name" className="attendant-input" required maxLength={80} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex.: Ana Martins"/><label className="attendant-label" htmlFor="new-category">Tipo de atendimento</label><select id="new-category" className="attendant-input" value={newCategory} onChange={e => setNewCategory(e.target.value)}><option>Convênio</option><option>Particular</option></select><label className="attendant-checkbox"><input type="checkbox" checked={newPriority} onChange={e => setNewPriority(e.target.checked)}/> Atendimento prioritário</label><button type="submit" className="attendant-primary attendant-wide">Gerar senha</button></form> : modal === 'confirm' ? <><p className="attendant-eyebrow">CONFIRMAÇÃO</p><h2>Encaminhar paciente?</h2><p>Senha <strong>{current?.ticket}</strong> será encaminhada para <strong>{destination}</strong>.</p><div className="attendant-modal-actions"><button type="button" className="attendant-outline" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="attendant-primary" onClick={forward}>Confirmar</button></div></> : <><p className="attendant-eyebrow">ENCAMINHAMENTO CONCLUÍDO</p><h2>Paciente encaminhado!</h2><p>Senha <strong>{current?.ticket}</strong> • {destination}</p><div className="attendant-modal-actions"><button type="button" className="attendant-primary" onClick={() => {setModal(null);setTab('dashboard');}}>Voltar ao painel</button></div></>}</div></div>}
  </div>;
}
