import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const normalized=(v:unknown)=>String(v??"").trim().toLowerCase();
const msgId=(v:unknown)=>String(v??"").trim();
async function digest(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("");}
async function handleOne(db:any,p:any){
 const event=String(p?.event??"").trim();const kind=event.toLowerCase().replace(/[^a-z]/g,"");
 const email=normalized(p?.email);const providerId=msgId(p?.["message-id"]??p?.messageId);
 if(!event)return {ignored:true,reason:"missing event type"};
 const seconds=Number(p?.ts_event??p?.ts??0),millis=Number(p?.ts_epoch??0);
 const eventAt=millis>0?new Date(millis).toISOString():seconds>0?new Date(seconds*1000).toISOString():new Date().toISOString();
 const eventKey=await digest([providerId,event.toLowerCase(),String(p?.ts_event??p?.ts_epoch??p?.ts??""),email,String(p?.link??"")].join("|"));
 let delivery:any=null;
 if(providerId){const {data}=await db.from("ds_email_deliveries").select("id,recipient_id,status,provider_message_id").eq("provider_message_id",providerId).maybeSingle();delivery=data;}
 const {data:inserted,error:insertError}=await db.from("ds_email_events").upsert({
  event_key:eventKey,event_type:event,recipient_email:email||null,provider_message_id:providerId||null,event_at:eventAt,
  delivery_id:delivery?.id??null,link:p?.link?String(p.link).slice(0,2000):null,
  reason:p?.reason?String(p.reason).slice(0,1000):null,user_agent:p?.user_agent?String(p.user_agent).slice(0,1000):null,payload:p
 },{onConflict:"event_key",ignoreDuplicates:true}).select("id").maybeSingle();
 if(insertError)throw insertError;
 if(!inserted)return {duplicate:true,event};
 if(delivery){
  const patch:any={last_event_at:eventAt,updated_at:new Date().toISOString()};
  if(kind==="delivered"){patch.status="delivered";patch.delivered_at=eventAt;patch.bounced_at=null;}
  else if(["hardbounce","softbounce","blocked","invalid","error"].includes(kind)){patch.status="bounced";patch.bounced_at=eventAt;}
  else if(kind==="spam"){patch.status="complained";}
  else if(["sent","request"].includes(kind)&&delivery.status==="queued"){patch.status="sent";}
  if(kind==="opened"||kind==="uniqueopened"){
   const {count}=await db.from("ds_email_events").select("id",{count:"exact",head:true}).eq("delivery_id",delivery.id).in("event_type",["opened","uniqueOpened"]);
   patch.open_count=count??1;patch.last_opened_at=eventAt;
   const {data:prior}=await db.from("ds_email_deliveries").select("first_opened_at").eq("id",delivery.id).maybeSingle();
   patch.first_opened_at=prior?.first_opened_at??eventAt;
  }
  if(kind==="click"){
   const {count}=await db.from("ds_email_events").select("id",{count:"exact",head:true}).eq("delivery_id",delivery.id).eq("event_type","click");
   patch.click_count=count??1;patch.last_clicked_at=eventAt;
  }
  const {error}=await db.from("ds_email_deliveries").update(patch).eq("id",delivery.id);
  if(error)throw error;
 }
 let suppressionReason:string|null=null;
 if(["hardbounce"].includes(kind))suppressionReason="hard_bounce";
 if(["spam"].includes(kind))suppressionReason="spam_complaint";
 if(["invalid"].includes(kind))suppressionReason="invalid_email";
 if(["blocked"].includes(kind))suppressionReason="blocked";
 if(["unsubscribed"].includes(kind))suppressionReason="unsubscribed";
 if(kind==="softbounce"&&email){
  const {count}=await db.from("ds_email_events").select("id",{count:"exact",head:true}).eq("recipient_email",email).eq("event_type","softBounce");
  if((count??0)>=3)suppressionReason="soft_bounce_limit";
 }
 if(suppressionReason&&email){
  await db.from("ds_email_suppressions").upsert({email_normalized:email,reason:suppressionReason,source_event_id:inserted.id,notes:p?.reason?String(p.reason).slice(0,1000):null},{onConflict:"email_normalized",ignoreDuplicates:true});
  if(delivery?.recipient_id){
   await db.from("ds_email_preferences").update({email_enabled:false,updated_at:new Date().toISOString()}).eq("user_id",delivery.recipient_id);
   await db.from("ds_email_deliveries").update({status:"disabled",last_error:"Suppressed by Brevo event: "+suppressionReason,updated_at:new Date().toISOString()}).eq("recipient_id",delivery.recipient_id).in("status",["queued","failed"]);
  }
 }
 return {accepted:true,event,matched_delivery:Boolean(delivery),suppressed:Boolean(suppressionReason),duplicate:false};
}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed."},405);
 const auth=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
 if(!auth)return json({error:"Unauthorized."},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return json({error:"Webhook receiver is not configured."},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:valid,error}=await db.rpc("verify_dreamscapes_brevo_webhook_token",{p_token:auth});
 if(error||valid!==true)return json({error:"Unauthorized."},401);
 let payload:any;try{payload=await req.json()}catch{return json({error:"Invalid JSON."},400)}
 const events=Array.isArray(payload)?payload:[payload];
 if(events.length>500)return json({error:"Webhook batch exceeds 500 events."},413);
 const results=[];for(const item of events){try{results.push(await handleOne(db,item))}catch(e){console.error("Brevo event processing failed:",e);return json({error:"Event processing failed; Brevo may retry this delivery."},500)}}
 return json({received:events.length,processed:results.filter(x=>!x.duplicate&&!x.ignored).length,duplicates:results.filter(x=>x.duplicate).length,results});
});