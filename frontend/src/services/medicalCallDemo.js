import { useEffect, useState } from "react";

// DEMO ONLY: localStorage is not a clinical data store or a secure multi-device channel.
const KEY = "sica-demo-medical-call-v1";
const EVENT = "sica-demo-medical-call-change";
export const CALL_TIMEOUT_MS = 2 * 60 * 1000;

export function readMedicalCall() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value && typeof value.ticket === "string" && typeof value.status === "string" ? value : null;
  } catch { return null; }
}
export function writeMedicalCall(value) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}
export function useMedicalCall() {
  const [call, setCall] = useState(readMedicalCall);
  useEffect(() => {
    const sync = () => setCall(readMedicalCall());
    window.addEventListener("storage", sync);
    window.addEventListener(EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(EVENT, sync); };
  }, []);
  return call;
}
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}
export function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}
