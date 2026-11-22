import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./KioskPage.css";

const OPTIONS = [
  { id: "particular", number: "01", title: "Particular", description: "Atendimento sem convênio, com pagamento particular.", prefix: "P", demo: "P016", color: "orange" },
  { id: "particular-prioridade", number: "02", title: "Particular Prioridade", description: "Atendimento particular com direito à prioridade.", prefix: "PP", demo: "PP003", color: "red" },
  { id: "convenio", number: "03", title: "Convênio", description: "Atendimento por plano de saúde ou convênio.", prefix: "C", demo: "C024", color: "light-blue" },
  { id: "convenio-prioridade", number: "04", title: "Convênio Prioridade", description: "Atendimento por convênio com direito à prioridade.", prefix: "CP", demo: "CP008", color: "dark-blue" },
];

function Brand() {
  return <div className="kiosk-brand" aria-label="SICA — Sistema de Controle de Atendimento">
    <span className="kiosk-symbol" aria-hidden="true">S</span>
    <div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div>
  </div>;
}

export default function KioskPage() {
  const [choice, setChoice] = useState(null);
  const [phase, setPhase] = useState("choose");
  const [notice, setNotice] = useState("");
  const resetTimer = useRef(null);
  const printTimer = useRef(null);
  const printing = useRef(false);
  const choiceRef = useRef(null);

  function reset() {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    if (printTimer.current) window.clearTimeout(printTimer.current);
    printing.current = false;
    choiceRef.current = null;
    setChoice(null);
    setPhase("choose");
  }

  useEffect(() => {
    const afterPrint = () => {
      if (!printing.current) return;
      if (printTimer.current) window.clearTimeout(printTimer.current);
      setPhase("done");
      resetTimer.current = window.setTimeout(reset, 1200);
    };
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("afterprint", afterPrint);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      if (printTimer.current) window.clearTimeout(printTimer.current);
    };
  }, []);

  function selectOption(option) {
    if (printing.current || phase !== "choose") return;
    printing.current = true;
    choiceRef.current = option;
    setNotice("");
    setChoice(option);
    setPhase("printing");
  }

  useEffect(() => {
    if (phase !== "printing" || !choice) return;
    const frame = window.requestAnimationFrame(() => {
      printTimer.current = window.setTimeout(() => {
        try {
          window.print();
        } catch {
          printing.current = false;
          setPhase("error");
          setNotice("Não foi possível abrir a impressão. Tente novamente.");
        }
      }, 250);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, choice]);

  const trackingUrl = typeof window === "undefined" ? "/acompanhar/demo" : new URL("/acompanhar/" + (choice?.demo || "demo"), window.location.origin).href;

  return <div className="kiosk-page">
    <div className="kiosk-screen">
      <header className="kiosk-header"><Brand /><span className="kiosk-header-label">AUTOATENDIMENTO</span></header>
      <main className="kiosk-main kiosk-main--choose">
        <p className="kiosk-overline">BEM-VINDO(A) À CLÍNICA</p>
        <h1>Como será seu atendimento?</h1>
        <p className="kiosk-intro">Toque na opção desejada para imprimir sua senha.</p>
        <div className="kiosk-options">
          {OPTIONS.map(option => <button type="button" className={`kiosk-option kiosk-option--${option.color}`} key={option.id} onClick={() => selectOption(option)} disabled={phase !== "choose"}>
            <span className="kiosk-option-accent" aria-hidden="true" />
            <span className="kiosk-option-number">{option.number}</span>
            <span className="kiosk-option-content"><strong>{option.title}</strong><small>{option.description}</small></span>
            <span className="kiosk-option-arrow" aria-hidden="true">›</span>
          </button>)}
        </div>
        <p className="kiosk-priority-note">Tem direito ao atendimento prioritário? Escolha uma das opções com “Prioridade”.</p>
        {phase !== "choose" && <div className="kiosk-status" role="status" aria-live="polite">
          <div className="kiosk-status-spinner" aria-hidden="true" />
          <strong>{phase === "printing" ? "Preparando impressão..." : phase === "done" ? "Retire seu comprovante!" : "Impressão não iniciada"}</strong>
          <span>{phase === "printing" ? "Aguarde a janela de impressão." : phase === "done" ? "Voltando ao início..." : notice}</span>
          {phase === "error" && <button type="button" onClick={reset}>Voltar ao início</button>}
        </div>}
      </main>
      {choice && <section className="kiosk-print-only" aria-label="Comprovante para impressão">
        <div className="kiosk-print-brand">SICA</div>
        <p>SENHA DE ATENDIMENTO</p>
        <strong className="kiosk-print-number">{choice.demo}</strong>
        <strong>{choice.title}</strong>
        <p>Dirija-se à recepção e aguarde sua chamada.</p>
        <QRCodeSVG value={trackingUrl} size={168} level="M" marginSize={1} title="QR Code para acompanhamento" />
        <small>Escaneie para acompanhar sua senha</small>
        <small>PROTÓTIPO — SENHA DE DEMONSTRAÇÃO</small>
      </section>}
    </div>
  </div>;
}
