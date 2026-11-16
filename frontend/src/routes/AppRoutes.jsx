import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import KioskPage from '../pages/patient/KioskPage.jsx';
import TrackingPage from '../pages/patient/TrackingPage.jsx';
import AttendantPage from '../pages/attendant/AttendantPage.jsx';
import DoctorPage from '../pages/doctor/DoctorPage.jsx';
import TvPage from '../pages/tv/TvPage.jsx';
import AdminPage from '../pages/admin/AdminPage.jsx';
import AdminSectionPage from '../pages/admin/AdminSectionPage.jsx';
import PublicLayout from '../layouts/PublicLayout.jsx';
import OperationalLayout from '../layouts/OperationalLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
export function AppRoutes(){return <Routes><Route path="/" element={<HomePage/>}/><Route element={<PublicLayout/>}><Route path="/totem" element={<KioskPage/>}/><Route path="/acompanhar/:token" element={<TrackingPage/>}/><Route path="/tv" element={<TvPage/>}/></Route><Route path="/login" element={<LoginPage/>}/><Route element={<OperationalLayout/>}><Route path="/atendente" element={<AttendantPage/>}/><Route path="/medico" element={<DoctorPage/>}/></Route><Route element={<AdminLayout/>}><Route path="/admin" element={<AdminPage/>}/><Route path="/admin/:section" element={<AdminSectionPage/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes>;}
