import { useMemo, useState } from 'react';
import { CALL_TIMEOUT_MS, formatRemaining, useClock, useMedicalCall } from '../../services/medicalCallDemo.js';
import { useParams, useSearchParams } from 'react-router-dom';
import './TrackingPage.css';

const STAGES = ['recepcao-aguardando', 'recepcao-chamado', 'consulta-aguardando', 'consulta-chamado', 'encerrado', 'agradecimento'];
const STAGE_LABELS = ['Aguardando na recepção', 'Chamado na recepção', 'Aguardando consulta', 'Chamado para consulta', 'Atendimento encerrado', 'Mensagem final'];
const CONFIG = {
  'recepcao-aguardando': { eyebrow: 'SEU ATENDIMENTO', title: 'Aguarde sua vez', status: 'Aguardando chamada', kind: 'waiting', place: 'Recepção', ahead: '3', estimate: '40 min', next: 'Recepção', noteTitle: 'Aguarde sua chamada', note: 'Fique atento ao painel de senhas e ao aviso de chamada.' },
  'recepcao-chamado': { eyebrow: 'SEU ATENDIMENTO', title: 'É a sua vez', status: 'Chamado agora', kind: 'called', place: 'Recepção', ahead: '0', estimate: 'Agora', next: 'Recepção', noteTitle: 'Dirija-se à recepção', note: 'Apresente sua senha à equipe de atendimento.' },
  'consulta-aguardando': { eyebrow: 'SEU ATENDIMENTO', title: 'Aguarde sua consulta', status: 'Aguardando consulta', kind: 'waiting', place: 'Clínica geral', ahead: '2', estimate: '30 min', next: 'Consultório', noteTitle: 'Você está na fila de consulta', note: 'Aguarde a chamada do profissional responsável.' },
  'consulta-chamado': { eyebrow: 'SEU ATENDIMENTO', title: 'O médico chamou você!', status: 'Chamado agora', kind: 'called', place: 'Clínica geral', ahead: '0', estimate: 'Agora', next: 'Consultório 03', noteTitle: 'Dirija-se ao consultório', note: 'Sua consulta está pronta para começar.' }
};

function Brand() {
  return <header className="tracking-header"><div className="tracking-brand"><span className="tracking-logo" aria-hidden="true">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div></header>;
}

