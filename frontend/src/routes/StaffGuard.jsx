import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate, Outlet } from "react-router-dom";
import { auth } from "../services/firebase.js";

export default function StaffGuard({ roles }) {
  const [state, setState] = useState({ loading: true, role: null });

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setState({ loading: false, role: null });
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Access denied");
        const staff = await response.json();
        if (active) setState({ loading: false, role: staff.role });
      } catch {
        if (active) setState({ loading: false, role: null });
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  if (state.loading) return <main className="page"><p>Verificando acesso...</p></main>;
  if (!state.role || !roles.includes(state.role)) return <Navigate to="/login" replace />;
  return <Outlet />;
}
