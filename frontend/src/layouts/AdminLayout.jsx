import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import "./AdminLayout.css";

export const ADMIN_MENU = [
  { to: "/admin", label: "Dashboard", icon: "◫", end: true },
  { to: "/admin/atendimentos", label: "Atendimentos", icon: "▤" },
  { to: "/admin/filas", label: "Filas", icon: "☷" },
  { to: "/admin/pacientes", label: "Pacientes", icon: "♙" },
  { to: "/admin/profissionais", label: "Profissionais", icon: "♧" },
  { to: "/admin/especialidades", label: "Especialidades", icon: "✳" },
  { to: "/admin/salas", label: "Salas", icon: "▣" },
  { to: "/admin/televisores", label: "Televisores", icon: "▧" },
  { to: "/admin/dispositivos", label: "Dispositivos autorizados", icon: "▣" },
  { to: "/admin/relatorios", label: "Relatórios", icon: "▥" },
  { to: "/admin/auditoria", label: "Auditoria", icon: "◎" },
  { to: "/admin/configuracoes", label: "Configurações", icon: "⚙" },
];

export default function AdminLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = ADMIN_MENU.find(item => item.to === location.pathname);
  return <div className="sica-admin">
    <aside className="sica-admin-sidebar">
      <div className="sica-admin-brand"><span>S</span><div><strong>SICA</strong><small>GESTÃO CLÍNICA</small></div></div>
      <div className="sica-admin-sidebar-title">MENU PRINCIPAL</div>
      <nav aria-label="Menu administrativo">{ADMIN_MENU.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({isActive}) => "sica-admin-navlink" + (isActive ? " active" : "")}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}</nav>
      <div className="sica-admin-sidebar-bottom"><span className="sica-admin-user-icon">AD</span><div><strong>Administrador</strong><small>Gestão SICA</small></div></div>
    </aside>
    <div className="sica-admin-content">
      <header className="sica-admin-topbar"><div><span className="sica-admin-breadcrumb">Administração / {current?.label ?? "SICA"}</span></div><div className="sica-admin-top-user"><span className="sica-admin-demo-label">PAINEL ADMINISTRATIVO</span><span className="sica-admin-user-icon">AD</span></div></header>
      <div className="sica-admin-mobile-nav"><button type="button" className="sica-admin-menu-toggle" aria-expanded={menuOpen} aria-controls="sica-admin-mobile-links" onClick={() => setMenuOpen(open => !open)}><span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span> {menuOpen ? "Fechar menu" : "Menu administrativo"}</button><nav id="sica-admin-mobile-links" className={menuOpen ? "is-open" : ""} aria-label="Menu administrativo móvel">{ADMIN_MENU.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}</nav></div>
      <Outlet />
    </div>
  </div>;
}