export default function TrackingPage() {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const initial = STAGES.includes(params.get('estado')) ? params.get('estado') : 'recepcao-aguardando';
  const [stage, setStage] = useState(initial);
  const [fontLevel, setFontLevel] = useState(0);
  const number = useMemo(() => {
    const candidate = (token || '').toUpperCase();
    return /^(C|CP|P|PP)\d{1,4}$/.test(candidate) ? candidate : 'C024';
  }, [token]);
  const type = number.startsWith('CP') || number.startsWith('PP') ? 'Prioritário' : 'Convencional';
  const config = CONFIG[stage];
  const call = useMedicalCall();
  const now = useClock();
  const activeCall = call?.ticket === number ? call : null;
  const sharedCalled = activeCall?.status === 'called' && stage !== 'encerrado' && stage !== 'agradecimento';
  const sharedFinished = activeCall?.status === 'finished' && stage !== 'agradecimento';
  const sharedArrived = activeCall?.status === 'arrived' && stage !== 'encerrado' && stage !== 'agradecimento';
  const remaining = sharedCalled ? Math.max(0, activeCall.startedAt + CALL_TIMEOUT_MS - now) : 0;
  const effectiveStage = sharedFinished ? 'encerrado' : sharedCalled ? 'consulta-chamado' : sharedArrived ? 'consulta-aguardando' : stage;
  const displayConfig = CONFIG[effectiveStage];

  function changeStage(event) {
    const next = event.target.value;
    setStage(next);
    setParams({ estado: next }, { replace: true });
  }

  return <div className={`tracking-page tracking-page--font-${fontLevel}`}>
    <div className="tracking-shell">
      <header className="tracking-accessible-header">
        <Brand />
        <div className="tracking-font-controls" role="group" aria-label="Tamanho do texto">
          <button type="button" onClick={() => setFontLevel(level => Math.max(0, level - 1))} disabled={fontLevel === 0} aria-label="Diminuir tamanho do texto">A−</button>
          <button type="button" onClick={() => setFontLevel(level => Math.min(2, level + 1))} disabled={fontLevel === 2} aria-label="Aumentar tamanho do texto">A+</button>
        </div>
      </header>
      <main className="tracking-main">
        {displayConfig ? <>
          <p className="tracking-eyebrow">{displayConfig.eyebrow}</p>
          <h1>{sharedCalled && remaining === 0 ? 'Aguardando decisão do médico' : sharedArrived ? 'Você chegou ao consultório' : displayConfig.title}</h1>
          <section className="tracking-ticket" aria-label="Sua senha">
            <span className="tracking-ticket-label">SUA SENHA</span>
            <strong className="tracking-number">{number}</strong>
            <span className={`tracking-status tracking-status--${displayConfig.kind}`}><span aria-hidden="true">●</span>{displayConfig.status}</span>
          </section>
          <section className="tracking-details" aria-label="Informações do atendimento">
            <p className="tracking-field-label">SUA ETAPA</p>
            <h2>{displayConfig.place}</h2>
            {displayConfig.kind==="waiting"&&displayConfig.ahead==="0"&&<div className="tracking-first-in-line" role="status"><span className="tracking-first-icon" aria-hidden="true">✓</span><div><strong>Você é a primeira pessoa da fila!</strong><p>Assim que os atendimentos começarem, você será chamada para {effectiveStage.startsWith("recepcao")?"a recepção":"o consultório"}.</p></div></div>}
          </section>
          {sharedCalled && <section className={`tracking-call-timer ${remaining === 0 ? 'tracking-call-timer--expired' : ''}`} aria-label="Tempo para chegar ao consultório"><span>{remaining === 0 ? 'TEMPO ESGOTADO' : 'TEMPO PARA CHEGAR AO CONSULTÓRIO'}</span><strong role="timer" aria-live="off">{formatRemaining(remaining)}</strong><p>{remaining === 0 ? 'Aguardando o médico decidir se encerra o atendimento. Permaneça atento às orientações.' : 'Você tem 2 minutos para ir ao consultório. Se não chegar a tempo, o médico poderá encerrar sua chamada.'}</p></section>}
          {sharedArrived && <aside className="tracking-notice tracking-notice--waiting"><strong>Chegada confirmada</strong><p>Você já está no consultório. Aguarde as orientações do médico.</p></aside>}
          {!sharedCalled && !sharedArrived && <aside className={`tracking-notice tracking-notice--${displayConfig.kind}`}><strong>{displayConfig.noteTitle}</strong><p>{displayConfig.note}</p></aside>}
        </> : effectiveStage === 'encerrado' ? <section className="tracking-finish">
          <span className="tracking-finish-pill">✓ Atendimento concluído</span>
          <h1>Atendimento<br />encerrado</h1>
          <strong className="tracking-finish-number">{number}</strong>
          <p>Seu atendimento foi finalizado.<br />Agradecemos pela confiança.</p>
          <div className="tracking-finish-card"><strong>Obrigado por cuidar da sua saúde.</strong><span>Desejamos um excelente dia!</span></div>
        </section> : <section className="tracking-thanks">
          <p className="tracking-eyebrow">ATÉ A PRÓXIMA</p>
          <h1>Cuidar de você<br />é nossa prioridade.</h1>
          <div className="tracking-thanks-card"><strong>Você é muito importante!</strong><p>Foi um prazer receber você. Conte com a nossa equipe sempre que precisar.</p></div>
        </section>}
      </main>
      <footer className="tracking-footer">SICA • Cuidando de você em cada etapa <span>Protótipo demonstrativo</span></footer>
    </div>
    <div className="tracking-demo" aria-label="Controles de demonstração">
      <label htmlFor="tracking-stage">Visualizar etapa do protótipo</label>
      <select id="tracking-stage" value={stage} onChange={changeStage}>{STAGES.map((value, index) => <option key={value} value={value}>{STAGE_LABELS[index]}</option>)}</select>
      <span>Tipo de senha: {type}</span>
    </div>
  </div>;
}
