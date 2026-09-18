/* =========================================================
   CROWRULES UNIVERSAL MEMBERSHIP
   Dreamscapes-wide account + membership layer.
   Membership is a CrowRules account capability, not a
   substitute for creator rights, ownership, agreements, or
   earnings.
   ========================================================= */
(function(){
  "use strict";

  const CONFIG = {
    supabaseUrl: "https://cevylpnoexugwgygvtgu.supabase.co",
    publishableKey: "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
    membershipPage: "membership.html",
    loginPage: "login.html",
    portalPage: "creator-portal.html",
    statusFunction: "https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/membership-status"
  };

  let client = null;
  let currentSession = null;
  let currentMembership = null;
  let bootPromise = null;

  function escapeHTML(value){
    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function membershipName(m){
    return m?.plan_name || m?.display_name || m?.plan_key || "Universal Membership";
  }

  function membershipStatus(m){
    if(m?.status) return String(m.status);
    if(m?.membership_status) return String(m.membership_status);
    if(typeof m?.is_active === "boolean") return m.is_active ? "Active" : "Inactive";
    return "Active";
  }

  function membershipKey(m){
    return String(m?.plan_key || "").toLowerCase();
  }

  function statusClass(m){
    const s = membershipStatus(m).toLowerCase();
    if(s.includes("inactive") || s.includes("cancel") || s.includes("expired")) return "crum-status-inactive";
    if(s.includes("pending")) return "crum-status-pending";
    return "crum-status-active";
  }

  function loadSupabase(){
    if(window.supabase) return Promise.resolve(window.supabase);
    if(bootPromise) return bootPromise;

    bootPromise = new Promise((resolve,reject)=>{
      const existing = document.querySelector('script[data-cr-supabase-loader="1"]');
      if(existing){
        existing.addEventListener("load",()=>resolve(window.supabase));
        existing.addEventListener("error",()=>reject(new Error("Supabase JS failed to load.")));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.dataset.crSupabaseLoader = "1";
      script.onload = ()=>window.supabase ? resolve(window.supabase) : reject(new Error("Supabase JS is unavailable."));
      script.onerror = ()=>reject(new Error("Supabase JS failed to load."));
      document.head.appendChild(script);
    });

    return bootPromise;
  }

  async function init(){
    const supabase = await loadSupabase();
    if(!client){
      client = window.supabaseClient || supabase.createClient(
        CONFIG.supabaseUrl,
        CONFIG.publishableKey,
        {
          auth:{
            autoRefreshToken:true,
            persistSession:true,
            detectSessionInUrl:true
          }
        }
      );
    }
    return client;
  }

  async function getSession(){
    const db = await init();
    const {data,error} = await db.auth.getSession();
    if(error) throw error;
    currentSession = data?.session || null;
    return currentSession;
  }

  async function ensureCrow(){
    const db = await init();
    const {data,error} = await db.rpc("ensure_crow_membership");
    if(error) throw error;
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  async function getMembership(){
    const db = await init();
    const {data,error} = await db.rpc("get_my_membership");
    if(error) throw error;
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  async function getStatus(){
    const session = await getSession();

    if(!session?.access_token){
      currentMembership = null;
      return {
        ok:true,
        authenticated:false,
        membership:null,
        sites:[],
        entitlements:[]
      };
    }

    /* The Supabase session is the source of truth for whether
       the visitor is signed in. Membership lookup must never
       turn a signed-in account back into a "Sign In" banner. */
    try{
      const response = await fetch(CONFIG.statusFunction,{
        method:"GET",
        headers:{
          Authorization:"Bearer " + session.access_token,
          apikey:CONFIG.publishableKey
        }
      });

      if(response.ok){
        const payload = await response.json();
        if(payload?.ok){
          currentMembership = payload.membership || null;
          return {
            ...payload,
            authenticated:true,
            membership:currentMembership
          };
        }
      }
    }catch(error){
      console.warn("CrowRules membership-status:",error);
    }

    let membership = null;
    try{
      membership = await getMembership();
    }catch(error){
      console.warn("get_my_membership:",error);
    }

    if(!membership){
      try{
        await ensureCrow();
        membership = await getMembership();
      }catch(error){
        console.warn("ensure_crow_membership:",error);
      }
    }

    currentMembership = membership;
    return {
      ok:true,
      authenticated:true,
      membership,
      sites:[],
      entitlements:[]
    };
  }

  function ensureBar(){
    let bar = document.getElementById("cr-universal-membership-bar");
    if(bar) return bar;

    bar = document.createElement("div");
    bar.id = "cr-universal-membership-bar";
    bar.className = "crum-bar";
    bar.setAttribute("role","status");
    bar.setAttribute("aria-live","polite");

    const nav = document.querySelector(".ds-global-nav");
    if(nav?.parentNode){
      nav.insertAdjacentElement("afterend",bar);
    }else{
      document.body.prepend(bar);
    }
    return bar;
  }

  function render(payload){
    const bar = ensureBar();
    const authenticated = !!payload?.authenticated;
    const membership = payload?.membership || null;
    const sessionUser = currentSession?.user || null;

    if(!authenticated){
      const page = location.pathname.split("/").pop() || "index.html";
      const loginHref = CONFIG.loginPage + "?redirect=" + encodeURIComponent(page);

      bar.innerHTML =
        '<div class="crum-inner">' +
          '<div class="crum-brand">' +
            '<span class="crum-orb" aria-hidden="true">CR</span>' +
            '<span class="crum-brand-copy">' +
              '<strong>CROWRULES ACCOUNT</strong>' +
              '<small>ONE ACCOUNT ACROSS THE CROWRULES UNIVERSE</small>' +
            '</span>' +
          '</div>' +
          '<div class="crum-copy">Sign in once to carry your CrowRules membership into Dreamscapes and other CrowRules experiences.</div>' +
          '<div class="crum-actions">' +
            '<a class="crum-link" href="' + escapeHTML(CONFIG.membershipPage) + '">Membership</a>' +
            '<a class="crum-button" href="' + escapeHTML(loginHref) + '">Sign In</a>' +
          '</div>' +
        '</div>';

      document.body.dataset.crowrulesAuthenticated = "false";
      document.body.dataset.crowrulesMembership = "";
      return;
    }

    const name = membershipName(membership);
    const status = membershipStatus(membership);
    const key = membershipKey(membership);
    const level = membership?.level != null ? "Level " + escapeHTML(membership.level) : "";
    const detail = [key ? key.toUpperCase() : "",level].filter(Boolean).join(" · ");
    const userName =
      sessionUser?.user_metadata?.full_name ||
      sessionUser?.user_metadata?.name ||
      sessionUser?.email?.split("@")[0] ||
      "CrowRules Member";
    const userEmail = sessionUser?.email || "";

    bar.innerHTML =
      '<div class="crum-inner">' +
        '<div class="crum-brand">' +
          '<span class="crum-orb" aria-hidden="true">CR</span>' +
          '<span class="crum-brand-copy">' +
            '<strong>CROWRULES ACCOUNT</strong>' +
            '<small>ONE ACCOUNT ACROSS THE CROWRULES UNIVERSE</small>' +
          '</span>' +
        '</div>' +
        '<div class="crum-copy crum-signed-in">' +
          '<span class="crum-signed-label">SIGNED IN</span>' +
          '<span class="crum-account-name">' + escapeHTML(userName) + '</span>' +
          (userEmail ? '<span class="crum-account-email">' + escapeHTML(userEmail) + '</span>' : '') +
        '</div>' +
        '<div class="crum-membership">' +
          '<span class="crum-plan">' + escapeHTML(name) + '</span>' +
          '<span class="crum-status ' + statusClass(membership) + '">' +
            '<i></i>' + escapeHTML(status) +
          '</span>' +
        '</div>' +
        '<div class="crum-actions">' +
          '<a class="crum-link" href="' + escapeHTML(CONFIG.membershipPage) + '">Membership</a>' +
          '<a class="crum-button" href="' + escapeHTML(CONFIG.portalPage) + '">Creator Portal</a>' +
        '</div>' +
      '</div>';

    document.body.dataset.crowrulesAuthenticated = "true";
    document.body.dataset.crowrulesMembership = key;
  }

  async function refresh(){
    try{
      const payload = await getStatus();
      render(payload);
      return payload;
    }catch(error){
      console.warn("CrowRules universal membership:",error);
      render({ok:false,authenticated:false,membership:null,sites:[],entitlements:[]});
      return null;
    }
  }

  async function signOut(){
    const db = await init();
    return db.auth.signOut();
  }

  function bindAuth(){
    if(!client) return;
    client.auth.onAuthStateChange((event,session)=>{
      currentSession = session || null;
      setTimeout(()=>refresh(),0);
    });
  }

  async function boot(){
    await init();
    bindAuth();
    await refresh();
  }

  window.CrowRulesMembership = {
    init,
    status:getStatus,
    refresh,
    ensureCrow,
    getMembership,
    signOut,
    getCurrentMembership:()=>currentMembership,
    getCurrentSession:()=>currentSession
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",()=>boot(),{once:true});
  }else{
    boot();
  }
})();