const SPORTS = new Set(['football','hockey','basketball','tennis','cricket']);
const DATASETS = {
  football: 'football',
  hockey: 'ice-hockey',
  basketball: 'basketball',
  tennis: 'tennis',
  cricket: 'cricket'
};

const CACHE_TTL_LIVE = 25;
const CACHE_TTL_IDLE = 60;
const STALE_TTL = 180;
const TZ = 'Asia/Jakarta';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return jsonResponse({success:true,service:'LIVE SCORE LINETOGEL',time:new Date().toISOString()},{'Cache-Control':'no-store'});
    }

    if (url.pathname === '/api/scores') {
      if (request.method !== 'GET') return jsonResponse({success:false,message:'Method tidak didukung.'},{},405);
      const sport = String(url.searchParams.get('sport') || 'football').toLowerCase();
      if (!SPORTS.has(sport)) return jsonResponse({success:false,message:'Cabang olahraga tidak valid.'},{},400);
      return handleScores(request, env, ctx, sport);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleScores(request, env, ctx, sport) {
  const cache = caches.default;
  const original = new URL(request.url);
  const cacheUrl = new URL(original.origin + '/__cache/scores/' + sport);
  const cacheKey = new Request(cacheUrl.toString(), {method:'GET'});

  const cached = await cache.match(cacheKey);
  if (cached) {
    const payload = await cached.clone().json().catch(() => null);
    if (payload?.data?.cached_at) {
      const age = Math.max(0, (Date.now() - payload.data.cached_at) / 1000);
      const freshFor = Number(payload.data.cache_ttl || CACHE_TTL_LIVE);
      if (age <= freshFor) {
        payload.data.cached = true;
        payload.data.cache_age = Math.floor(age);
        return jsonResponse(payload, publicHeaders(freshFor));
      }
      if (age <= STALE_TTL) {
        payload.data.cached = true;
        payload.data.stale = true;
        payload.data.cache_age = Math.floor(age);
        ctx.waitUntil(refreshSnapshot(cache, cacheKey, env, sport).catch(() => {}));
        return jsonResponse(payload, publicHeaders(10));
      }
    }
  }

  try {
    const payload = await buildSnapshot(env, sport);
    await putSnapshot(cache, cacheKey, payload);
    return jsonResponse(payload, publicHeaders(payload.data.cache_ttl));
  } catch (error) {
    if (cached) {
      const payload = await cached.clone().json().catch(() => null);
      if (payload) {
        payload.data = payload.data || {};
        payload.data.cached = true;
        payload.data.stale = true;
        payload.data.warning = 'Provider sementara tidak tersedia; menampilkan snapshot terakhir.';
        return jsonResponse(payload, publicHeaders(10));
      }
    }
    return jsonResponse({success:false,message:'Semua sumber data sedang tidak tersedia.',detail:String(error?.message||error)},{'Cache-Control':'no-store'},502);
  }
}

async function refreshSnapshot(cache, cacheKey, env, sport) {
  const payload = await buildSnapshot(env, sport);
  await putSnapshot(cache, cacheKey, payload);
}

async function putSnapshot(cache, cacheKey, payload) {
  const ttl = Math.max(15, Number(payload?.data?.cache_ttl || CACHE_TTL_LIVE));
  const response = jsonResponse(payload, {'Cache-Control':`public, max-age=${ttl}, stale-while-revalidate=${STALE_TTL}`});
  await cache.put(cacheKey, response);
}

async function buildSnapshot(env, sport) {
  const warnings = [];
  const sources = [];

  const tasks = [
    fetchSportingEvents(sport).then(v => sources.push(v)).catch(e => warnings.push('Sporting Events: '+e.message))
  ];

  if (sport === 'football' && env.FOOTBALL_DATA_KEY) {
    tasks.push(fetchFootballData(env.FOOTBALL_DATA_KEY).then(v => sources.push(v)).catch(e => warnings.push('football-data.org: '+e.message)));
  }

  if (sport === 'hockey') {
    tasks.push(fetchNhl().then(v => sources.push(v)).catch(e => warnings.push('NHL: '+e.message)));
  } else {
    tasks.push(fetchSportScore(sport).then(v => sources.push(v)).catch(e => warnings.push('SportScore: '+e.message)));
  }

  await Promise.all(tasks);
  if (!sources.length) throw new Error(warnings.join(' | ') || 'Tidak ada sumber yang berhasil.');

  let matches = mergeSources(sources);
  matches = matches.filter(m => m && m.home && m.away && (m.state === 'live' || (m.start_ts && isTodayWib(m.start_ts))));
  matches = matches.map(reconcileStatus).sort(sortMatches);

  const liveCount = matches.filter(m => m.state === 'live').length;
  const leagues = new Set(matches.map(m => String(m.competition || '').toLowerCase()).filter(Boolean));
  const now = new Date();
  const cacheTtl = liveCount ? CACHE_TTL_LIVE : CACHE_TTL_IDLE;

  return {
    success:true,
    data:{
      matches,
      live_count:liveCount,
      league_count:leagues.size,
      today_label:formatDateWib(now),
      updated_wib:formatTimeWib(now),
      partial:warnings.length>0,
      warnings,
      cached:false,
      cached_at:Date.now(),
      cache_ttl:cacheTtl
    }
  };
}

async function fetchSportingEvents(sport) {
  const dataset = DATASETS[sport];
  if (!dataset) return [];
  const json = await fetchJson(`https://sporting-events.org/data/${encodeURIComponent(dataset)}.json`);
  const events = Array.isArray(json.events) ? json.events : [];
  const out = [];

  for (const event of events) {
    const teams = sportingEventTeams(event);
    if (!teams.home || !teams.away) continue;
    const date = scalar(event.date_utc);
    const time = scalar(event.time_utc);
    if (!date || !time) continue;
    const ts = Date.parse(`${date}T${time.replace(/Z$/,'')}Z`);
    const start = Number.isFinite(ts) ? Math.floor(ts/1000) : 0;
    if (!start || !isTodayWib(start)) continue;
    const raw = String(event.status || 'scheduled').toLowerCase();
    let state = ['completed','finished','final'].includes(raw) ? 'final' : ['cancelled','canceled','postponed'].includes(raw) ? 'other' : 'upcoming';
    out.push({
      home:teams.home,away:teams.away,home_logo:'',away_logo:'',score:'- - -',
      status:scheduleStatus(raw),state,start_ts:start,kickoff_wib:formatTimeWib(start*1000),
      competition:extractCompetition(event),competition_logo:extractCompetitionLogo(event),
      region:scalar(event.country)||extractRegion(event),region_logo:extractRegionLogo(event),region_code:extractRegionCode(event),
      round:extractRound(event),provider:'Sporting Events',priority:30
    });
  }
  return out;
}

async function fetchSportScore(sport) {
  const endpoint = new URL('https://sportscore.com/api/widget/matches/');
  endpoint.searchParams.set('sport', sport);
  endpoint.searchParams.set('limit','50');
  endpoint.searchParams.set('src','livescore-linetogel');
  const json = await fetchJson(endpoint.toString());
  const rows = Array.isArray(json.matches) ? json.matches : [];
  const out=[];

  for (const m of rows) {
    const home=extractTeam(m,['home','home_team','homeTeam']);
    const away=extractTeam(m,['away','away_team','awayTeam']);
    if(!home||!away)continue;
    const start=extractTimestamp(m);
    const statusRaw=firstScalar(m,['status','match_status','matchStatus','state','period']);
    const state=classifyStatus(statusRaw,start);
    const statusText=firstScalar(m,['status_text','statusText','display_status','displayStatus']);
    const minute=extractLiveMinute(m,state,statusText);
    if(state!=='live' && (!start || !isTodayWib(start)))continue;
    out.push({
      home,away,home_logo:extractLogo(m,'home'),away_logo:extractLogo(m,'away'),score:extractScore(m),
      status:normalizeStatus(statusRaw,state),minute,state,start_ts:start,kickoff_wib:start?formatTimeWib(start*1000):'',
      competition:extractCompetition(m),competition_logo:extractCompetitionLogo(m),region:extractRegion(m),region_logo:extractRegionLogo(m),region_code:extractRegionCode(m),round:extractRound(m),
      sportscore_id:firstScalar(m,['id','match_id','matchId','event_id','eventId']),sportscore_slug:firstScalar(m,['slug','match_slug','matchSlug']),provider:'SportScore',priority:100
    });
  }
  return out;
}

async function fetchFootballData(key) {
  const dates=wibUtcDateRange();
  const url=new URL('https://api.football-data.org/v4/matches');
  url.searchParams.set('dateFrom',dates.from);url.searchParams.set('dateTo',dates.to);
  const json=await fetchJson(url.toString(),{'X-Auth-Token':key});
  const rows=Array.isArray(json.matches)?json.matches:[];const out=[];
  for(const m of rows){
    const home=fdTeamName(m.homeTeam||{}),away=fdTeamName(m.awayTeam||{});if(!home||!away)continue;
    const start=parseTimestamp(m.utcDate);const raw=String(m.status||'').toUpperCase();const state=fdState(raw);
    if(state!=='live'&&(!start||!isTodayWib(start)))continue;
    out.push({home,away,home_logo:urlValue(m.homeTeam?.crest),away_logo:urlValue(m.awayTeam?.crest),score:fdScore(m),status:fdStatus(raw,m),minute:m.minute?`${m.minute}'`:'',state,start_ts:start,kickoff_wib:start?formatTimeWib(start*1000):'',competition:scalar(m.competition?.name),competition_logo:urlValue(m.competition?.emblem),region:scalar(m.area?.name),region_logo:urlValue(m.area?.flag),region_code:scalar(m.area?.code),round:m.matchday?`Round ${m.matchday}`:'',provider:'football-data.org',priority:80});
  }
  return out;
}

async function fetchNhl(){
  const json=await fetchJson('https://api-web.nhle.com/v1/score/now');
  const games=Array.isArray(json.games)?json.games:[];const out=[];
  for(const g of games){
    const homeData=g.homeTeam||{},awayData=g.awayTeam||{};const home=nhlTeamName(homeData),away=nhlTeamName(awayData);if(!home||!away)continue;
    const start=parseTimestamp(g.startTimeUTC);const raw=String(g.gameState||'').toUpperCase();const state=['LIVE','CRIT'].includes(raw)?'live':['FINAL','OFF'].includes(raw)?'final':'upcoming';
    if(state!=='live'&&(!start||!isTodayWib(start)))continue;
    out.push({home,away,home_logo:urlValue(homeData.logo),away_logo:urlValue(awayData.logo),score:`${safeScore(homeData.score)} - ${safeScore(awayData.score)}`,status:nhlStatus(g,state),state,start_ts:start,kickoff_wib:start?formatTimeWib(start*1000):'',competition:'NHL',region:'North America',round:'',provider:'NHL',priority:100});
  }
  return out;
}

async function fetchJson(url, headers={}){
  const res=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'LIVE-SCORE-LINETOGEL/Cloudflare',...headers}});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const text=await res.text();if(!text.trim())throw new Error('Respons kosong');
  try{return JSON.parse(text);}catch{throw new Error('JSON tidak valid');}
}

