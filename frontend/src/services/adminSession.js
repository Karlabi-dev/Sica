const KEY="sica_admin_session_v2";
const LEGACY="sica_admin_session";
const TTL=12*60*60*1000;
export function clearAdminSession(){localStorage.removeItem(KEY);sessionStorage.removeItem(LEGACY);}
export function saveAdminSession(token,uid,expiresInSeconds=43200){
 if(typeof token!=="string"||!uid)return;
 clearAdminSession();
 const ttl=Math.min(TTL,Math.max(0,Number(expiresInSeconds)*1000||TTL));
 localStorage.setItem(KEY,JSON.stringify({token,uid,expiresAt:Date.now()+ttl}));
}
export function getAdminSession(uid){
 if(!uid)return "";
 try{
  const item=JSON.parse(localStorage.getItem(KEY)??"null");
  if(item&&item.uid===uid&&typeof item.token==="string"&&Date.now()<item.expiresAt)return item.token;
  if(item)clearAdminSession();
 }catch{clearAdminSession();}
 return "";
}
