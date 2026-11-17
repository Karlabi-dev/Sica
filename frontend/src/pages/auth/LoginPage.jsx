import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../../services/firebase.js";
import "./LoginPage.css";

const errors = {
  "auth/invalid-credential": "E-mail ou senha inválidos.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde.",
  "auth/user-disabled": "Esta conta está desativada.",
  "auth/multi-factor-auth-required": "Esta conta exige autenticação em duas etapas. O segundo fator ainda precisa ser integrado.",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await credential.user.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 403) {
          navigate("/admin/verificar-email", { replace: true });
          return;
        }
        await signOut(auth);
        setMessage(response.status === 403
          ? "Conta sem autorização para acessar o SICA ou com MFA pendente."
          : "Não foi possível validar seu acesso com o servidor.");
        return;
      }
      const staff = await response.json();
      navigate(staff.role === "admin" ? "/admin" : staff.role === "doctor" ? "/medico" : "/atendente", { replace: true });
    } catch (error) {
      setMessage(errors[error.code] ?? "Não foi possível entrar. Verifique sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <section className="login-card">
      <div className="brand"><span className="brand-mark">S</span><strong>SICA</strong></div>
      <p className="eyebrow">Acesso restrito</p>
      <h1>Entrar no SICA</h1>
      <p>Utilize a conta autorizada pela administração da clínica.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="staff-email">E-mail</label>
        <input id="staff-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
        <label htmlFor="staff-password">Senha</label>
        <input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
        {message && <p role="alert" className="login-error">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Verificando..." : "Entrar"}</button>
      </form>
    </section>
  </main>;
}
