/* =========================================================
   CROWRULES DREAMSCAPES — GLOBAL NAVIGATION
   One navigation system shared by every HTML page.
   ========================================================= */
(function(){
  'use strict';

  const groups = [
    {label:'Explore',items:[
      ['Home','index.html'],['About','about.html'],['Creators','creators.html'],
      ['Projects','projects.html'],['Trending','trending.html'],['How It Works','how-it-works.html']
    ]},
    {label:'Create',items:[
      ['Submit a Dream','submit.html'],['Creator Portal','creator-portal.html'],
      ['My Dreams','my-dreams.html'],['Creative Room','creative-room.html']
    ]},
    {label:'Development',items:[
      ['Project Development','project-development.html'],['Collaborators','collaborators.html'],
      ['Join the Team','collaborators-join.html'],['Pitch Room','pitch-room.html'],
      ['Submission Status','submission-status.html']
    ]},
    {label:'Creator',items:[
      ['Dashboard','creator-dashboard.html'],['Profile','creator-profile.html'],
      ['Creator Rights','creator-rights.html'],['Agreements','agreements.html'],
      ['Credits','credits.html'],['Earnings','earnings.html'],['Messages','messages.html']
    ]},
    {label:'Account',items:[
      ['Login','login.html'],['Reset Password','reset-password.html'],
      ['Auth Callback','auth-callback.html']
    ]},
    {label:'Admin',items:[['Admin Dashboard','admin.html']]}
  ];

  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function link(label,href,extra){
    const active = href.toLowerCase() === path;
    return '<a class="'+(extra||'')+(active?' ds-active':'')+'" href="'+href+'"'+(active?' aria-current="page"':'')+'>'+label+'</a>';
  }

  function render(){
    const nav = document.createElement('nav');
    nav.className='ds-global-nav';
    nav.setAttribute('aria-label','Dreamscapes primary navigation');

    let html = '<div class="ds-nav-inner">';
    html += '<a class="ds-brand" href="index.html" aria-label="CrowRules Dreamscapes home">';
    html += '<span class="ds-brand-mark">CR</span><span class="ds-brand-copy"><span class="ds-brand-name">DREAMSCAPES</span><span class="ds-brand-sub">CrowRules Entertainment</span></span></a>';
    html += '<button class="ds-menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>';
    html += '<div class="ds-nav-links">';

    groups.forEach(group=>{
      html += '<div class="ds-nav-item">';
      html += '<button class="ds-nav-trigger" type="button" aria-expanded="false">'+group.label+'</button>';
      html += '<div class="ds-dropdown" role="menu">';
      group.items.forEach(item=>{html += link(item[0],item[1]);});
      html += '</div></div>';
    });

    html += link('Donate','donation-success.html','ds-nav-link ds-nav-support');
    html += '</div></div>';
    nav.innerHTML=html;

    const old = document.querySelector('nav, .site-nav, .nav, header.site-header');
    if(old) old.replaceWith(nav); else document.body.prepend(nav);

    const toggle=nav.querySelector('.ds-menu-toggle');
    const links=nav.querySelector('.ds-nav-links');
    toggle.addEventListener('click',()=>{
      const open=links.classList.toggle('ds-mobile-open');
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    });

    nav.querySelectorAll('.ds-nav-trigger').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const item=btn.parentElement;
        const wasOpen=item.classList.contains('ds-open');
        nav.querySelectorAll('.ds-nav-item.ds-open').forEach(x=>{
          x.classList.remove('ds-open');
          x.querySelector('.ds-nav-trigger')?.setAttribute('aria-expanded','false');
        });
        if(!wasOpen){
          item.classList.add('ds-open');
          btn.setAttribute('aria-expanded','true');
        }
      });
    });

    document.addEventListener('click',e=>{
      if(!nav.contains(e.target)) nav.querySelectorAll('.ds-nav-item.ds-open').forEach(x=>{
        x.classList.remove('ds-open');
        x.querySelector('.ds-nav-trigger')?.setAttribute('aria-expanded','false');
      });
    });

    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        nav.querySelectorAll('.ds-nav-item.ds-open').forEach(x=>x.classList.remove('ds-open'));
        links.classList.remove('ds-mobile-open');
        toggle.setAttribute('aria-expanded','false');
      }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',render); else render();
})();
