// Best-effort per-instance limiter for prototype deployments.
// Production requires a shared store (e.g. Redis) and edge protection.
const buckets = new Map();
export function rateLimit({windowMs=60000,max=10}={}) {
 return (req,res,next)=>{
  const now=Date.now();
  if(buckets.size>10000){for(const [key,value] of buckets){if(value.reset<=now)buckets.delete(key);}}
  const ip=req.ip??req.socket.remoteAddress??"unknown";
  const key=req.path+":"+ip;
  const previous=buckets.get(key);
  const current=!previous||previous.reset<=now?{count:0,reset:now+windowMs}:previous;
  current.count++;
  buckets.set(key,current);
  if(current.count>max){
   res.set("Retry-After",String(Math.ceil((current.reset-now)/1000)));
   return res.status(429).json({error:"Muitas tentativas. Aguarde antes de tentar novamente."});
  }
  return next();
 };
}
