import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const ORIGIN="https://crowrulesentertainment-oss.github.io";
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin","Cache-Control":"no-store"};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return reply({error:"Method not allowed."},405);
 if(req.headers.get("origin")&&req.headers.get("origin")!==ORIGIN)return reply({error:"Origin not allowed."},403);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!serviceKey||!anonKey)return reply({error:"Admin email service is not configured."},503);
 const authHeader=req.headers.get("authorization")??"",token=authHeader.replace(/^Bearer\s+/i,"");
 if(!token||token===authHeader)return reply({error:"Sign-in required."},401);
 const userClient=createClient(url,anonKey,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await userClient.auth.getUser(token);
 if(userError||!user)return reply({error:"Your administrator session is invalid or expired."},401);
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:admin,error:adminError}=await db.from("cr_admins").select("user_id,role,is_active").eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(adminError||!admin)return reply({error:"Active CrowRules administrator access is required."},403);
 let input:{action?:string;delivery_id?:string}={};try{input=await req.json()}catch{return reply({error:"Invalid request body."},400)}
 const action=input.action??"status";
 if(action==="status"){
  const statuses=["queued","processing","sent","delivered","bounced","failed","disabled","unknown"];
  const counts:Record<string,number>={};
  const countResults=await Promise.all(statuses.map(async status=>{
   const {count,error}=await db.from("ds_email_deliveries").select("id",{count:"exact",head:true}).eq("status",status);
   if(error)throw error;counts[status]=count??0;
  }));
  const trackedEvents=["delivered","hardBounce","softBounce","blocked","spam","invalid","deferred","click","opened","uniqueOpened","unsubscribed","sent"];
  const eventCounts:Record<string,number>={};
  await Promise.all(trackedEvents.map(async event=>{const {count,error}=await db.from("ds_email_events").select("id",{count:"exact",head:true}).eq("event_type",event);if(error)throw error;eventCounts[event]=count??0;}));
  const [{data:deliveries,error:listError},{data:runs,error:runError},{data:recentEvents,error:eventError},{data:suppressions,error:suppressionError}]=await Promise.all([
   db.from("ds_email_deliveries").select("id,notification_id,recipient_id,status,attempt_count,next_attempt_at,provider_message_id,last_error,created_at,updated_at,sent_at,delivered_at,bounced_at,open_count,click_count,first_opened_at,last_opened_at,last_clicked_at,notification:ds_notifications(title,notification_type,body,created_at)").order("created_at",{ascending:false}).limit(100),
   db.from("ds_email_worker_runs").select("id,started_at,finished_at,outcome,processed,sent,skipped,failed,busy,unknown,error_message").order("started_at",{ascending:false}).limit(10),
   db.from("ds_email_events").select("id,event_type,recipient_email,provider_message_id,event_at,link,reason,delivery_id").order("event_at",{ascending:false}).limit(100),
   db.from("ds_email_suppressions").select("id,email_normalized,reason,created_at,notes").order("created_at",{ascending:false}).limit(100)
  ]);
  if(listError||runError||eventError||suppressionError)return reply({error:"Could not load email operations data."},500);
  const enriched=await Promise.all((deliveries??[]).map(async d=>{
   const {data}=await db.auth.admin.getUserById(d.recipient_id);
   return {...d,recipient_email:data.user?.email??"Email unavailable"};
  }));
  return reply({counts,deliveries:enriched,worker_runs:runs??[],event_counts:eventCounts,recent_events:recentEvents??[],suppressions:suppressions??[],admin_email:user.email??null});
 }
 if(action==="retry"){
  const id=input.delivery_id;if(!id)return reply({error:"Delivery ID is required."},400);
  const {data:row,error:readError}=await db.from("ds_email_deliveries").select("id,status,attempt_count").eq("id",id).maybeSingle();
  if(readError||!row)return reply({error:"Delivery record not found."},404);
  if(row.status!=="failed"||row.attempt_count>=5)return reply({error:"Only failed deliveries with fewer than five attempts can be retried. Uncertain deliveries are deliberately excluded to prevent duplicate email."},409);
  const {data:updated,error}=await db.from("ds_email_deliveries").update({status:"queued",attempt_count:0,next_attempt_at:new Date().toISOString(),last_error:null,lease_expires_at:null,updated_at:new Date().toISOString()}).eq("id",id).eq("status","failed").select("id").maybeSingle();
  if(error||!updated)return reply({error:"Delivery could not be queued for retry."},409);
  return reply({ok:true,message:"Delivery returned to the queue. The worker will process it on its next run."});
 }
 if(action==="register-webhook"){
  const brevoKey=Deno.env.get("BREVO_API_KEY");if(!brevoKey)return reply({error:"BREVO_API_KEY is not configured."},503);
  const {data:webhookToken,error:tokenError}=await db.rpc("get_dreamscapes_brevo_webhook_token");
  if(tokenError||!webhookToken)return reply({error:"Could not retrieve the protected webhook credential."},500);
  const webhookUrl=url+"/functions/v1/dreamscapes-brevo-webhook";
  const webhookEvents=["delivered","hardBounce","softBounce","blocked","spam","invalid","deferred","click","opened","uniqueOpened","unsubscribed","sent","request"];
  const auth={type:"bearer",token:webhookToken};
  const listResponse=await fetch("https://api.brevo.com/v3/webhooks?type=transactional",{headers:{"api-key":brevoKey,"accept":"application/json"}});
  if(!listResponse.ok)return reply({error:"Could not inspect Brevo webhooks ("+listResponse.status+")."},502);
  const list=await listResponse.json();const existing=(list.webhooks??[]).find((x:any)=>x.url===webhookUrl&&x.type==="transactional");
  const payload={url:webhookUrl,description:"CrowRules Dreamscapes transactional email intelligence",events:webhookEvents,type:"transactional",auth,batched:false};
  const response=await fetch(existing?"https://api.brevo.com/v3/webhooks/"+existing.id:"https://api.brevo.com/v3/webhooks",{method:existing?"PUT":"POST",headers:{"api-key":brevoKey,"accept":"application/json","content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.text();if(!response.ok)return reply({error:"Brevo webhook configuration failed ("+response.status+"): "+result.slice(0,500)},502);
  let parsed:any={};try{parsed=JSON.parse(result)}catch{/* empty response */}
  return reply({ok:true,webhook_id:parsed.id??existing?.id??null,created:!existing,message:existing?"Existing Brevo webhook updated.":"Brevo transactional webhook created and connected.",url:webhookUrl,events:webhookEvents});
 }
 if(action==="test"){
  const brevoKey=Deno.env.get("BREVO_API_KEY"),fromEmail=Deno.env.get("DREAMSCAPES_EMAIL_FROM")??Deno.env.get("HUB_EMAIL_FROM");
  if(!brevoKey||!fromEmail)return reply({error:"Brevo sender configuration is missing."},503);
  if(!user.email||!user.email_confirmed_at)return reply({error:"Your administrator account needs a confirmed email address before a test can be sent."},400);
  const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":brevoKey,"accept":"application/json","content-type":"application/json"},body:JSON.stringify({sender:{email:fromEmail,name:"CrowRules Dreamscapes"},to:[{email:user.email}],subject:"Dreamscapes email operations test",textContent:"This is a test email from the Dreamscapes Email Operations Center. Transactional email delivery is connected.",htmlContent:'<!doctype html><html><body style="background:#080910;color:#f4f5fb;font:16px Arial;padding:30px"><main style="max-width:600px;margin:auto;background:#111321;border:1px solid #34364b;border-radius:14px;padding:28px"><p style="color:#64efff;letter-spacing:3px">CROWRULES DREAMSCAPES</p><h1>Email delivery test</h1><p>Your Dreamscapes Email Operations Center successfully reached Brevo.</p></main></body></html>'})});
  const text=await response.text();if(!response.ok)return reply({error:"Brevo rejected the test email ("+response.status+"): "+text.slice(0,400)},502);
  let messageId=null;try{messageId=JSON.parse(text)?.messageId??null}catch{/* provider response may be empty */}
  return reply({ok:true,message:"Test email accepted by Brevo for "+user.email+".",message_id:messageId});
 }
 return reply({error:"Unsupported action."},400);
});