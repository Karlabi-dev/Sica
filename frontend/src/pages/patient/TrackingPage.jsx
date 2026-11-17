import { useMemo, useState } from 'react';
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
  const number = useMemo(() => {
    const candidate = (token || '').toUpperCase();
    return /^(C|CP|P|PP)\d{1,4}$/.test(candidate) ? candidate : 'C024';
  }, [token]);
  const type = number.startsWith('CP') || number.startsWith('PP') ? 'Prioritário' : 'Convencional';
  const config = CONFIG[stage];

  function changeStage(event) {
    const next = event.target.value;
    setStage(next);
    setParams({ estado: next }, { replace: true });
  }

  return <div className="tracking-page">
    <div className="tracking-shell">
      <Brand />
      <main className="tracking-main">
        {config ? <>
          <p className="tracking-eyebrow">{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <section className="tracking-ticket" aria-label="Sua senha">
            <span className="tracking-ticket-label">SUA SENHA</span>
            <strong className="tracking-number">{number}</strong>
            <span className={`tracking-status tracking-status--${config.kind}`}><span aria-hidden="true">●</span>{config.status}</span>
          </section>
          <section className="tracking-details" aria-label="Informações do atendimento">
            <p className="tracking-field-label">SUA ETAPA</p>
            <h2>{config.place}</h2>
            <div className="tracking-stats"><div><span>Pessoas à frente</span><strong>{config.ahead}</strong></div><div><span>Tempo estimado</span><strong>{config.estimate}</strong></div></div>
            <div className="tracking-next"><span>Próxima chamada</span><strong>{config.estimate === 'Agora' ? 'Agora' : 'Em breve'}</strong></div>
          </section>
          <aside className={`tracking-notice tracking-notice--${config.kind}`}><strong>{config.noteTitle}</strong><p>{config.note}</p></aside>
        </> : stage === 'encerrado' ? <section className="tracking-finish">
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
