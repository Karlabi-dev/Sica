import {useEffect,useState} from "react";
import {NavLink,Outlet,useLocation} from "react-router-dom";
import {LayoutDashboard,ClipboardList,UsersRound,Stethoscope,Layers3,HeartPulse,DoorOpen,Monitor,ShieldCheck,ScrollText,Settings2,PanelLeftClose,PanelLeftOpen,Menu,X,ChevronRight,Building2} from "lucide-react";
import {adminApi} from "../pages/admin/adminApi.js";
import "../pages/admin/SettingsPage.css";
import "./AdminLayout.css";

export const ADMIN_MENU=[
 {to:"/admin",label:"Visão geral",icon:LayoutDashboard,end:true,group:"Visão geral"},
 {to:"/admin/atendimentos",label:"Atendimentos",icon:ClipboardList,group:"Operação"},
 {to:"/admin/filas",label:"Filas de atendimento",icon:Layers3,group:"Operação"},
 {to:"/admin/pacientes",label:"Pacientes",icon:UsersRound,group:"Operação"},
 {to:"/admin/profissionais",label:"Profissionais",icon:Stethoscope,group:"Cadastros"},
 {to:"/admin/especialidades",label:"Especialidades",icon:HeartPulse,group:"Cadastros"},
 {to:"/admin/salas",label:"Salas e consultórios",icon:DoorOpen,group:"Cadastros"},
 {to:"/admin/televisores",label:"Televisores",icon:Monitor,group:"Administração"},
 {to:"/admin/dispositivos",label:"Dispositivos autorizados",icon:ShieldCheck,group:"Administração"},
 {to:"/admin/auditoria",label:"Auditoria",icon:ScrollText,group:"Administração"},
 {to:"/admin/configuracoes",label:"Configurações",icon:Settings2,group:"Administração"}
];
const groups=["Visão geral","Operação","Cadastros","Administração"];
export default function AdminLayout(){
 const location=useLocation();
 const [menuOpen,setMenuOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [clinicName,setClinicName]=useState("SICA");
 const current=ADMIN_MENU.find(i=>i.to===location.pathname);
 useEffect(()=>{let active=true;adminApi("/admin/settings").then(d=>{if(!active)return;setClinicName(d.name||"SICA");const p=d.preferences??{};const root=document.documentElement;root.dataset.sicaTheme="light";root.dataset.sicaContrast=p.highContrast?"high":"normal";root.dataset.sicaMotion=p.reducedMotion?"reduced":"normal";root.style.setProperty("--sica-font-scale",String((p.fontScale??100)/100));root.style.fontSize=(p.fontScale??100)+"%";}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{setMenuOpen(false);},[location.pathname]);
 function navigation(mobile=false){return <nav className="sica-nav" aria-label={mobile?"Menu administrativo móvel":"Menu administrativo"}>{groups.map(group=><div className="sica-nav-group" key={group}><div className="sica-nav-group-title">{group}</div>{ADMIN_MENU.filter(i=>i.group===group).map(item=>{const Icon=item.icon;return <NavLink key={item.to} to={item.to} end={item.end} title={collapsed&&!mobile?item.label:undefined} className={({isActive})=>"sica-admin-navlink"+(isActive?" active":"")}><Icon size={19} strokeWidth={1.9} aria-hidden="true"/><span className="sica-nav-label">{item.label}</span></NavLink>})}</div>)}</nav>}
 return <div className={"sica-admin"+(collapsed?" sica-admin-collapsed":"")}>
 <aside className="sica-admin-sidebar" aria-label="Barra lateral"><div className="sica-admin-brand"><span className="sica-brand-mark">S</span><div className="sica-brand-copy"><strong>SICA</strong><small>GESTÃO CLÍNICA</small></div><button type="button" className="sica-collapse-button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?"Expandir menu":"Recolher menu"} title={collapsed?"Expandir menu":"Recolher menu"}>{collapsed?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button></div><div className="sica-sidebar-clinic"><Building2 size={16}/><span title={clinicName}>{clinicName}</span></div>{navigation()}<div className="sica-admin-sidebar-bottom"><span className="sica-admin-user-icon">AD</span><div className="sica-sidebar-profile"><strong>Administração</strong><small>Painel de gestão</small></div></div></aside>
 <div className="sica-admin-content"><header className="sica-admin-topbar"><div className="sica-topbar-path"><span>Administração</span><ChevronRight size={15}/><strong>{current?.label??"SICA"}</strong></div><div className="sica-admin-top-user"><span className="sica-topbar-clinic" title={clinicName}>{clinicName}</span><span className="sica-admin-user-icon">AD</span></div></header>
 <div className="sica-admin-mobile-nav"><div className="sica-mobile-top"><strong>SICA <span>· Administração</span></strong><button type="button" className="sica-admin-menu-toggle" aria-expanded={menuOpen} aria-controls="sica-admin-mobile-links" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}<span>{menuOpen?"Fechar":"Menu"}</span></button></div>{menuOpen&&<button type="button" className="sica-mobile-overlay" aria-label="Fechar menu" onClick={()=>setMenuOpen(false)}/>}<div id="sica-admin-mobile-links" className={"sica-mobile-drawer"+(menuOpen?" is-open":"")}>{navigation(true)}</div></div>
 <Outlet/></div></div>;
}
