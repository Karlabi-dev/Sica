import { useEffect,useState } from "react";
import { Navigate,Outlet } from "react-router-dom";
import { deviceRequest } from "../services/device.js";
export default function DeviceGuard({role}){
 const [state,setState]=useState({loading:true,role:null});
 useEffect(()=>{
  let active=true;
  async function check(){
   try{const d=await deviceRequest("/devices/status");if(active)setState({loading:false,role:d.status==="active"?d.role:null});}
   catch{if(active)setState({loading:false,role:null});}
  }
  check();const id=setInterval(check,15000);return()=>{active=false;clearInterval(id);};
 },[]);
 if(state.loading)return <main className="page"><p>Verificando autorização do computador...</p></main>;
 if(!state.role)return <Navigate to="/autorizar-computador" replace/>;
 if(state.role!==role)return <main className="page"><h1>Acesso não autorizado</h1><p>Este computador está vinculado a outra função. Solicite a alteração ao administrador.</p></main>;
 return <Outlet/>;
}
