import { useState } from "react";
import { CALL_TIMEOUT_MS, formatRemaining, useClock, useMedicalCall, writeMedicalCall } from "../../services/medicalCallDemo.js";
import "./DoctorPage.css";

const DEMO_PATIENTS = [
  { ticket: "C024", name: "Ana Martins", specialty: "Clínica geral", category: "Convênio", priority: false },
  { ticket: "CP008", name: "Maria Santos", specialty: "Cardiologia", category: "Convênio", priority: true },
  { ticket: "P016", name: "Carlos Oliveira", specialty: "Clínica geral", category: "Particular", priority: false },
];

export default function DoctorPage() {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState("next");
  const [notice, setNotice] = useState("");
  const call = useMedicalCall();
  const now = useClock();
  const patient = DEMO_PATIENTS[index] ?? null;
  const currentCall = patient && call?.ticket === patient.ticket ? call : null;
  const currentStage = currentCall?.status === "called" ? "called" : currentCall?.status === "arrived" ? "arrived" : stage;
  const remaining = currentCall?.status === "called" ? Math.max(0, currentCall.startedAt + CALL_TIMEOUT_MS - now) : 0;
  const expired = currentCall?.status === "called" && remaining === 0;
  const [decision, setDecision] = useState(false);

  function callPatient() {
    if (!patient) return;
    writeMedicalCall({ ticket: patient.ticket, status: "called", startedAt: Date.now() });
    setStage("called");
    setNotice("");
    setDecision(false);
  }
  function confirmArrival() {
    if (!patient) return;
    writeMedicalCall({ ...currentCall, ticket: patient.ticket, status: "arrived" });
    setStage("arrived");
    setNotice("Chegada do paciente confirmada com sucesso.");
    setDecision(false);
  }
  function finishAndNext() {
    if (patient) writeMedicalCall({ ticket: patient.ticket, status: "finished", finishedAt: Date.now() });
    setIndex(i => i + 1);
    setStage("next");
    setNotice("");
    setDecision(false);
  }
  function keepWaiting() {
    setDecision(false);
    setNotice("O paciente continuará aguardando. O prazo de dois minutos já terminou.");
  }

  return <div className="medical-screen">
    <header className="medical-header"><div className="medical-brand"><span className="medical-logo">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div><div className="medical-header-right"><span>Área médica</span><span className="medical-profile">M</span></div></header>
    <main className="medical-main">
      <div className="medical-intro"><p className="medical-kicker">ATENDIMENTO MÉDICO</p><h1>{currentStage === "next" ? "Próximo paciente" : currentStage === "called" ? "Paciente chamado" : "Chegada confirmada"}</h1><p>{currentStage === "next" ? "Confira os dados antes de chamar o próximo paciente." : currentStage === "called" ? "Aguarde a chegada do paciente ao consultório." : "O paciente chegou ao consultório e está pronto para o atendimento."}</p></div>
      {patient ? <>
        <section className="medical-patient-card" aria-label="Informações do paciente"><div className="medical-ticket"><span>SENHA DO PACIENTE</span><strong>{patient.ticket}</strong></div><div className="medical-patient-details"><span>DADOS DO PACIENTE</span><strong>{patient.name}</strong><p>{patient.specialty}</p><p>{patient.category}{patient.priority ? " • Prioritário" : ""}</p></div></section>
        {currentStage === "next" && <div className="medical-actions"><button type="button" className="medical-primary" onClick={callPatient}>Chamar paciente</button><span className="medical-action-hint">A senha será chamada para o consultório</span></div>}
        {currentStage === "called" && <>
          <section className={"medical-countdown" + (expired ? " medical-countdown--expired" : "")} aria-label="Prazo de chegada"><span>{expired ? "TEMPO ESGOTADO" : "TEMPO RESTANTE PARA CHEGADA"}</span><strong role="timer" aria-live="off">{formatRemaining(remaining)}</strong><p>{expired ? "O prazo terminou. Decida se deseja encerrar a chamada ou continuar aguardando." : "O paciente tem dois minutos para chegar ao consultório."}</p></section>
          {notice && <p className="medical-info" role="status">{notice}</p>}
          {expired && !decision && <div className="medical-expired-actions"><strong>O paciente ainda não chegou?</strong><button type="button" className="medical-secondary" onClick={() => setDecision(true)}>Encerrar atendimento?</button></div>}
          <div className="medical-actions"><button type="button" className="medical-primary" onClick={confirmArrival}>Confirmar chegada</button>{expired && <button type="button" className="medical-secondary" onClick={() => setDecision(true)}>Encerrar e chamar próximo</button>}</div>
        </>}
        {currentStage === "arrived" && <><div className="medical-success" role="status"><span aria-hidden="true">✓</span><div><strong>Paciente presente no consultório</strong><p>{notice || "Chegada confirmada."}</p></div></div><div className="medical-actions"><button type="button" className="medical-primary" onClick={finishAndNext}>Concluir e próximo paciente</button></div></>}
      </> : <section className="medical-empty"><h2>Fila concluída</h2><p>Não há mais pacientes nesta demonstração.</p><button className="medical-secondary" onClick={() => {setIndex(0);setStage("next");}}>Reiniciar demonstração</button></section>}
      {decision && <div className="medical-confirm-overlay"><section className="medical-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="medical-decision-title"><h2 id="medical-decision-title">Encerrar atendimento?</h2><p>Os dois minutos da senha <strong>{patient?.ticket}</strong> terminaram. Deseja encerrar a chamada e passar ao próximo paciente?</p><div className="medical-actions"><button className="medical-secondary" onClick={keepWaiting}>Não, continuar aguardando</button><button className="medical-primary" onClick={finishAndNext}>Sim, encerrar e chamar próximo</button></div></section></div>}
      <p className="medical-footnote">Demonstração com dados fictícios. O cronômetro é compartilhado apenas entre abas deste navegador; a integração real com o servidor será feita depois.</p>
    </main>
  </div>;
}
