import { auth } from "../../services/firebase.js";
import { getAdminSession } from "../../services/adminSession.js";
const API=import.meta.env.VITE_API_BASE_URL??"http://localhost:3001";
export async function adminApi(path,options={}){
 const user=auth.currentUser;if(!user)throw new Error("Entre como administrador");
 const token=await user.getIdToken();
 const response=await fetch(API+path,{...options,cache:"no-store",headers:{"Authorization":"Bearer "+token,"X-Admin-Session":getAdminSession(user.uid),"Content-Type":"application/json",...(options.headers??{})}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error??"Falha ao consultar o servidor");
 return body;
}
