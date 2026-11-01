import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const html=(body:string,status=200)=>new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dreamscapes email preferences</title><body style="margin:0;background:#080910;color:#f4f5fb;font:16px Arial;padding:35px"><main style="max-width:560px;margin:8vh auto;background:#111321;border:1px solid #34364b;border-radius:16px;padding:30px"><p style="color:#64efff;letter-spacing:3px;font-weight:bold">CROWRULES DREAMSCAPES</p><h1>Email preferences</h1><p>'+body+'</p><p><a style="color:#64efff" href="https://crowrulesentertainment-oss.github.io/dreamscapes/creator-portal.html">Return to Creator Portal</a></p></main></body></html>',{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="GET")return html("Method not allowed.",405);
 const token=new URL(req.url).searchParams.get("token")??"";
 if(!/^[0-9a-f-]{36}$/i.test(token))return html("This email preferences link is invalid or incomplete.",400);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return html("Email preference service is temporarily unavailable.",503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.from("ds_email_preferences").update({email_enabled:false,updated_at:new Date().toISOString()}).eq("unsubscribe_token",token).select("user_id").maybeSingle();
 if(error)return html("We could not update your preference. Please try again later.",500);
 if(!data)return html("This link is expired or has already been used. You can manage preferences from your Creator Portal.",404);
 return html("Email notifications for Dreamscapes project invitations and assignments have been turned off. Your in-app notification inbox will continue to work.");
});