function sportingEventTeams(event){
  let home=scalar(event.home_team),away=scalar(event.away_team);if(home&&away)return{home,away};
  const fixture=scalar(event.fixture);if(fixture){const p=fixture.split(/\s+vs\.?\s+/i);if(p.length===2)return{home:p[0].trim(),away:p[1].trim()};}
  return{home:'',away:''};
}
function scheduleStatus(s){return ['completed','finished','final'].includes(s)?'Final':s==='postponed'?'Ditunda':['cancelled','canceled'].includes(s)?'Dibatalkan':'Belum Mulai';}
function fdTeamName(t){return scalar(t.name)||scalar(t.shortName)||scalar(t.tla);}
function fdState(s){if(['LIVE','IN_PLAY','PAUSED'].includes(s))return'live';if(s==='FINISHED')return'final';if(['SCHEDULED','TIMED'].includes(s))return'upcoming';return'other';}
function fdStatus(s,m){if(['LIVE','IN_PLAY'].includes(s))return Number.isFinite(Number(m.minute))?`${Math.abs(Number(m.minute))}'`:'Live';if(s==='PAUSED')return'Turun Minum';if(s==='FINISHED')return'Final';if(['SCHEDULED','TIMED'].includes(s))return'Belum Mulai';if(s==='POSTPONED')return'Ditunda';if(s==='SUSPENDED')return'Dihentikan';if(s==='CANCELLED')return'Dibatalkan';return s||'-';}
function fdScore(m){for(const set of ['fullTime','regularTime','halfTime']){const s=m.score?.[set];if(s&&('home'in s||'away'in s))return`${safeScore(s.home)} - ${safeScore(s.away)}`;}return'- - -';}
function nhlTeamName(t){return scalar(t.name?.default)||[scalar(t.placeName?.default),scalar(t.commonName?.default)].filter(Boolean).join(' ')||scalar(t.commonName?.default)||scalar(t.abbrev);}
function nhlStatus(g,state){if(state==='upcoming')return'Belum Mulai';if(state==='final')return'Final';if(g.clock?.inIntermission)return'Istirahat';const p=Number(g.periodDescriptor?.number)||0;let s=p?`Periode ${p}`:'Live';if(g.clock?.timeRemaining)s+=` • ${g.clock.timeRemaining}`;return s;}

