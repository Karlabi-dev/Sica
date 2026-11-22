import { Component } from "react";
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
const StaffGuard = lazy(() => import('./StaffGuard.jsx'));
const DeviceGuard = lazy(() => import('./DeviceGuard.jsx'));
import HomePage from '../pages/HomePage.jsx';
const DevicePendingPage = lazy(() => import('../pages/auth/DevicePendingPage.jsx'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx'));
const AdminEmailVerificationPage = lazy(() => import('../pages/auth/AdminEmailVerificationPage.jsx'));
import KioskPage from '../pages/patient/KioskPage.jsx';
import LiveTrackingPage from '../pages/patient/LiveTrackingPage.jsx';
import ClinicLandingPage from '../pages/patient/ClinicLandingPage.jsx';
const AttendantPage = lazy(() => import('../pages/attendant/AttendantPage.jsx'));
const DoctorPage = lazy(() => import('../pages/doctor/DoctorPage.jsx'));
import TvPage from '../pages/tv/TvPage.jsx';
const AdminPage = lazy(() => import('../pages/admin/AdminPage.jsx'));
const AdminSectionPage = lazy(() => import('../pages/admin/AdminSectionPage.jsx'));
import PublicLayout from '../layouts/PublicLayout.jsx';
const OperationalLayout = lazy(() => import('../layouts/OperationalLayout.jsx'));
const AdminLayout = lazy(() => import('../layouts/AdminLayout.jsx'));
class RouteErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError(error) { return { failed: true, errorMessage: String(error?.message ?? "Erro desconhecido").slice(0, 300) }; }
  componentDidCatch(error) { console.error("SICA route rendering failed", error); }
  render() {
    if (this.state.failed) return <main style={{ padding: 32, fontFamily: "system-ui", color: "#164f76" }}><h1>Não foi possível abrir o painel</h1><p>Ocorreu um erro ao renderizar esta página.</p><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",background:"#f2f6fa",padding:12,borderRadius:8}}>{this.state.errorMessage}</pre><p>Envie a mensagem acima para identificarmos a causa.</p><button onClick={() => window.location.reload()}>Tentar novamente</button></main>;
    return this.props.children;
  }
}
export function AppRoutes(){return <RouteErrorBoundary><Suspense fallback={<main className="page"><p>Carregando...</p></main>}><Routes><Route path="/" element={<HomePage/>}/><Route element={<PublicLayout/>}><Route path="/totem" element={<KioskPage/>}/><Route path="/acompanhar/:token" element={<LiveTrackingPage/>}/><Route path="/clinica" element={<ClinicLandingPage/>}/><Route path="/tv" element={<TvPage/>}/></Route><Route path="/login" element={<LoginPage/>}/><Route path="/autorizar-computador" element={<DevicePendingPage/>}/><Route path="/admin/verificar-email" element={<AdminEmailVerificationPage/>}/><Route element={<DeviceGuard role="attendant"/>}><Route element={<OperationalLayout/>}><Route path="/atendente" element={<AttendantPage/>}/></Route></Route><Route element={<DeviceGuard role="doctor"/>}><Route element={<OperationalLayout/>}><Route path="/medico" element={<DoctorPage/>}/></Route></Route><Route element={<StaffGuard roles={["admin"]}/> }><Route element={<AdminLayout/>}><Route path="/admin" element={<AdminPage/>}/><Route path="/admin/:section" element={<AdminSectionPage/>}/></Route></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></RouteErrorBoundary>;}
