import { useState } from "react";
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
  const patient = DEMO_PATIENTS[index] ?? null;

  function callPatient() {
    if (!patient) return;
    setStage("called");
    setNotice("");
  }

  function confirmArrival() {
    if (!patient) return;
    setStage("arrived");
    setNotice("Chegada do paciente confirmada com sucesso.");
  }

  function nextPatient() {
    setIndex(i => i + 1);
    setStage("next");
    setNotice("");
  }

  return <div className="medical-screen">
    <header className="medical-header">
      <div className="medical-brand"><span className="medical-logo">S</span><div><strong>SICA</strong><small>SISTEMA DE CONTROLE DE ATENDIMENTO</small></div></div>
      <div className="medical-header-right"><span>Área médica</span><span className="medical-profile">M</span></div>
    </header>

    <main className="medical-main">
      <div className="medical-intro">
        <p className="medical-kicker">ATENDIMENTO MÉDICO</p>
        <h1>{stage === "next" ? "Próximo paciente" : stage === "called" ? "Paciente chamado" : "Chegada confirmada"}</h1>
        <p>{stage === "next" ? "Confira os dados antes de chamar o próximo paciente." : stage === "called" ? "Aguarde a chegada do paciente ao consultório." : "O paciente chegou ao consultório e está pronto para o atendimento."}</p>
      </div>

      {patient ? <>
        <section className="medical-patient-card" aria-label="Informações do paciente">
          <div className="medical-ticket"><span>SENHA DO PACIENTE</span><strong>{patient.ticket}</strong></div>
          <div className="medical-patient-details"><span>DADOS DO PACIENTE</span><strong>{patient.name}</strong><p>{patient.specialty}</p><p>{patient.category}{patient.priority ? " • Prioritário" : ""}</p></div>
        </section>
        {stage === "next" && <div className="medical-actions"><button type="button" className="medical-primary" onClick={callPatient}>Chamar paciente</button><span className="medical-action-hint">A senha será chamada para o consultório</span></div>}
        {stage === "called" && <div className="medical-actions"><button type="button" className="medical-secondary" onClick={() => setStage("next")}>Voltar</button><button type="button" className="medical-primary" onClick={confirmArrival}>Confirmar chegada</button><span className="medical-action-hint">Confirme somente quando o paciente chegar</span></div>}
        {stage === "arrived" && <><div className="medical-success" role="status"><span aria-hidden="true">✓</span><div><strong>Paciente presente no consultório</strong><p>{notice}</p></div></div><div className="medical-actions"><button type="button" className="medical-primary" onClick={nextPatient}>Concluir e próximo paciente</button></div></>}
      </> : <section className="medical-empty"><h2>Fila concluída</h2><p>Não há mais pacientes nesta demonstração.</p><button className="medical-secondary" onClick={() => {setIndex(0);setStage("next");}}>Reiniciar demonstração</button></section>}
      <p className="medical-footnote">Protótipo com pacientes fictícios. As chamadas ainda não são sincronizadas com a recepção ou a TV.</p>
    </main>
  </div>;
}