function mergeSources(sources){
  const result=[];
  for(const source of sources){for(const incoming of Array.isArray(source)?source:[]){if(!incoming?.home||!incoming?.away)continue;const idx=findMatching(result,incoming);if(idx<0)result.push({...incoming});else result[idx]=mergeTwo(result[idx],incoming);}}
  return result.map(({priority,...m})=>m);
}
function findMatching(rows,incoming){return rows.findIndex(existing=>teamSimilar(existing.home,incoming.home)&&teamSimilar(existing.away,incoming.away)&&(!(existing.start_ts&&incoming.start_ts)||Math.abs(existing.start_ts-incoming.start_ts)<=8*3600));}
function mergeTwo(a,b){
  const rank={upcoming:10,other:20,live:30,final:40};const ar=rank[a.state]||20,br=rank[b.state]||20,ap=Number(a.priority)||0,bp=Number(b.priority)||0;const bWins=br>ar||(br===ar&&bp>ap);
  const out={...a};if(bWins){out.state=b.state;out.status=b.status;if(b.minute)out.minute=b.minute;out.provider=b.provider;out.priority=bp;}
  if(hasRealScore(b.score)&&(br>=ar||bp>ap))out.score=b.score;
  for(const f of ['home_logo','away_logo','competition','competition_logo','region','region_logo','region_code','round','minute','sportscore_id','sportscore_slug'])if(b[f]&&(!out[f]||bp>ap))out[f]=b[f];
  if(b.start_ts&&(!out.start_ts||bp>ap)){out.start_ts=b.start_ts;out.kickoff_wib=b.kickoff_wib;}
  return out;
}
function sortMatches(a,b){const rank=m=>m.state==='live'?0:m.state==='upcoming'?1:m.state==='final'?2:3;return rank(a)-rank(b)||(Number(a.start_ts)||9e12)-(Number(b.start_ts)||9e12)||String(a.competition||'').localeCompare(String(b.competition||''));}
function reconcileStatus(m){if(!m?.start_ts||m.state!=='upcoming')return m;const elapsed=Math.floor(Date.now()/1000)-Number(m.start_ts);return elapsed>600?{...m,state:'other',status:'Menunggu Update'}:m;}
function hasRealScore(s){return /\d/.test(String(s||''));}
function normalizeTeamName(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|sc|afc|club|fk|ac|bc|hc)\b/g,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function teamSimilar(a,b){a=normalizeTeamName(a);b=normalizeTeamName(b);if(!a||!b)return false;if(a===b)return true;if(Math.min(a.length,b.length)>=6&&(a.includes(b)||b.includes(a)))return true;const A=new Set(a.split(' ')),B=new Set(b.split(' '));let same=0;for(const x of A)if(B.has(x))same++;return same>=Math.min(2,Math.min(A.size,B.size));}

