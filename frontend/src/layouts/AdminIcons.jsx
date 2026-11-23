import React from "react";
const paths={
 LayoutDashboard:<><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
 ClipboardList:<><rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6M9 19h4"/></>,
 UsersRound:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/></>,
 Stethoscope:<><path d="M6 3v6a5 5 0 0 0 10 0V3M4 3h4M14 3h4M11 14v2a5 5 0 0 0 10 0v-2"/><circle cx="21" cy="12" r="2"/></>,
 Layers3:<><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/></>,
 HeartPulse:<><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 12h5l2-3 3 6 2-3h6"/></>,
 DoorOpen:<><path d="M4 21h16M6 21V4l12-2v19M6 4h-2v17M15 12h.01"/></>,
 Monitor:<><rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8M12 18v4"/></>,
 ShieldCheck:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
 ScrollText:<><path d="M8 21h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3M4 7h4M11 8h7M11 12h7M11 16h5"/></>,
 Settings2:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></>,
 PanelLeftClose:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-12-3 3 3 3"/></>,
 PanelLeftOpen:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m3-12 3 3-3 3"/></>,
 Menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
 X:<><path d="M5 5l14 14M19 5 5 19"/></>,
 ChevronRight:<><path d="m9 18 6-6-6-6"/></>,
 Building2:<><rect x="3" y="3" width="13" height="18" rx="1"/><path d="M16 9h5v12H3M7 7h2m3 0h1M7 11h2m3 0h1M7 15h2m3 0h1M8 21v-3h4v3"/></>
};
function Icon({name,size=20,strokeWidth=1.9,...props}){return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>}
export const LayoutDashboard=p=> <Icon name="LayoutDashboard" {...p}/>;
export const ClipboardList=p=> <Icon name="ClipboardList" {...p}/>;
export const UsersRound=p=> <Icon name="UsersRound" {...p}/>;
export const Stethoscope=p=> <Icon name="Stethoscope" {...p}/>;
export const Layers3=p=> <Icon name="Layers3" {...p}/>;
export const HeartPulse=p=> <Icon name="HeartPulse" {...p}/>;
export const DoorOpen=p=> <Icon name="DoorOpen" {...p}/>;
export const Monitor=p=> <Icon name="Monitor" {...p}/>;
export const ShieldCheck=p=> <Icon name="ShieldCheck" {...p}/>;
export const ScrollText=p=> <Icon name="ScrollText" {...p}/>;
export const Settings2=p=> <Icon name="Settings2" {...p}/>;
export const PanelLeftClose=p=> <Icon name="PanelLeftClose" {...p}/>;
export const PanelLeftOpen=p=> <Icon name="PanelLeftOpen" {...p}/>;
export const Menu=p=> <Icon name="Menu" {...p}/>;
export const X=p=> <Icon name="X" {...p}/>;
export const ChevronRight=p=> <Icon name="ChevronRight" {...p}/>;
export const Building2=p=> <Icon name="Building2" {...p}/>;
