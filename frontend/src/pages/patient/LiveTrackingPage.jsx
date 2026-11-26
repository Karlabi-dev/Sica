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
  const [preferences,setPreferences]=useState(()=>{try{const p=JSON.parse(localStorage.getItem("sica_tracking_alerts"));return {sound:p?.sound!==false,vibration:p?.vibration!==false};}catch{return {sound:true,vibration:true};}});
  const [settingsOpen,setSettingsOpen]=useState(false);
  const [draft,setDraft]=useState(preferences);
  const audio=useRef(null),lastCall=useRef(null),settingsButton=useRef(null);
  async function unlockAudio(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio.current??=new Audio();await audio.current.resume();}}catch{}}
  function closeSettings(){setSettingsOpen(false);settingsButton.current?.focus();}
  function saveSettings(){if(draft.sound)unlockAudio();setPreferences(draft);try{localStorage.setItem("sica_tracking_alerts",JSON.stringify(draft));}catch{}closeSettings();}
  useEffect(()=>{const unlock=()=>{if(preferences.sound)unlockAudio();};document.addEventListener("pointerdown",unlock);document.addEventListener("keydown",unlock);return()=>{document.removeEventListener("pointerdown",unlock);document.removeEventListener("keydown",unlock);};},[preferences.sound]);
  useEffect(()=>{if(!settingsOpen)return;const escape=e=>{if(e.key==="Escape")closeSettings();};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);},[settingsOpen]);
  useEffect(()=>{if(ticket?.status!=="called")return;const key=ticket.latest_called_at??ticket.called_at;if(!key||lastCall.current===key)return;lastCall.current=key;
    if(preferences.vibration)try{navigator.vibrate?.([300,150,300,150,500]);}catch{}
    if(preferences.sound)try{const ctx=audio.current;if(ctx?.state==="running"){[0,.35,.7].forEach(offset=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=880;gain.gain.value=.12;osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+.22);});}}catch{}
  },[preferences,ticket]);
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
  const remaining = called && callTime ? Math.max(0, new Date(callTime).getTime() +(ticket.call_count>1?60000:120000) - (clock + serverOffset)) : null;
  const expired = remaining === 0;
  const destination = ticket?.destination_name;
  const place = reception ? "guichê" : "consultório";
  const instruction = called ? (destination ? `Dirija-se ao ${destination}.` : `Você foi chamado! Dirija-se ao ${place} indicado pela equipe.`) : "";
  const status = STATUS[ticket?.status] ?? ticket?.status;
  const ahead = ticket?.ahead != null && Number.isFinite(Number(ticket.ahead)) ? Number(ticket.ahead) : null;
  const estimate = ticket?.estimated_wait_minutes != null && Number.isFinite(Number(ticket.estimated_wait_minutes)) ? Number(ticket.estimated_wait_minutes) : null;
  const firstInLine = ticket?.status === "waiting" && ahead === 0;

  return <div className={`tracking-page tracking-page--font-${fontLevel} tracking-live`}>
    <div className="tracking-shell">
      <header className="tracking-accessible-header tracking-sticky">
        <div className="tracking-brand"><span className="tracking-logo" aria-hidden="true">S</span><div><strong>SICA</strong><small>ACOMPANHAMENTO DO PACIENTE</small></div></div>
        <div className="tracking-font-controls" role="group" aria-label="Tamanho do texto">
          <button type="button" onClick={() => setFontLevel(v => Math.max(0, v - 1))} disabled={fontLevel === 0} aria-label="Diminuir texto">A−</button>
          <button type="button" onClick={() => setFontLevel(v => Math.min(2, v + 1))} disabled={fontLevel === 2} aria-label="Aumentar texto">A+</button>
          <button ref={settingsButton} type="button" className="tracking-settings-trigger" aria-label="Configurações de notificações" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={()=>{setDraft({...preferences});setSettingsOpen(true);}}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.86 1.86-.06-.06A1.7 1.7 0 0 0 16 18.4a1.7 1.7 0 0 0-1 1.55V20h-2.6v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-1.86-1.86.06-.06A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.55-1H6.4v-2.6h.05A1.7 1.7 0 0 0 8 10.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06L9.46 6.6l.06.06A1.7 1.7 0 0 0 11.4 7a1.7 1.7 0 0 0 1-1.55V5.4H15v.05A1.7 1.7 0 0 0 16 7a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.86 1.86-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1H21V14h-.05a1.7 1.7 0 0 0-1.55 1Z" transform="translate(-1.7 -.7)"/></svg></button>
        </div>
      </header>
      {settingsOpen&&<div className="tracking-settings-backdrop" onClick={closeSettings}><section className="tracking-settings-modal" role="dialog" aria-modal="true" aria-labelledby="tracking-settings-title" onClick={e=>e.stopPropagation()}>
        <div className="tracking-settings-head"><div><span>PERSONALIZAÇÃO</span><h2 id="tracking-settings-title">Notificações</h2></div><button type="button" autoFocus aria-label="Fechar configurações" onClick={closeSettings}>×</button></div>
        <p>Escolha como deseja receber os alertas de chamada.</p>
        {[["sound","Som","Alerta sonoro quando sua senha for chamada."],["vibration","Vibração","Vibrar o celular durante a chamada."]].map(([key,title,description])=><label className="tracking-settings-option" key={key}><div><strong>{title}</strong><small>{description}</small></div><input type="checkbox" role="switch" checked={draft[key]} onChange={e=>setDraft(old=>({...old,[key]:e.target.checked}))}/><span className="tracking-switch" aria-hidden="true"/></label>)}
        <small className="tracking-settings-hint">Os alertas dependem das permissões e da compatibilidade do seu dispositivo.</small>
        <button type="button" className="tracking-settings-save" onClick={saveSettings}>Salvar alterações</button>
      </section></div>}
      <main className="tracking-main">
        <p className="tracking-eyebrow">ACOMPANHAMENTO EM TEMPO REAL</p>
        <h1>{called ? "É a sua vez!" : "Acompanhe seu atendimento"}</h1>{called&&<p role="status" style={{fontSize:"1.35rem",fontWeight:700,textAlign:"center"}}>{ticket.call_count>=3?"Terceira chamada":ticket.call_count===2?"Segunda chamada":"Primeira chamada"}</p>}
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
          {firstInLine && <section className="tracking-first-in-line" role="status"><span className="tracking-first-icon" aria-hidden="true">✓</span><div><strong>Você é a primeira pessoa da fila {ticket.legal_priority?"prioritária":"normal"}!</strong><p>A chamada alterna entre as categorias. Aguarde sua senha.</p></div></section>}
          {ticket.status==="waiting"&&ahead!==null&&ahead>0&&<section className="tracking-details" aria-label="Posição e estimativa de espera"><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16,textAlign:"center"}}><div><p className="tracking-field-label">SUA POSIÇÃO</p><strong style={{fontSize:"2em"}}>{ahead+1}º</strong><p>Fila {ticket.legal_priority?"prioritária":"normal"}</p></div><div><p className="tracking-field-label">ESPERA ESTIMADA</p><strong style={{fontSize:"2em"}}>{estimate===null?"—":`${estimate} min`}</strong></div></div><p>Estimativa aproximada, sujeita à alternância das chamadas e à duração dos atendimentos.</p></section>}{called&&destination&&<section className="tracking-call-timer" aria-label="Destino do atendimento"><span>DIRIJA-SE AO</span><strong style={{fontSize:"clamp(28px,7vw,48px)",overflowWrap:"anywhere"}}>{destination}</strong></section>}{called && <section className={`tracking-call-timer ${expired ? "tracking-call-timer--expired" : ""}`} aria-label="Tempo restante para comparecimento">
            <span>{expired ? "TEMPO ENCERRADO" : "TEMPO PARA COMPARECER"}</span>
            <strong role="timer" aria-live="off">{remaining === null ? "--:--" : formatTime(remaining)}</strong>
            <p>{expired ? "O responsável pelo seu atendimento irá encerrá-lo a qualquer momento." : remaining === null ? "Aguardando horário da chamada no servidor." : "O cronômetro começa no instante da chamada registrada pelo profissional."}</p>
          </section>}
          <aside className={`tracking-notice tracking-notice--${called ? "called" : "waiting"}`} role="status">
            <strong>{called ? "Você foi chamado!" : firstInLine ? "Sua vez está chegando" : awaitingDoctor ? "Aguarde o médico iniciar os atendimentos" : ticket.status === "waiting" ? "Aguarde sua chamada" : status}</strong>
            <p>{called ? instruction : firstInLine ? "A chamada aparecerá aqui automaticamente quando a equipe iniciar o atendimento." : awaitingDoctor ? "Você já foi encaminhado. Quando o médico chamar sua senha, esta página exibirá a chamada e o cronômetro de comparecimento." : ticket.status === "waiting" ? "Fique atento ao painel de senhas. Esta página é atualizada automaticamente." : "Para mais informações, procure a equipe da clínica."}</p>
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
