(() => {
  'use strict';

  const root = document.getElementById('lsl-app');
  if (!root) return;

  const content = document.getElementById('content');
  const tickerTrack = document.getElementById('ticker-track');
  const todayChip = document.getElementById('today-chip');
  const clock = document.getElementById('clock-wib');
  const updateLabel = document.getElementById('update-label');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const toast = document.getElementById('toast');

  let activeSport = 'football';
  let activeFilter = 'all';
  let searchQuery = '';
  let matches = [];
  let controller = null;
  let pollTimer = null;
  let firstLoad = true;
  let lastScoreMap = new Map();
  let logoIndex = null;
  const LOGO_DB_BASE = 'https://linetogel88.github.io/bola_linetogel/';

  const countryCodes = {
    england:'gb-eng',spain:'es',italy:'it',germany:'de',france:'fr',portugal:'pt',netherlands:'nl',belgium:'be',brazil:'br',argentina:'ar',usa:'us','united states':'us',canada:'ca',mexico:'mx',japan:'jp','south korea':'kr',australia:'au','north america':'us',scotland:'gb-sct',wales:'gb-wls',turkey:'tr',turkiye:'tr',switzerland:'ch',austria:'at',denmark:'dk',norway:'no',sweden:'se',finland:'fi',poland:'pl',croatia:'hr',serbia:'rs',greece:'gr',romania:'ro',ukraine:'ua',russia:'ru','saudi arabia':'sa',qatar:'qa','united arab emirates':'ae',india:'in','new zealand':'nz','south africa':'za'
  };

  const fmtWibDate = new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
  const fmtWibTime = new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});

  function updateClock(){ clock.textContent = fmtWibTime.format(new Date()).replace(/\./g,':') + ' WIB'; }
  updateClock(); setInterval(updateClock,1000);


  function loadScript(url){return new Promise(resolve=>{const s=document.createElement('script');s.src=url;s.async=false;s.onload=()=>resolve(true);s.onerror=()=>resolve(false);document.head.appendChild(s);});}
  async function ensureLogoDb(){
    if(activeSport!=='football')return;
    if(window.LSLLogoLoaded)return;
    if(window.LSLLogoPromise)return window.LSLLogoPromise;
    window.LOGO_DB=window.LOGO_DB||{};
    window.LSLLogoPromise=(async()=>{
      for(let i=0;i<=9;i++)await loadScript(`${LOGO_DB_BASE}logo-db-${i}.js`);
      await loadScript(`${LOGO_DB_BASE}logo-db.js`);
      window.LSLLogoLoaded=true;logoIndex=null;
    })();
    return window.LSLLogoPromise;
  }
  function normalizeLogoName(v){return normalize(v).replace(/\b(fc|cf|sc|afc|club|fk|ac)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function buildLogoIndex(){
    if(logoIndex)return logoIndex;logoIndex={};const db=window.LOGO_DB||{};
    Object.keys(db).forEach(k=>{const u=safeUrl(db[k]);if(!u)return;const original=String(k).toLowerCase().trim(),norm=normalizeLogoName(k);if(original&&!logoIndex[original])logoIndex[original]=u;if(norm&&!logoIndex[norm])logoIndex[norm]=u;});return logoIndex;
  }
  function findDbLogo(name){if(activeSport!=='football')return'';const idx=buildLogoIndex();return idx[String(name||'').toLowerCase().trim()]||idx[normalizeLogoName(name)]||'';}

  function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function safeUrl(v){try{const u=new URL(String(v||''),location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function normalize(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
  function initials(name){const w=String(name||'?').trim().split(/\s+/).filter(Boolean);return (w.length>1?(w[0][0]+w[w.length-1][0]):(w[0]||'?').slice(0,2)).toUpperCase();}
  function scoreDisplay(m){return m.score && /\d/.test(String(m.score)) ? String(m.score) : (m.state==='upcoming' ? 'VS' : '—');}
  function matchKey(m){return normalize(m.home)+'|'+normalize(m.away);}

  function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),2800);}

  function logoHtml(name,url){const u=safeUrl(url)||findDbLogo(name);return u?`<div class="team-logo"><img src="${escapeHtml(u)}" alt="${escapeHtml(name)}" loading="lazy" onerror="this.parentNode.textContent='${escapeHtml(initials(name))}'"></div>`:`<div class="team-logo">${escapeHtml(initials(name))}</div>`;}
  function leagueVisual(m){const url=safeUrl(m.competition_logo||m.region_logo||'');if(url)return `<span class="league-visual"><img src="${escapeHtml(url)}" alt="" loading="lazy"></span>`;const code=countryCodes[normalize(m.region)]||(String(m.region_code||'').length===2?String(m.region_code).toLowerCase():'');return code?`<span class="league-visual"><img src="https://flagcdn.com/w40/${escapeHtml(code)}.png" alt=""></span>`:`<span class="league-visual">◉</span>`;}

  function filteredMatches(){
    return matches.filter(m=>{
      if(activeFilter==='live' && m.state!=='live') return false;
      if(!searchQuery) return true;
      return normalize([m.home,m.away,m.competition,m.region,m.round,m.status].filter(Boolean).join(' ')).includes(searchQuery);
    });
  }

  function render(){
    const visible=filteredMatches();
    if(!visible.length){
      content.innerHTML=`<div class="empty-state">${searchQuery?'Tidak ditemukan pertandingan yang cocok.':activeFilter==='live'?'Tidak ada pertandingan LIVE saat ini.':'Tidak ada pertandingan Today saat ini.'}</div>`;
      renderTicker();
      return;
    }

    const groups=new Map();
    for(const m of visible){
      const name=m.competition||m.region||'Kompetisi Lainnya';
      const key=name+'||'+(m.round||'');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(m);
    }

    const order=[...groups.entries()].sort((a,b)=>{
      const rank=x=>Math.max(...x.map(m=>m.state==='live'?3:m.state==='upcoming'?2:m.state==='final'?1:0));
      const d=rank(b[1])-rank(a[1]); if(d)return d;
      return Math.min(...a[1].map(m=>Number(m.start_ts)||9e12))-Math.min(...b[1].map(m=>Number(m.start_ts)||9e12));
    });

    content.innerHTML=order.map(([key,list])=>{
      list.sort((a,b)=>((b.state==='live')-(a.state==='live'))||((Number(a.start_ts)||9e12)-(Number(b.start_ts)||9e12)));
      const [name,round]=key.split('||'); const sample=list[0]||{};
      return `<section class="league-block">
        <header class="league-head">
          <div class="league-title">${leagueVisual(sample)}<div><div class="league-name">${escapeHtml(name)}</div><div class="league-meta">${escapeHtml([sample.region,round].filter(Boolean).join(' • '))}</div></div></div>
          <div class="league-count">${list.length} MATCH${list.length>1?'ES':''}</div>
        </header>
        <div class="match-grid">${list.map(matchCard).join('')}</div>
      </section>`;
    }).join('');
    renderTicker();
  }

  function matchCard(m){
    const badgeClass=m.state==='live'?'live':m.state==='final'?'final':'';
    const status=m.state==='live'?(m.minute?`LIVE • ${m.minute}`:(m.status||'LIVE')):(m.status||'');
    return `<article class="match-card ${m.state==='live'?'live':''}">
      <div class="match-top"><span class="match-time">${escapeHtml(m.kickoff_wib?m.kickoff_wib+' WIB':'')}</span><span class="status-badge ${badgeClass}">${escapeHtml(status)}</span></div>
      <div class="match-body">
        <div class="team">${logoHtml(m.home,m.home_logo)}<div class="team-name">${escapeHtml(m.home||'-')}</div></div>
        <div class="score"><div class="score-main">${escapeHtml(scoreDisplay(m))}</div><div class="score-sub">${escapeHtml(m.state==='upcoming'?'UPCOMING':m.state==='final'?'FINAL':m.status||'')}</div></div>
        <div class="team">${logoHtml(m.away,m.away_logo)}<div class="team-name">${escapeHtml(m.away||'-')}</div></div>
      </div>
      <div class="match-footer">${escapeHtml([m.competition,m.round].filter(Boolean).join(' • '))}</div>
    </article>`;
  }

  function renderTicker(){
    const live=matches.filter(m=>m.state==='live').slice(0,6);
    const upcoming=matches.filter(m=>m.state==='upcoming').slice(0,5);
    const items=[];
    live.forEach(m=>items.push(`● LIVE ${m.home||'-'} ${scoreDisplay(m)} ${m.away||'-'}`));
    upcoming.forEach(m=>items.push(`${m.kickoff_wib?m.kickoff_wib+' WIB':'UPCOMING'} ${m.home||'-'} vs ${m.away||'-'}`));
    tickerTrack.textContent=(items.length?items:['LINETOGEL • Tidak ada pertandingan Today saat ini']).join('     ◆     ');
    tickerTrack.style.animation='none'; void tickerTrack.offsetWidth; tickerTrack.style.animation='';
  }

  function detectScoreChanges(incoming){
    const next=new Map();
    for(const m of incoming){
      const k=matchKey(m);next.set(k,String(m.score||''));
      if(!firstLoad && lastScoreMap.has(k) && lastScoreMap.get(k)!==String(m.score||'') && /\d/.test(String(m.score||''))){
        showToast(`Update skor: ${m.home} ${m.score} ${m.away}`);
      }
    }
    lastScoreMap=next;
  }

  async function loadScores({silent=false}={}){
    if(controller)controller.abort(); controller=new AbortController();
    if(!silent && firstLoad)content.innerHTML='<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
    try{
      const res=await fetch(`/api/scores?sport=${encodeURIComponent(activeSport)}`,{signal:controller.signal,headers:{'Accept':'application/json'}});
      const json=await res.json();
      if(!res.ok||!json.success)throw new Error(json.message||'Gagal mengambil live score.');
      const incoming=Array.isArray(json.data?.matches)?json.data.matches:[];
      detectScoreChanges(incoming); matches=incoming;
      todayChip.textContent=json.data?.today_label||fmtWibDate.format(new Date());
      updateLabel.textContent=`Update ${json.data?.updated_wib||'--:--:--'} WIB${json.data?.cached?' • cache':''}`;
      render(); firstLoad=false; schedulePoll();
      if(activeSport==='football'){ensureLogoDb().then(()=>{if(activeSport==='football')render();}).catch(()=>{});}
    }catch(err){
      if(err.name==='AbortError')return;
      if(firstLoad)content.innerHTML=`<div class="error-state"><strong>Live score belum dapat dimuat.</strong>${escapeHtml(err.message)}<br><button class="retry-btn" id="retry-btn">Coba lagi</button></div>`;
      const retry=document.getElementById('retry-btn');if(retry)retry.addEventListener('click',()=>loadScores());
      schedulePoll(60000);
    }
  }

  function schedulePoll(forced){
    clearTimeout(pollTimer); if(document.hidden)return;
    const hasLive=matches.some(m=>m.state==='live');
    const base=forced|| (hasLive?40000:75000); const jitter=Math.floor(Math.random()*12000);
    pollTimer=setTimeout(()=>loadScores({silent:true}),base+jitter);
  }

  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(pollTimer);if(controller)controller.abort();}else{loadScores({silent:true});}});

  document.querySelectorAll('.sport-tab').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.sport-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeSport=btn.dataset.sport;matches=[];firstLoad=true;searchQuery='';searchInput.value='';searchClear.classList.remove('show');loadScores();
  }));

  document.querySelectorAll('.filter-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;render();}));

  searchInput.addEventListener('input',()=>{searchQuery=normalize(searchInput.value);searchClear.classList.toggle('show',!!searchInput.value);render();});
  searchClear.addEventListener('click',()=>{searchInput.value='';searchQuery='';searchClear.classList.remove('show');searchInput.focus();render();});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==searchInput&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();searchInput.focus();}});

  todayChip.textContent=fmtWibDate.format(new Date());
  loadScores();
})();
