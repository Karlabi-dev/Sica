import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
export const hashTrackingToken = token => createHash("sha256").update(token).digest("hex");
function key() {
 const raw=process.env.TRACKING_TOKEN_ENCRYPTION_KEY;
 if(!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw Object.assign(new Error("TRACKING_TOKEN_ENCRYPTION_KEY must be 64 hex characters"),{code:"TRACKING_KEY_CONFIG"});
 return Buffer.from(raw,"hex");
}
export function encryptTrackingToken(token) {
 const iv=randomBytes(12);
 const cipher=createCipheriv("aes-256-gcm",key(),iv);
 const data=Buffer.concat([cipher.update(token,"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64");
}
export function decryptTrackingToken(payload) {
 if(!payload) return null;
 const raw=Buffer.from(payload,"base64");
 if(raw.length<29) return null;
 const decipher=createDecipheriv("aes-256-gcm",key(),raw.subarray(0,12));
 decipher.setAuthTag(raw.subarray(12,28));
 return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString("utf8");
}
