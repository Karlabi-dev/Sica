import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../services/firebase.js";
import "./AdminEmailVerificationPage.css";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export default function AdminEmailVerificationPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function requestCode() {
    setBusy(true); setMessage(""); setVerified(false); setChallengeId(""); setCode("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API}/auth/admin/email-code/request`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}", cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o código.");
      setChallengeId(data.challengeId);
      setMessage("Código solicitado. Confira a caixa de entrada e o spam do e-mail cadastrado. Validade: 5 minutos.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setMessage("Digite os 6 números do código."); return; }
    setBusy(true); setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API}/auth/admin/email-code/verify`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }), cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Código inválido ou expirado.");
      setVerified(true); setCode("");
      setMessage("Código de e-mail confirmado! Esta etapa é apenas um teste: o acesso ao painel continua exigindo a MFA do Firebase.");
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  if (user === undefined) return <main className="admin-otp-page"><p>Verificando sessão...</p></main>;
  if (!user) return <main className="admin-otp-page"><section className="admin-otp-card"><h1>Sessão encerrada</h1><p>Entre com a conta de administrador para testar o envio.</p><Link to="/login">Voltar ao login</Link></section></main>;
  return <main className="admin-otp-page"><section className="admin-otp-card">
    <div className="admin-otp-brand">SICA <span>· Segurança</span></div>
    <h1>Verificação por e-mail</h1>
    <p>Teste de envio e validação do código para o administrador. O painel administrativo ainda não será desbloqueado.</p>
    <p className="admin-otp-address">Conta autenticada: <strong>{user.email}</strong></p>
    <button type="button" onClick={requestCode} disabled={busy} className="admin-otp-primary">{busy ? "Aguarde..." : challengeId ? "Solicitar novo código" : "Enviar código para meu e-mail"}</button>
    {challengeId && !verified && <form onSubmit={verifyCode}>
      <label htmlFor="admin-otp-code">Código de 6 dígitos</label>
      <input id="admin-otp-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" required />
      <button className="admin-otp-primary" disabled={busy || code.length !== 6} type="submit">Verificar código</button>
    </form>}
    {message && <p className={verified ? "admin-otp-success" : "admin-otp-message"} role="status">{message}</p>}
    <p className="admin-otp-note">A opção “Confiar neste dispositivo” será adicionada somente quando houver validação segura no backend.</p>
    <button className="admin-otp-exit" onClick={async()=>{await signOut(auth);navigate("/login",{replace:true});}}>Sair e voltar ao login</button>
  </section></main>;
}
