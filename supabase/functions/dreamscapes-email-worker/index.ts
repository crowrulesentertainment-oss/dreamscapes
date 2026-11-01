import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
const esc=(v:unknown)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e??"Unknown error");
const backoff=(attempt:number)=>Math.min(86400000,60000*2**Math.max(0,attempt-1));
const PROJECT_URL="https://crowrulesentertainment-oss.github.io/dreamscapes/";
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed."},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const brevoKey=Deno.env.get("BREVO_API_KEY"),fromEmail=Deno.env.get("DREAMSCAPES_EMAIL_FROM")??Deno.env.get("HUB_EMAIL_FROM");
 if(!url||!serviceKey||!brevoKey||!fromEmail)return json({error:"Email worker configuration is incomplete. Configure BREVO_API_KEY and DREAMSCAPES_EMAIL_FROM (or HUB_EMAIL_FROM)."},503);
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const supplied=req.headers.get("x-worker-token")??"";
 if(!supplied)return json({error:"Unauthorized."},401);
 const {data:authorized,error:authError}=await db.rpc("verify_dreamscapes_email_worker_token",{p_token:supplied});
 if(authError||authorized!==true)return json({error:"Unauthorized."},401);
 const {data:runRow,error:runInsertError}=await db.from("ds_email_worker_runs").insert({outcome:"running"}).select("id").single();
 if(runInsertError)return json({error:"Could not record worker run."},500);
 const runId=runRow.id;
 const nowIso=new Date().toISOString(),staleIso=new Date(Date.now()-10*60*1000).toISOString();
 const {error:staleError}=await db.from("ds_email_deliveries").update({status:"unknown",last_error:"Worker lease expired; provider acceptance is uncertain. Review Brevo logs before retrying.",lease_expires_at:null,updated_at:nowIso}).eq("status","processing").lt("lease_expires_at",staleIso);
 if(staleError)console.error("Could not mark stale delivery leases:",staleError.message);
 const {data:items,error}=await db.from("ds_email_deliveries").select("id,notification_id,recipient_id,status,attempt_count,next_attempt_at").in("status",["queued","failed"]).lt("attempt_count",5).lte("next_attempt_at",nowIso).order("created_at",{ascending:true}).limit(50);
 if(error)return json({error:"Could not load queued email notifications."},500);
 let sent=0,skipped=0,failed=0,busy=0,unknown=0;
 for(const item of items??[]){
  const claimAt=new Date(),nextAttempt=Number(item.attempt_count)+1;
  const {data:claim,error:claimError}=await db.from("ds_email_deliveries").update({status:"processing",attempt_count:nextAttempt,lease_expires_at:new Date(claimAt.getTime()+10*60*1000).toISOString(),updated_at:claimAt.toISOString(),last_error:null}).eq("id",item.id).eq("status",item.status).eq("attempt_count",item.attempt_count).select("id").maybeSingle();
  if(claimError){failed++;continue} if(!claim){busy++;continue}
  try{
   const [{data:notification,error:nError},{data:preference,error:pError},{data:account,error:aError}]=await Promise.all([
    db.from("ds_notifications").select("id,title,body,notification_type,project_id,created_at").eq("id",item.notification_id).maybeSingle(),
    db.from("ds_email_preferences").select("email_enabled,unsubscribe_token").eq("user_id",item.recipient_id).maybeSingle(),
    db.auth.admin.getUserById(item.recipient_id)
   ]);
   if(nError||pError||aError)throw new Error("Could not load notification recipient details.");
   if(!notification){await db.from("ds_email_deliveries").update({status:"disabled",lease_expires_at:null,updated_at:new Date().toISOString(),last_error:"Notification no longer exists."}).eq("id",item.id);skipped++;continue}
   if(!preference?.email_enabled){await db.from("ds_email_deliveries").update({status:"disabled",lease_expires_at:null,updated_at:new Date().toISOString(),last_error:"Recipient disabled email notifications."}).eq("id",item.id);skipped++;continue}
   const email=account.user?.email;if(!email||!account.user.email_confirmed_at)throw new Error("Recipient has no confirmed account email address.");
   const unsubscribe=url+"/functions/v1/dreamscapes-email-unsubscribe?token="+encodeURIComponent(preference.unsubscribe_token);
   const title=String(notification.title??"Dreamscapes update"),body=String(notification.body??"");
   const category=notification.notification_type==="project_invitation"?"Project invitation":"Production assignment";
   const html='<!doctype html><html lang="en"><meta charset="utf-8"><body style="margin:0;background:#080910;color:#f4f5fb;font:16px Arial,sans-serif;padding:24px"><main style="max-width:620px;margin:auto;background:#111321;border:1px solid #34364b;border-radius:16px;padding:30px"><p style="color:#64efff;letter-spacing:3px;font-size:12px;font-weight:bold">CROWRULES DREAMSCAPES</p><p style="color:#b7a1ff;font-size:12px;text-transform:uppercase;letter-spacing:2px">'+esc(category)+'</p><h1 style="font-size:25px">'+esc(title)+'</h1><p style="line-height:1.65;color:#d8d9e6">'+esc(body)+'</p><p style="margin:28px 0"><a href="'+PROJECT_URL+'creator-portal.html" style="background:#64efff;color:#080910;text-decoration:none;font-weight:bold;padding:13px 19px;border-radius:8px;display:inline-block">Open Creator Portal</a></p><hr style="border:0;border-top:1px solid #34364b"><p style="font-size:12px;color:#a7a9bd">You are receiving project and production updates from Dreamscapes. <a href="'+esc(unsubscribe)+'" style="color:#64efff">Turn off email notifications</a>.</p></main></body></html>';
   let response:Response;
   try{
    response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":brevoKey,"accept":"application/json","content-type":"application/json"},body:JSON.stringify({sender:{email:fromEmail,name:"CrowRules Dreamscapes"},to:[{email}],subject:"Dreamscapes: "+title,textContent:title+"\n\n"+body+"\n\nOpen your Creator Portal: "+PROJECT_URL+"creator-portal.html\nTurn off email notifications: "+unsubscribe,htmlContent:html,headers:{"List-Unsubscribe":"<"+unsubscribe+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}}),signal:AbortSignal.timeout(20000)});
   }catch(e){
    await db.from("ds_email_deliveries").update({status:"unknown",last_error:("Brevo request outcome uncertain: "+errorText(e)).slice(0,1000),lease_expires_at:null,updated_at:new Date().toISOString()}).eq("id",item.id).eq("status","processing");unknown++;continue;
   }
   const responseText=await response.text();
   if(!response.ok){
    const reason="Brevo rejected email ("+response.status+"): "+responseText.slice(0,500);
    await db.from("ds_email_deliveries").update({status:"failed",last_error:reason.slice(0,1000),next_attempt_at:new Date(Date.now()+backoff(nextAttempt)).toISOString(),lease_expires_at:null,updated_at:new Date().toISOString()}).eq("id",item.id).eq("status","processing");failed++;continue;
   }
   let providerId:string|null=null;try{providerId=JSON.parse(responseText)?.messageId??null}catch{/* empty provider body */}
   const sentAt=new Date().toISOString();
   const {error:updateError}=await db.from("ds_email_deliveries").update({status:"sent",sent_at:sentAt,provider_message_id:providerId,lease_expires_at:null,updated_at:sentAt,last_error:null}).eq("id",item.id).eq("status","processing");
   if(updateError){console.error("Brevo accepted message but delivery ledger update failed",item.id);unknown++;continue}sent++;
  }catch(e){
   const reason=errorText(e);
   await db.from("ds_email_deliveries").update({status:"failed",last_error:reason.slice(0,1000),next_attempt_at:new Date(Date.now()+backoff(nextAttempt)).toISOString(),lease_expires_at:null,updated_at:new Date().toISOString()}).eq("id",item.id).eq("status","processing");failed++;
  }
 }
 const runFinished=new Date().toISOString();
 const {error:runUpdateError}=await db.from("ds_email_worker_runs").update({finished_at:runFinished,outcome:"succeeded",processed:(items??[]).length,sent,skipped,failed,busy,unknown}).eq("id",runId);
 if(runUpdateError)console.error("Could not finish worker run record:",runUpdateError.message);
 return json({processed:(items??[]).length,sent,skipped,failed,busy,unknown});
});