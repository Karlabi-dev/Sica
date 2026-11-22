import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export default function ClinicLandingPage() {
  const [name, setName] = useState("SICA - FORTALEZA");
  useEffect(() => { fetch(`${API}/public/clinic`).then(r => r.ok ? r.json() : null).then(d => { if (d?.name) setName(d.name); }).catch(() => {}); }, []);
  return <main className="page" style={{display:"grid",placeItems:"center",background:"#f3f9fc"}}>
    <section className="panel" style={{textAlign:"center",width:"min(92%,620px)"}}>
      <p className="eyebrow">BEM-VINDO(A)</p><h1>{name}</h1>
      <p>Cuidar de você é nossa prioridade. Para acompanhar sua senha, utilize o QR Code ou o link recebido no comprovante de atendimento.</p>
      <p>Se o link não funcionar, procure nossa recepção.</p>
    </section>
  </main>;
}
