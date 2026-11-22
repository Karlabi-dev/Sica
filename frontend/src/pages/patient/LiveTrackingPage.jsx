import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export default function LiveTrackingPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token ?? "")) { navigate("/clinica", { replace: true }); return; }
    async function load() {
      try {
        const response = await fetch(`${API}/public/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (response.status === 404) { if (active) navigate("/clinica", { replace: true }); return; }
        if (!response.ok) throw new Error("Não foi possível atualizar sua fila.");
        const data = await response.json();
        if (active) { setTicket(data); setError(""); }
      } catch { if (active) setError("Não foi possível atualizar sua fila. Tentaremos novamente."); }
    }
    load();
    const interval = window.setInterval(load, 8000);
    return () => { active = false; window.clearInterval(interval); };
  }, [token, navigate]);
  const statuses = { waiting: "Aguardando chamada", called: "Senha chamada", in_service: "Em atendimento", no_show: "Não compareceu", transferred: "Transferido", completed: "Atendimento concluído", cancelled: "Atendimento cancelado" };
  return <div className="tracking-page"><div className="tracking-shell">
    <header className="tracking-accessible-header"><div className="tracking-brand"><span className="tracking-logo">S</span><div><strong>SICA</strong><small>ACOMPANHAMENTO DE ATENDIMENTO</small></div></div></header>
    <main className="tracking-main">
      <p className="tracking-eyebrow">ACOMPANHAMENTO EM TEMPO REAL</p>
      <h1>Acompanhe sua senha</h1>
      {ticket ? <><section className="tracking-ticket"><span className="tracking-ticket-label">SUA SENHA</span><strong className="tracking-number">{ticket.ticket_code}</strong><span className="tracking-status">{statuses[ticket.status] || ticket.status}</span></section>
        <section className="tracking-details"><p className="tracking-field-label">SUA ETAPA</p><h2>{ticket.queue_name}</h2><div className="tracking-stats"><div><span>Senhas à frente nesta fila</span><strong>{ticket.status === "waiting" ? ticket.ahead : "—"}</strong></div></div></section>
        <aside className="tracking-notice"><strong>{ticket.status === "called" ? "É a sua vez!" : "Fique atento à chamada"}</strong><p>{ticket.status === "called" ? "Dirija-se à recepção." : "Esta página é atualizada automaticamente a cada 8 segundos."}</p></aside></> : <p role="status">{error || "Consultando sua senha..."}</p>}
    </main>
  </div></div>;
}