function firstScalar(o,keys){for(const k of keys){if(o&&Object.prototype.hasOwnProperty.call(o,k)&&['string','number','boolean'].includes(typeof o[k]))return String(o[k]).trim();}return'';}
function scalar(v){return ['string','number','boolean'].includes(typeof v)?String(v).trim():'';}
function safeScore(v){return v===null||v===undefined||v===''?'-':String(v);}
function urlValue(v){const s=scalar(v);return /^https?:\/\//i.test(s)?s:'';}
function extractTeam(o,keys){for(const k of keys){const v=o?.[k];if(['string','number'].includes(typeof v))return String(v).trim();if(v&&typeof v==='object'){for(const f of ['name','display_name','displayName','short_name','shortName','title'])if(scalar(v[f]))return scalar(v[f]);}}return'';}
function extractCompetition(o){for(const k of ['competition','league','tournament','competition_name','category']){const v=o?.[k];if(scalar(v))return scalar(v);if(v&&typeof v==='object')for(const f of ['name','title','displayName'])if(scalar(v[f]))return scalar(v[f]);}return'';}
function extractCompetitionLogo(o){for(const k of ['competition_logo','competitionLogo','league_logo','leagueLogo','tournament_logo','tournamentLogo','category_logo','categoryLogo'])if(urlValue(o?.[k]))return urlValue(o[k]);for(const p of ['competition','league','tournament','category']){const v=o?.[p];if(!v||typeof v!=='object')continue;for(const f of ['logo','image','icon','badge','crest','picture','photo'])if(urlValue(v[f]))return urlValue(v[f]);for(const n of ['logo','image','icon'])if(v[n]&&typeof v[n]==='object')for(const f of ['url','src','image','logo'])if(urlValue(v[n][f]))return urlValue(v[n][f]);}return'';}
function extractRegionLogo(o){for(const k of ['country_logo','countryLogo','region_logo','regionLogo','flag','flag_url','flagUrl'])if(urlValue(o?.[k]))return urlValue(o[k]);for(const p of ['country','region','area']){const v=o?.[p];if(!v||typeof v!=='object')continue;for(const f of ['flag','logo','image','icon','badge'])if(urlValue(v[f]))return urlValue(v[f]);}for(const p of ['competition','league','tournament','category'])if(o?.[p]&&typeof o[p]==='object'){const x=extractRegionLogo(o[p]);if(x)return x;}return'';}
function extractRegionCode(o){for(const k of ['country_code','countryCode','region_code','regionCode','country_iso','countryIso','iso2']){const v=scalar(o?.[k]).toUpperCase();if(/^[A-Z]{2}$/.test(v))return v;}for(const p of ['country','region','area']){const v=o?.[p];if(!v||typeof v!=='object')continue;for(const f of ['code','iso2','alpha2','country_code','countryCode']){const x=scalar(v[f]).toUpperCase();if(/^[A-Z]{2}$/.test(x))return x;}}for(const p of ['competition','league','tournament','category'])if(o?.[p]&&typeof o[p]==='object'){const x=extractRegionCode(o[p]);if(x)return x;}return'';}
function extractRegion(o){for(const k of ['country','region','area','country_name','countryName']){const v=o?.[k];if(scalar(v))return scalar(v);if(v&&typeof v==='object')for(const f of ['name','title','displayName','country'])if(scalar(v[f]))return scalar(v[f]);}for(const p of ['competition','league','tournament','category'])if(o?.[p]&&typeof o[p]==='object'){const x=extractRegion(o[p]);if(x)return x;}return'';}
function extractRound(o){for(const k of ['round','round_name','roundName','matchday','match_day','matchDay','week','gameweek']){const v=o?.[k];if(Number.isFinite(Number(v))&&String(v)!=='')return`Round ${Math.abs(Number(v))}`;if(scalar(v)){const s=scalar(v);return /^(round|matchday|week)\b/i.test(s)?s:`Round ${s}`;}if(v&&typeof v==='object')for(const f of ['name','title','number','value'])if(scalar(v[f])){const s=scalar(v[f]);return /^\d+$/.test(s)?`Round ${s}`:/^(round|matchday|week)\b/i.test(s)?s:`Round ${s}`;}}for(const p of ['competition','league','tournament','category','season'])if(o?.[p]&&typeof o[p]==='object'){const x=extractRound(o[p]);if(x)return x;}return'';}
function extractLogo(o,side){for(const k of [`${side}_logo`,`${side}Logo`,`${side}_image`,`${side}Image`,`${side}_crest`,`${side}Crest`])if(urlValue(o?.[k]))return urlValue(o[k]);for(const n of [side,`${side}_team`,`${side}Team`]){const v=o?.[n];if(!v||typeof v!=='object')continue;for(const f of ['logo','image','crest','badge'])if(urlValue(v[f]))return urlValue(v[f]);}return'';}
function extractTimestamp(o){for(const f of ['time','start_time','startTime','start_timestamp','start_ts','timestamp','startTimeUTC','datetime','date_time']){if(o&&Object.prototype.hasOwnProperty.call(o,f)){const x=parseTimestamp(o[f]);if(x)return x;}}return 0;}
function parseTimestamp(v){if(!['string','number'].includes(typeof v))return 0;const s=String(v).trim();if(!s)return 0;if(/^\d+(\.\d+)?$/.test(s)){const n=Number(s);if(n>1e11)return Math.floor(n/1000);if(n>1e9)return Math.floor(n);}const ms=Date.parse(s);return Number.isFinite(ms)?Math.floor(ms/1000):0;}
function extractScore(m){const h=firstScalar(m,['home_score','homeScore','score_home','scoreHome']);const a=firstScalar(m,['away_score','awayScore','score_away','scoreAway']);if(h!==''||a!=='')return`${safeScore(h)} - ${safeScore(a)}`;if(scalar(m?.score))return scalar(m.score);if(m?.score&&typeof m.score==='object')return`${safeScore(m.score.home)} - ${safeScore(m.score.away)}`;return'- - -';}
function classifyStatus(status,ts){const s=String(status||'').trim().toLowerCase();for(const w of ['final','finished','completed','complete','full time','full-time','ft','ended','retired'])if(s===w||s.includes(w))return'final';for(const w of ['scheduled','not started','not_started','upcoming','pregame','pre-game','future'])if(s===w||s.includes(w))return'upcoming';for(const w of ['live','in progress','in_progress','inprogress','playing','halftime','half time','first half','second half','quarter','overtime','period','innings','inning','set ','q1','q2','q3','q4'])if(s===w||s.includes(w))return'live';if(/^\d{1,3}(?:\+\d{1,2})?['’]?$/.test(s))return'live';if(!s&&ts>Date.now()/1000)return'upcoming';return'other';}
function normalizeStatus(status,state){const raw=String(status||'').trim();const key=raw.toLowerCase().replace(/[ -]/g,'_');const map={ns:'Belum Mulai',scheduled:'Belum Mulai',not_started:'Belum Mulai',upcoming:'Belum Mulai',live:'Live',in_progress:'Live',inprogress:'Live','1h':'Babak 1',first_half:'Babak 1',ht:'Turun Minum',halftime:'Turun Minum',half_time:'Turun Minum','2h':'Babak 2',second_half:'Babak 2',q1:'Kuarter 1',q2:'Kuarter 2',q3:'Kuarter 3',q4:'Kuarter 4',ft:'Final',final:'Final',finished:'Final',completed:'Final',overtime:'Overtime',ot:'Overtime',postponed:'Ditunda',cancelled:'Dibatalkan',canceled:'Dibatalkan',suspended:'Dihentikan'};return map[key]||(state==='live'&&!raw?'Live':state==='upcoming'&&!raw?'Belum Mulai':state==='final'&&!raw?'Final':raw||'-');}
function extractLiveMinute(o,state,statusText=''){if(state!=='live'||!o||typeof o!=='object')return'';const c=[];if(scalar(statusText))c.push(scalar(statusText));for(const k of ['minute','minutes','match_minute','matchMinute','elapsed','elapsed_time','elapsedTime','live_minute','liveMinute','clock','timer','status_text','statusText'])if(scalar(o[k]))c.push(scalar(o[k]));for(const p of ['status','match_status','matchStatus','live','clock','timer','period']){const v=o[p];if(v&&typeof v==='object')for(const k of ['minute','minutes','elapsed','value','text','display','status_text','statusText'])if(scalar(v[k]))c.push(scalar(v[k]));}for(const x0 of c){const x=x0.trim();if(/^(HT|HALF[ -]?TIME)$/i.test(x))return'HT';let m=x.match(/^(\d{1,3}(?:\+\d{1,2})?)['’]?$/);if(m)return`${m[1]}'`;m=x.match(/^(?:MIN(?:UTE)?\.?\s*)?(\d{1,3}(?:\+\d{1,2})?)\s*(?:MIN(?:UTE)?S?)?['’]?$/i);if(m)return`${m[1]}'`;}return'';}

function isTodayWib(ts){return dateKeyWib(ts*1000)===dateKeyWib(Date.now());}
function dateKeyWib(ms){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return`${o.year}-${o.month}-${o.day}`;}
function formatDateWib(date){return new Intl.DateTimeFormat('id-ID',{timeZone:TZ,day:'numeric',month:'long',year:'numeric'}).format(date);}
function formatTimeWib(ms){return new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(ms));}
function wibUtcDateRange(){const now=new Date();const today=dateKeyWib(now);const start=new Date(today+'T00:00:00+07:00');const end=new Date(today+'T23:59:59+07:00');return{from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};}

function publicHeaders(ttl){return {'Cache-Control':`public, max-age=${Math.max(5,ttl)}, stale-while-revalidate=${STALE_TTL}`,'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};}
function jsonResponse(data,headers={},status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});}
