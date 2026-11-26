import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./TrackingPage.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
const CALL_DURATION = 120000;
const STATUS = { waiting: "Aguardando chamada", called: "Você foi chamado!", in_service: "Em atendimento", no_show: "Não compareceu", transferred: "Encaminhado", completed: "Atendimento concluído", cancelled: "Atendimento cancelado" };
const formatTime = ms => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return [Math.floor(seconds / 60), seconds % 60].map(n => String(n).padStart(2, "0")).join(":"); };

export default function LiveTrackingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [fontLevel, setFontLevel] = useState(0);
  const [alerts,setAlerts]=useState(false);
  const audio=useRef(null),lastCall=useRef(null);
  async function enableAlerts(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio.current??=new Audio();await audio.current.resume();}setAlerts(true);}catch{setAlerts(false);}}
  useEffect(()=>{if(!alerts||ticket?.status!=='called')return;const key=ticket.latest_called_at??ticket.called_at;if(!key||lastCall.current===key)return;lastCall.current=key;try{navigator.vibrate?.([300,150,300,150,500]);const ctx=audio.current;if(ctx?.state==='running'){[0,.35,.7].forEach(offset=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=880;gain.gain.value=.12;osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+.22);});}}catch{}},[alerts,ticket]);
  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let active = true;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? "")) { navigate("/clinica", { replace: true }); return; }
    async function load() {
      try {
        const response = await fetch(`${API}/public/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (response.status === 404) { if (active) navigate("/clinica", { replace: true }); return; }
        if (!response.ok) throw new Error("Acompanhamento indisponível");
        const data = await response.json();
        if (active) {
          setTicket(data);
          if (data.server_now) setServerOffset(new Date(data.server_now).getTime() - Date.now());
          setError("");
        }
      } catch { if (active) setError("Não foi possível atualizar. Tentaremos novamente automaticamente."); }
    }
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [token, navigate]);

  const reception = ticket?.stage_type === "reception";
  const awaitingDoctor = !reception && ticket?.status === "waiting";
  const called = ticket?.status === "called";
  const callTime = ticket?.latest_called_at ?? ticket?.called_at;
  const remaining = called && callTime ? Math.max(0, new Date(callTime).getTime() + CALL_DURATION - (clock + serverOffset)) : null;
  const expired = remaining === 0;
  const destination = ticket?.destination_name;
  const place = reception ? "guichê" : "consultório";
  const instruction = called ? (destination ? `Dirija-se ao ${destination}.` : `Você foi chamado! Dirija-se ao ${place} indicado pela equipe.`) : "";
  const status = STATUS[ticket?.status] ?? ticket?.status;
  const ahead = Number.isFinite(Number(ticket?.ahead)) ? Number(ticket.ahead) : null;
  const firstInLine = ticket?.status === "waiting" && ahead === 0;

  return <div className={`tracking-page tracking-page--font-${fontLevel} tracking-live`}>
    <div className="tracking-shell">
      <header className="tracking-accessible-header tracking-sticky">
        <div className="tracking-brand"><span className="tracking-logo" aria-hidden="true">S</span><div><strong>SICA</strong><small>ACOMPANHAMENTO DO PACIENTE</small></div></div>
        <div className="tracking-font-controls" role="group" aria-label="Tamanho do texto">
          <button type="button" onClick={() => setFontLevel(v => Math.max(0, v - 1))} disabled={fontLevel === 0} aria-label="Diminuir texto">A−</button>
          <button type="button" onClick={() => setFontLevel(v => Math.min(2, v + 1))} disabled={fontLevel === 2} aria-label="Aumentar texto">A+</button>
        </div>
      </header>
      <main className="tracking-main">
        <p className="tracking-eyebrow">ACOMPANHAMENTO EM TEMPO REAL</p>
        <h1>{called ? "É a sua vez!" : "Acompanhe seu atendimento"}</h1><button type="button" onClick={enableAlerts} disabled={alerts} style={{marginBottom:12,padding:"10px 14px",borderRadius:8}}>{alerts?"Alertas de chamada ativados":"Ativar som e vibração"}</button>
        {ticket ? <>
          <section className="tracking-ticket" aria-label="Informações da sua senha">
            <span className="tracking-ticket-label">SUA SENHA</span>
            <strong className="tracking-number">{ticket.ticket_code}</strong>
            <span className={`tracking-status tracking-status--${called ? "called" : "waiting"}`}>{status}</span>
          </section>
          <section className="tracking-details">
            <p className="tracking-field-label">ETAPA DO ATENDIMENTO</p>
            <h2>{ticket.queue_name}</h2>
          </section>
          {firstInLine && <section className="tracking-first-in-line" role="status"><span className="tracking-first-icon" aria-hidden="true">✓</span><div><strong>Você é a primeira pessoa da fila!</strong><p>Assim que os atendimentos começarem, você será {reception ? "chamada para a recepção" : "chamada para o consultório"}. Fique atenta à sua senha.</p></div></section>}
          {called && <section className={`tracking-call-timer ${expired ? "tracking-call-timer--expired" : ""}`} aria-label="Tempo restante para comparecimento">
            <span>{expired ? "TEMPO ENCERRADO" : "TEMPO PARA COMPARECER"}</span>
            <strong role="timer" aria-live="off">{remaining === null ? "--:--" : formatTime(remaining)}</strong>
            <p>{expired ? "O responsável pelo seu atendimento irá encerrá-lo a qualquer momento." : remaining === null ? "Aguardando horário da chamada no servidor." : "O cronômetro começa no instante da chamada registrada pelo profissional."}</p>
          </section>}
          <aside className={`tracking-notice tracking-notice--${called ? "called" : "waiting"}`} role="status">
            <strong>{called ? "Você foi chamado!" : firstInLine ? "Sua vez está chegando" : awaitingDoctor ? "Aguarde o médico iniciar os atendimentos" : ticket.status === "waiting" ? "Aguarde sua chamada" : status}</strong>
            <p>{called ? instruction : firstInLine ? "A chamada aparecerá aqui automaticamente quando a equipe iniciar o atendimento." : awaitingDoctor ? "Você já foi encaminhado. Quando o médico chamar sua senha, esta página exibirá a chamada e o cronômetro de 2 minutos." : ticket.status === "waiting" ? "Fique atento ao painel de senhas. Esta página é atualizada automaticamente." : "Para mais informações, procure a equipe da clínica."}</p>
          </aside>
          {error && <p role="status" className="tracking-live-error">{error}</p>}
        </> : <p role="status">{error || "Consultando sua senha..."}</p>}
      </main>
      <footer className="tracking-footer tracking-professional-footer">
        <strong>SICA</strong>
        <nav aria-label="Informações e direitos">
          <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noopener noreferrer">Código de Defesa do Consumidor</a>
          <a href="https://www.planalto.gov.br/ccivil_03/_ato2018-2022/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer">Lei Geral de Proteção de Dados (LGPD)</a>
        </nav>

        <small>© {new Date().getFullYear()} SICA · Acompanhamento de senhas</small>
      </footer>
    </div>
  </div>;
}
