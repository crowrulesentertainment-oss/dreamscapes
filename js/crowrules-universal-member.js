/* CrowRules Universal Member Center V2
   One Account. One Universe.
   Safe client-side reads: only attempts tables/columns that may exist; failed optional reads are ignored.
*/
(()=>{"use strict";
const SUPABASE_URL="https://cevylpnoexugwgygvtgu.supabase.co";
const SESSION_KEY="crowrules-universal-session-v1";
const MEMBER_CSS=`
#cr-member-center{position:fixed;right:18px;top:76px;z-index:99999;font:14px system-ui,sans-serif;color:#fff}
.crmc-trigger{display:flex;align-items:center;gap:9px;border:1px solid #ffffff22;border-radius:14px;background:#090c14ee;color:#fff;padding:9px 12px;cursor:pointer;box-shadow:0 10px 35px #0008}
.crmc-trigger img,.crmc-avatar{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#181c2b}
.crmc-fallback{display:grid;place-items:center;font-weight:800}.crmc-mini{display:grid;text-align:left}.crmc-mini span{font-size:11px;opacity:.65}
.crmc-dot{width:8px;height:8px;border-radius:50%;background:#55e6a5;margin-left:2px}
.crmc-panel{display:none;position:absolute;right:0;top:54px;width:min(420px,calc(100vw - 28px));max-height:calc(100vh - 90px);overflow:auto;border:1px solid #ffffff1c;border-radius:18px;background:#090c14f7;box-shadow:0 20px 60px #000b;backdrop-filter:blur(16px)}
.crmc-panel.open{display:block}.crmc-head{padding:18px;border-bottom:1px solid #ffffff12;display:flex;gap:12px;align-items:center}
.crmc-head h3{margin:0 0 3px;font-size:16px}.crmc-head p{margin:0;font-size:12px;opacity:.65}
.crmc-nav{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;border-bottom:1px solid #ffffff12}
.crmc-nav button{border:1px solid #ffffff10;background:#ffffff08;color:#fff;border-radius:9px;padding:8px 4px;cursor:pointer;font-size:11px}
.crmc-nav button.active{background:#ffffff18}.crmc-view{padding:14px}.crmc-section{border:1px solid #ffffff12;border-radius:12px;padding:12px;margin-bottom:9px;background:#ffffff06}
.crmc-section h4{margin:0 0 9px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.7}.crmc-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #ffffff0d}.crmc-row:last-child{border-bottom:0}.crmc-value{font-weight:700}.crmc-muted{opacity:.62;font-size:12px}
.crmc-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.crmc-actions a,.crmc-actions button{border:1px solid #ffffff16;border-radius:9px;background:#ffffff09;color:#fff;text-decoration:none;padding:8px 10px;cursor:pointer;font:inherit}
.crmc-notify{display:flex;gap:8px;align-items:center}.crmc-badge{min-width:18px;padding:2px 6px;border-radius:99px;background:#ffffff18;text-align:center;font-size:11px}
.crmc-guest{padding:14px;display:grid;gap:10px}.crmc-guest a{color:#fff;text-decoration:none;border:1px solid #ffffff16;border-radius:9px;padding:8px 10px}
@media(max-width:720px){#cr-member-center{left:10px;right:10px;top:66px}.crmc-panel{left:0;right:0;width:auto}.crmc-trigger{justify-content:center}}
`;
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const injectCss=()=>{if(document.getElementById("crmc-css"))return;const s=document.createElement("style");s.id="crmc-css";s.textContent=MEMBER_CSS;document.head.appendChild(s)};
const boot=async()=>{
 injectCss();
 const bridge=window.CrowRulesAuth;
 if(!bridge?.ready)return;
 await bridge.ready;
 const db=bridge.client||window.CrowRulesAuth.client;
 if(!db)return;
 let session=(await db.auth.getSession()).data.session;
 let root=document.getElementById("cr-member-center");
 if(!root){root=document.createElement("div");root.id="cr-member-center";document.body.appendChild(root)}
 const readOne=async(table,filters)=>{try{let q=db.from(table).select("*").limit(1);for(const [k,v] of Object.entries(filters||{}))q=q.eq(k,v);return (await q.maybeSingle()).data||null}catch(e){return null}};
 const readList=async(table,filters,limit=5)=>{try{let q=db.from(table).select("*").limit(limit);for(const [k,v] of Object.entries(filters||{}))q=q.eq(k,v);const r=await q;return r.data||[]}catch(e){return[]}};
 const firstList=async(table,uid,keys)=>{for(const key of keys){const rows=await readList(table,{[key]:uid},8);if(rows.length)return rows}return[]};
 const loadData=async()=>{
   const u=session?.user||{}, meta=u.user_metadata||{};
   let profile=null,member=null;
   for(const t of ["profiles","member_profiles"]){profile=await readOne(t,{id:u.id});if(profile)break}
   member=await readOne("members",{user_id:u.id})||await readOne("members",{id:u.id});
   const name=profile?.display_name||profile?.full_name||member?.display_name||meta.full_name||meta.name||u.email?.split("@")[0]||"CrowRules Member";
   const avatar=profile?.avatar_url||profile?.photo_url||meta.avatar_url||meta.picture||"";
   const bio=profile?.bio||member?.bio||"";
   const level=member?.membership_level||member?.membership_type||profile?.membership_level||"Free Member";
   const points=member?.crowpoints??member?.crow_points??profile?.crowpoints??profile?.crow_points??0;
   const notes=await firstList("notifications",u.id,["user_id","recipient_id","member_id"]);
   const msgs=await firstList("messages",u.id,["user_id","recipient_id","to_user_id"]);
   const friends=await firstList("friend_requests",u.id,["user_id","recipient_id","to_user_id"]);
   const caws=await firstList("crowspace_posts",u.id,["user_id","author_id","member_id"]);
   const dreams=await firstList("dream_submissions",u.id,["user_id","creator_id","member_id"]);
   const listens=await firstList("podcast_listening_history",u.id,["user_id","member_id"]);
   const views=await firstList("watch_history",u.id,["user_id","member_id"]);
   return {u,meta,name,avatar,bio,level,points,notes,msgs,friends,caws,dreams,listens,views};
 };
 const render=async()=>{
   if(!session){root.innerHTML='<div class="crmc-trigger"><span>One Account. One Universe.</span></div><div class="crmc-panel"><div class="crmc-guest"><b>Join CrowRules</b><a href="/crowspace/login.html">Log In</a><a href="/crowspace/signup.html">Create Account</a></div></div>';return}
   const d=await loadData(), avatar=d.avatar?'<img src="'+esc(d.avatar)+'" class="crmc-avatar" alt="">':'<div class="crmc-avatar crmc-fallback">CR</div>';
   root.innerHTML='<button class="crmc-trigger" id="crmc-open">'+avatar+'<span class="crmc-mini"><b>'+esc(d.name)+'</b><span>'+esc(d.level)+' · '+esc(d.points)+' CrowPoints</span></span><i class="crmc-dot"></i></button><section class="crmc-panel" id="crmc-panel"><header class="crmc-head">'+avatar+'<div><h3>'+esc(d.name)+'</h3><p>'+esc(d.u.email||"")+'</p></div></header><nav class="crmc-nav"><button class="active" data-tab="profile">Profile</button><button data-tab="membership">Membership</button><button data-tab="notifications" class="crmc-notify">Alerts <span class="crmc-badge">'+d.notes.length+'</span></button><button data-tab="activity">Activity</button></nav><div class="crmc-view" id="crmc-view"></div></section>';
   const view=root.querySelector("#crmc-view");
   const tabs={
    profile:'<div class="crmc-section"><h4>Profile</h4><div class="crmc-row"><span>Name</span><span class="crmc-value">'+esc(d.name)+'</span></div><div class="crmc-row"><span>Bio</span><span class="crmc-value">'+esc(d.bio||"Add a bio")+'</span></div><div class="crmc-actions"><a href="/crowspace/profile.html">Public Profile</a><a href="/crowspace/account.html">Account Settings</a></div></div><div class="crmc-section"><h4>Connections</h4><div class="crmc-row"><span>Friends / requests</span><span class="crmc-value">'+d.friends.length+'</span></div><div class="crmc-row"><span>Messages</span><span class="crmc-value">'+d.msgs.length+'</span></div></div>',
    membership:'<div class="crmc-section"><h4>Membership</h4><div class="crmc-row"><span>Current level</span><span class="crmc-value">'+esc(d.level)+'</span></div><div class="crmc-row"><span>CrowPoints</span><span class="crmc-value">'+esc(d.points)+'</span></div><div class="crmc-row"><span>Status</span><span class="crmc-value">Active account</span></div><div class="crmc-actions"><a href="/members/">Membership Center</a></div></div><div class="crmc-section"><h4>Benefits</h4><div class="crmc-muted">Membership benefits and renewal details can be connected to the CrowRules membership plan without changing the universal login.</div></div>',
    notifications:'<div class="crmc-section"><h4>Notifications</h4>'+((d.notes.length?d.notes.map((n,i)=>'<div class="crmc-row"><span>'+esc(n.title||n.message||n.type||"Notification")+'</span><span class="crmc-muted">'+esc(n.created_at||"")+'</span></div>').join(""):'<div class="crmc-muted">No notifications available.</div>')+'</div><div class="crmc-section"><h4>Messages</h4><div class="crmc-row"><span>Messages</span><span class="crmc-value">'+d.msgs.length+'</span></div><div class="crmc-row"><span>Friend requests</span><span class="crmc-value">'+d.friends.length+'</span></div></div>',
    activity:'<div class="crmc-section"><h4>Across CrowRules</h4><div class="crmc-row"><span>Recent Caws</span><span class="crmc-value">'+d.caws.length+'</span></div><div class="crmc-row"><span>Sports activity</span><span class="crmc-value">Ready</span></div><div class="crmc-row"><span>Podcast listening</span><span class="crmc-value">'+d.listens.length+'</span></div><div class="crmc-row"><span>Dreamscapes submissions</span><span class="crmc-value">'+d.dreams.length+'</span></div><div class="crmc-row"><span>TV viewing</span><span class="crmc-value">'+d.views.length+'</span></div><div class="crmc-row"><span>Holiday activity</span><span class="crmc-value">Ready</span></div><div class="crmc-row"><span>Spectrum Awards</span><span class="crmc-value">Ready</span></div></div><div class="crmc-actions"><a href="/crowspace/">CrowSpace</a><a href="/sports/">Sports</a><a href="/podcasting/">Podcasting</a><a href="/dreamscapes/">Dreamscapes</a></div>'
   };
   const show=k=>{view.innerHTML=tabs[k]||tabs.profile;root.querySelectorAll(".crmc-nav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===k))};
   show("profile");
   root.querySelector("#crmc-open").onclick=()=>root.querySelector("#crmc-panel").classList.toggle("open");
   root.querySelectorAll(".crmc-nav button").forEach(b=>b.onclick=()=>show(b.dataset.tab));
 };
 db.auth.onAuthStateChange((_e,s)=>{session=s;render()}); await render();
 window.CrowRulesMember={client:db,ready:Promise.resolve(),getSession:()=>session};
 };
 const wait=()=>window.CrowRulesAuth?.ready?boot():setTimeout(wait,50);wait();
})();