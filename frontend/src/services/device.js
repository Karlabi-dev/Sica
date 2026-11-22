const API=import.meta.env.VITE_API_BASE_URL??"http://localhost:3001";
const KEY="sica_device_token";
export const deviceToken=()=>localStorage.getItem(KEY);
export async function deviceRequest(path,options={}) {
 const response=await fetch(API+path,{...options,headers:{"Content-Type":"application/json","X-Device-Token":deviceToken()??"",...(options.headers??{})},cache:"no-store"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(body.error??"Falha ao verificar dispositivo");
 return body;
}
export async function enrollDevice(){
 const data=await deviceRequest("/devices/request",{method:"POST"});
 if(data.token) localStorage.setItem(KEY,data.token);
 return data;
}
