import { useEffect,useState } from "react";
import { useLocation } from "react-router-dom";
import { deviceRequest,enrollDevice } from "../../services/device.js";
export default function DevicePendingPage(){
 const location=useLocation();
 const [state,setState]=useState({loading:true,status:"pending",name:""});
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  async function check(){
   try{
    let d;
    try{d=await deviceRequest("/devices/status");}catch(e){if(e.message!=="Dispositivo não registrado")throw e;d=await enrollDevice();}
    if(active){setState({loading:false,...d});setError("");}
    if(d.status==="active"&&active){
     const target=d.role==="doctor"?"/medico":"/atendente";
     if(location.pathname!==target)window.location.replace(target);
    }
   }catch(e){if(active){setError(e.message);setState(s=>({...s,loading:false}));}}
  }
  check();const id=setInterval(check,6000);return()=>{active=false;clearInterval(id);};
 },[location.pathname]);
 return <main className="page" style={{maxWidth:620,margin:"70px auto",padding:24,fontFamily:"system-ui"}}><h1>SICA · Autorização do computador</h1>{state.loading?<p>Verificando equipamento...</p>:state.status==="revoked"?<p>O acesso deste computador foi revogado. Contate a administração.</p>:<><p>Este computador está aguardando autorização da administração da clínica.</p><p>O administrador deve abrir <strong>Administração → Dispositivos autorizados</strong>, informar o nome e a função deste computador e aprovar a solicitação.</p><p>A página será atualizada automaticamente após a aprovação.</p></>}{error&&<p role="alert">{error}</p>}</main>;
}
