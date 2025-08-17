// /js/teams/index.js
(async () => {
  // Contenedor flexible: usa el primero que exista
  const container =
    document.getElementById('teamsIndex') ||
    document.getElementById('teamsContainer') ||
    document.querySelector('.teams-container');

  if (!container) return;

  // Detecta si venimos a detalle: /teams/?team=<id>
  const params = new URLSearchParams(location.search);
  const teamIdParam = params.get('team');
  const viewParam   = (params.get('view') || 'roster').toLowerCase();

  // --- Simple client-side router helpers ---
  function navigateToTeam(id, view = 'roster') {
    const url = `${location.pathname}?team=${id}&view=${view}`;
    history.pushState({ teamId: id, view }, '', url);
    renderTeamDetail(id, view);
  }
  function navigateToIndex() {
    history.pushState({}, '', location.pathname);
    renderTeamsIndex();
  } 

  // ------------- HELPERS -------------
  const DIVISION_MAP = {
    AFC: {
      East:  ['BUF', 'MIA', 'NE', 'NYJ'],
      North: ['BAL', 'CIN', 'CLE', 'PIT'],
      South: ['HOU', 'IND', 'JAX', 'TEN'],
      West:  ['DEN', 'KC', 'LV', 'LAC']
    },
    NFC: {
      East:  ['DAL', 'NYG', 'PHI', 'WSH', 'WAS'],
      North: ['CHI', 'DET', 'GB', 'MIN'],
      South: ['ATL', 'CAR', 'NO', 'TB', 'NOS'],
      West:  ['ARI', 'LAR', 'SEA', 'SF']
    }
  };

  const NORMALIZE_ABBR = (abbr) => {
    if (!abbr) return '';
    const a = abbr.toUpperCase();
    if (a === 'WAS') return 'WSH';
    if (a === 'NOS') return 'NO';
    if (a === 'OAK' || a === 'LVR') return 'LV';
    return a;
  };

  const findPlacement = (abbr) => {
    const A = NORMALIZE_ABBR(abbr);
    for (const conf of Object.keys(DIVISION_MAP)) {
      for (const div of Object.keys(DIVISION_MAP[conf])) {
        if (DIVISION_MAP[conf][div].includes(A)) return { conf, div };
      }
    }
    return { conf: 'Other', div: 'Misc' };
  };

  // Orden lógico de posiciones
  const POSITION_ORDER = [
    'QB','RB','FB','WR','TE',
    'LT','LG','C','RG','RT','OL','T','G',
    'EDGE','DE','DT','DL',
    'LB','ILB','OLB',
    'CB','S','FS','SS','DB',
    'K','P','LS','KR','PR'
  ];
  const POS_INDEX = (pos) => {
    const p = String(pos || '').toUpperCase();
    const ix = POSITION_ORDER.indexOf(p);
    return ix >= 0 ? ix : 999; // lo desconocido va al final
  };

  async function fetchAllTeams() {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
    const res = await fetch(url);
    const data = await res.json();
    const teams =
      data?.sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) ||
      data?.teams?.map(t => t.team || t) ||
      [];
    return teams;
  }

  async function fetchTeam(teamId) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}`;
    const res = await fetch(url);
    return res.json();
  }

  async function fetchRoster(teamId) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster?enable=roster,projection,stats`;
    const res = await fetch(url);
    return res.json();
  }

  // --- NEW: Fetch ESPN athlete overview endpoint for more stats ---
  async function fetchAthleteOverview(athId) {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athId}/overview`;
    const res = await fetch(url);
    return res.json();
  }

  // ---- Gamelog fetch: use HTTPS ----
  async function fetchAthleteGamelog(athId, season = new Date().getFullYear()) {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athId}/gamelog?season=${season}`;
    const res = await fetch(url);
    return res.json();
  }

  function extractPairsFromOverview(json) {
    // Tries several shapes from ESPN overview
    const out = [];
    const cats = json?.categories || json?.athlete?.categories || [];
    cats.forEach(cat => {
      const stats = cat?.stats || cat?.statistics || [];
      stats.forEach(s => {
        const label = (s.label || s.displayName || s.name || '').toString().trim();
        const value = (s.displayValue != null ? s.displayValue : (s.value != null ? s.value : ''));
        if (label) out.push([label, value]);
      });
    });
    return out;
  }

  // Build ESPN team UID used inside news categories
  function teamUid(teamId) {
    return `s:20~l:28~t:${teamId}`; // NFL = s:20, league 28
  }

  async function fetchSchedule(teamId, season = new Date().getFullYear()) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule?season=${season}`;
    const res = await fetch(url);
    return res.json();
  }

  async function fetchTeamNews(teamId) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news`;
    const res = await fetch(url);
    const data = await res.json();
    const headlines = data.headlines || [];
    const uid = teamUid(teamId);
    return headlines.filter((h) => {
      const cats = h.categories || [];
      return cats.some(c => (c.uid && c.uid.includes(uid)) || (c.teamId && String(c.teamId) === String(teamId)));
    });
  }

  // ---- RENDER HELPERS ----
  function renderTeamCardHeader(team) {
    const t = team.team || team;
    const name = t.displayName || t.name || '';
    const logo = t.logos?.[0]?.href || t.logo || '';
    const abbr = NORMALIZE_ABBR(t.abbreviation || '');
    const color = t.color ? `#${t.color}` : '#ff4655';
    const altColor = t.alternateColor ? `#${t.alternateColor}` : '#00ff88';

    return `
      <div class="team-detail-header" style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <img src="${logo}" alt="${name} logo" style="width:64px;height:64px;object-fit:contain;">
        <div>
          <div style="font-size:1.25rem;font-weight:700;line-height:1.1;">${name}</div>
          <div style="opacity:.8;font-size:.92rem;">${abbr}</div>
        </div>
      </div>
      <div style="height:4px;border-radius:4px;background:linear-gradient(90deg, ${color}, ${altColor});margin:-2px 0 8px 0;"></div>
    `;
  }

  // ---- ROSTER (ordenado por posición) ----
  function flattenRoster(roster) {
    const athletes = roster?.athletes || roster?.roster || [];
    const rows = [];
    athletes.forEach(group => {
      if (group?.items?.length) {
        group.items.forEach(a => rows.push(a));
      } else {
        rows.push(group);
      }
    });
    return rows;
  }

  function renderRosterTable(roster) {
    const rows = flattenRoster(roster);
    if (!rows.length) return '<div style="opacity:.8">No roster available.</div>';

    rows.sort((a, b) => {
      const pa = POS_INDEX(a?.position?.abbreviation || a?.position);
      const pb = POS_INDEX(b?.position?.abbreviation || b?.position);
      if (pa !== pb) return pa - pb;
      const na = (a?.displayName || a?.fullName || a?.name || '').toLowerCase();
      const nb = (b?.displayName || b?.fullName || b?.name || '').toLowerCase();
      return na.localeCompare(nb);
    });

    return `
      <div class="roster-table" style="overflow:auto;border-radius:12px;border:1px solid #2a2e36;background:#14171f;">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead>
            <tr style="text-align:left;background:#1b1f29;">
              <th style="padding:10px 12px;font-weight:600;">Name</th>
              <th style="padding:10px 12px;font-weight:600;">Pos</th>
              <th style="padding:10px 12px;font-weight:600;">No.</th>
              <th style="padding:10px 12px;font-weight:600;">Height</th>
              <th style="padding:10px 12px;font-weight:600;">Weight</th>
              <th style="padding:10px 12px;font-weight:600;">Age</th>
              <th style="padding:10px 12px;font-weight:600;">College</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(a => {
              const p = a?.position?.abbreviation || a?.position || '';
              const num = a?.jersey || a?.jerseyNumber || '';
              const name = a?.displayName || a?.fullName || a?.name || '';
              const ht = a?.height || a?.heightDisplay || '';
              const wt = a?.weight || a?.weightDisplay || '';
              const age = a?.age ?? '';
              const college = a?.college?.abbreviation || a?.college?.name || '';
              return `
                <tr style="border-top:1px solid #232836;">
                  <td style="padding:10px 12px;">${name}</td>
                  <td style="padding:10px 12px;">${p}</td>
                  <td style="padding:10px 12px;">${num}</td>
                  <td style="padding:10px 12px;">${ht}</td>
                  <td style="padding:10px 12px;">${wt}</td>
                  <td style="padding:10px 12px;">${age}</td>
                  <td style="padding:10px 12px;">${college}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ---- SCHEDULE con filtro de temporada ----
  function getEventSeasonType(ev) {
    // 1=Pre, 2=Reg, 3=Post (int)
    return ev.seasonType ??
      ev?.competitions?.[0]?.season?.type ??
      ev?.competitions?.[0]?.seasonType ??
      ev?.season?.type ??
      0;
  }

  function renderScheduleTable(scheduleJson, seasonTypeFilter = 0) {
    let events = scheduleJson?.events || [];
    if (!events.length) {
      return '<div style="opacity:.8">No schedule available.</div>';
    }
    if (seasonTypeFilter) {
      events = events.filter(e => Number(getEventSeasonType(e)) === Number(seasonTypeFilter));
      if (!events.length) {
        return '<div style="opacity:.8">No games for the selected season type.</div>';
      }
    }

    const rows = events.map(ev => {
      const comp = ev.competitions?.[0] || {};
      const home = comp.competitors?.find(c => c.homeAway === 'home') || {};
      const away = comp.competitors?.find(c => c.homeAway === 'away') || {};
      const d = new Date(ev.date);
      const dateStr = d.toLocaleDateString('en-US', { month:'short', day:'numeric'});
      const timeStr = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit'});
      const venue = comp.venue?.fullName || 'TBD';
      const scoreHome = home.score ?? '';
      const scoreAway = away.score ?? '';
      const statusName = comp.status?.type?.name || '';
      const finalMark = statusName === 'STATUS_FINAL'
        ? `${away.team?.abbreviation || ''} ${scoreAway} – ${home.team?.abbreviation || ''} ${scoreHome}`
        : `${timeStr}`;
      return `
        <tr style="border-top:1px solid #232836;">
          <td style="padding:10px 12px;white-space:nowrap;">${dateStr}</td>
          <td style="padding:10px 12px;">${away.team?.displayName || ''}</td>
          <td style="padding:10px 12px;text-align:center;">@</td>
          <td style="padding:10px 12px;">${home.team?.displayName || ''}</td>
          <td style="padding:10px 12px;white-space:nowrap;">${finalMark}</td>
          <td style="padding:10px 12px;">${venue}</td>
        </tr>`;
    }).join('');

    return `
      <div style="overflow:auto;border-radius:12px;border:1px solid #2a2e36;background:#14171f;">
        <table style="width:100%;border-collapse:collapse;min-width:720px;">
          <thead>
            <tr style="text-align:left;background:#1b1f29;">
              <th style="padding:10px 12px;font-weight:600;">Date</th>
              <th style="padding:10px 12px;font-weight:600;">Away</th>
              <th></th>
              <th style="padding:10px 12px;font-weight:600;">Home</th>
              <th style="padding:10px 12px;font-weight:600;">Time / Final</th>
              <th style="padding:10px 12px;font-weight:600;">Venue</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderTeamNewsCards(items) {
    if (!items.length) return '<div style="opacity:.8">No team news right now.</div>';
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;"> 
        ${items.map(n => {
          const img = (n.images?.[0]?.url) || (n.video?.[0]?.posterImages?.default?.href) || '';
          const link = n.links?.web?.href || '#';
          const title = n.headline || n.title || '';
          const desc = n.description || '';
          return `
            <a href="${link}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">
              <div style="background:#12151d;border:1px solid #232836;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;height:100%;">
                ${img ? `<img src="${img}" alt="" style="width:100%;height:130px;object-fit:cover;">` : ''}
                <div style="padding:10px 12px;display:flex;flex-direction:column;gap:6px;">
                  <div style="font-weight:600;">${title}</div>
                  <div style="opacity:.85;font-size:.92rem;">${desc}</div>
                </div>
              </div>
            </a>`;
        }).join('')}
      </div>`;
  }

  // ---- STATS: team record + líderes a partir del roster ----
  function numFromDisplay(val) {
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    const n = String(val).replace(/,/g, '').match(/-?\d+(\.\d+)?/g);
    return n ? parseFloat(n[0]) : 0;
  }
  function fromStatList(statArr = [], ...labels) {
    // Busca por label que contenga cualquiera de los términos dados
    const Ls = labels.map(s => s.toLowerCase());
    const hit = statArr.find(s => Ls.some(k => (s?.label || '').toLowerCase().includes(k)));
    return hit?.displayValue ?? hit?.value ?? '-';
  }
  function leaderByLabel(players, includeLabels = []) {
    let best = null, bestVal = -Infinity;
    players.forEach(p => {
      const stats = p?.stats || p?.statistics || p?.athlete?.statistics || p?.athlete?.stats || [];
      const val = numFromDisplay(fromStatList(stats, ...includeLabels));
      if (val > bestVal) { bestVal = val; best = { player: p, val }; }
    });
    return best && bestVal > -Infinity ? best : null;
  }
  function renderLeadersGrid(roster) {
    const rows = flattenRoster(roster);
    if (!rows.length) return '';

    const pass = leaderByLabel(rows, ['passing yards', 'pass yds', 'pass yards']);
    const rush = leaderByLabel(rows, ['rushing yards', 'rush yds', 'rush yards']);
    const recv = leaderByLabel(rows, ['receiving yards', 'rec yds', 'rec yards']);
    const sacks = leaderByLabel(rows, ['sacks']);
    const ints  = leaderByLabel(rows, ['interceptions']);

    function card(label, leader, extra = '') {
      if (!leader) {
        return `
          <div style="background:#12151d;border:1px solid #232836;border-radius:12px;padding:12px;">
            <div style="opacity:.75;font-size:.9rem;">${label}</div>
            <div style="font-size:1.1rem;margin-top:6px;">-</div>
          </div>`;
      }
      const a = leader.player;
      const name = a.displayName || a.fullName || a.name || '—';
      const pos = a?.position?.abbreviation || a?.position || '';
      const val = leader.val;
      return `
        <div style="background:#12151d;border:1px solid #232836;border-radius:12px;padding:12px;">
          <div style="opacity:.75;font-size:.9rem;">${label}</div>
          <div style="font-size:1.1rem;font-weight:600;margin-top:6px;">${name} <span style="opacity:.7;font-weight:500;">${pos ? '· ' + pos : ''}</span></div>
          <div style="font-size:1.35rem;font-weight:700;margin-top:2px;">${val}</div>
          ${extra || ''}
        </div>`;
    }

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px;">
        ${card('Passing Yards', pass)}
        ${card('Rushing Yards', rush)}
        ${card('Receiving Yards', recv)}
        ${card('Sacks', sacks)}
        ${card('Interceptions', ints)}
      </div>`;
  }

  // ------------- DETALLE -------------
  async function renderTeamDetail(teamId, currentView = (new URLSearchParams(location.search).get('view') || 'roster')) {
    container.innerHTML = `<div class="panel-skel">Loading team…</div>`;

    try {
      const teamData = await fetchTeam(teamId);

      // Header HTML (logo + name)
      const headerHTML = renderTeamCardHeader(teamData);

      // Shell with tabs and lazy content slots
      container.innerHTML = `
        <div class="team-detail" style="max-width:1080px;margin:0 auto;padding:0 12px 32px 12px;">
          <button id="backToTeams" style="margin:10px 0 14px 0;background:transparent;border:1px solid #2a2e36;color:#cfd6e6;padding:6px 10px;border-radius:10px;cursor:pointer;">← Back to teams</button>
          ${headerHTML}

          <nav class="team-tabs" style="display:flex;gap:8px;margin:8px 0 14px 0;">
            <a class="t-link" data-tab="roster"   href="?team=${teamId}&view=roster">Roster</a>
            <a class="t-link" data-tab="schedule" href="?team=${teamId}&view=schedule">Schedule</a>
            <a class="t-link" data-tab="stats"    href="?team=${teamId}&view=stats">Stats</a>
            <a class="t-link" data-tab="news"     href="?team=${teamId}&view=news">News</a>
            <a class="t-link" data-tab="injuries" href="?team=${teamId}&view=injuries">Injuries</a>
            <a class="t-link" data-tab="depth"    href="?team=${teamId}&view=depth">Depth</a>
          </nav>

          <div id="tabContent" style="min-height:160px;"></div>
        </div>
      `;

      // Back button
      const backBtn = document.getElementById('backToTeams');
      if (backBtn) backBtn.addEventListener('click', (e) => { e.preventDefault(); navigateToIndex(); });

      const tabContent = document.getElementById('tabContent');
      const links = Array.from(container.querySelectorAll('.t-link'));
      // Lazy caches
      const cache = {
        roster: null,
        schedule: { html: null, raw: null },
        stats: null,
        news: null,
      };

      async function showRoster() {
        if (!cache.roster) {
          const rosterData = await fetchRoster(teamId);
          cache.roster = renderRosterTable(rosterData);
        }
        tabContent.innerHTML = `
          <h3 style="margin:14px 0 10px 0;font-size:1.1rem;opacity:.9;">Roster</h3>
          ${cache.roster}
        `;
      }

      function scheduleToolbar() {
        return `
          <div style="display:flex;gap:8px;align-items:center;margin:6px 0 12px 0;">
            <label for="schFilter" style="opacity:.85;font-size:.92rem;">Season:</label>
            <select id="schFilter" style="background:#12151d;border:1px solid #2a2e36;color:#cfd6e6;border-radius:8px;padding:6px 8px;">
              <option value="0">All</option>
              <option value="1">Preseason</option>
              <option value="2" selected>Regular</option>
              <option value="3">Postseason</option>
            </select>
          </div>`;
      }

      async function showSchedule() {
        if (!cache.schedule.raw) {
          const scheduleData = await fetchSchedule(teamId);
          cache.schedule.raw = scheduleData;
        }
        // default Regular (2) si hay, si no All
        const defaultType = (cache.schedule.raw?.events || []).some(e => Number(getEventSeasonType(e)) === 2) ? 2 : 0;
        const html = renderScheduleTable(cache.schedule.raw, defaultType);
        cache.schedule.html = html;

        tabContent.innerHTML = `
          <h3 style="margin:14px 0 10px 0;font-size:1.1rem;opacity:.9;">Schedule</h3>
          ${scheduleToolbar()}
          <div id="schWrap">${html}</div>
        `;

        const sel = tabContent.querySelector('#schFilter');
        if (sel) {
          sel.value = String(defaultType);
          sel.addEventListener('change', () => {
            const filtered = renderScheduleTable(cache.schedule.raw, Number(sel.value));
            tabContent.querySelector('#schWrap').innerHTML = filtered;
          });
        }
      }

      async function showStats() {
        if (!cache.stats) {
          // --- Position groups and stat schemas (hoisted so we can use during gamelog enrichment) ---
          const POS_GROUP = (p) => {
            const x = String(p || '').toUpperCase();
            if (['LT','LG','C','RG','RT','OL','T','G'].includes(x)) return 'OL';
            if (['DE','DT','DL','EDGE'].includes(x)) return 'DL';
            if (['LB','ILB','OLB'].includes(x)) return 'LB';
            if (['CB','S','FS','SS','DB'].includes(x)) return 'DB';
            if (['K'].includes(x)) return 'K';
            if (['P'].includes(x)) return 'P';
            if (['QB','RB','FB','WR','TE'].includes(x)) return x;
            return 'OTH';
          };

          const SCHEMAS = {
            QB: [
              { title: 'CMP',  labels: ['Completions','Cmp'] },
              { title: 'ATT',  labels: ['Attempts','Att','Pass Att'] },
              { title: 'YDS',  labels: ['Passing Yards','Pass Yds','Pass Yards','Yds'] },
              { title: 'TD',   labels: ['Passing Touchdowns','Pass TD','TD'] },
              { title: 'INT',  labels: ['Interceptions','INT'] },
              { title: 'RATE', labels: ['QBR','Rating','Passer Rating'] }
            ],
            RB: [
              { title: 'ATT',  labels: ['Rushing Attempts','Rush Att','Att'] },
              { title: 'YDS',  labels: ['Rushing Yards','Rush Yds','Yds'] },
              { title: 'TD',   labels: ['Rushing Touchdowns','Rush TD','TD'] },
              { title: 'REC',  labels: ['Receptions','Rec'] },
              { title: 'REC YDS', labels: ['Receiving Yards','Rec Yds'] },
              { title: 'FUM',  labels: ['Fumbles','FUM'] }
            ],
            FB: [
              { title: 'ATT',  labels: ['Rushing Attempts','Rush Att','Att'] },
              { title: 'YDS',  labels: ['Rushing Yards','Rush Yds','Yds'] },
              { title: 'TD',   labels: ['Rushing Touchdowns','Rush TD','TD'] },
              { title: 'REC',  labels: ['Receptions','Rec'] },
              { title: 'REC YDS', labels: ['Receiving Yards','Rec Yds'] }
            ],
            WR: [
              { title: 'REC',  labels: ['Receptions','Rec'] },
              { title: 'TGT',  labels: ['Targets','Tgt'] },
              { title: 'YDS',  labels: ['Receiving Yards','Rec Yds','Yds'] },
              { title: 'TD',   labels: ['Receiving Touchdowns','Rec TD','TD'] },
              { title: 'Y/R',  labels: ['Yards per reception','Y/R','Avg/Rec'] }
            ],
            TE: [
              { title: 'REC',  labels: ['Receptions','Rec'] },
              { title: 'TGT',  labels: ['Targets','Tgt'] },
              { title: 'YDS',  labels: ['Receiving Yards','Rec Yds','Yds'] },
              { title: 'TD',   labels: ['Receiving Touchdowns','Rec TD','TD'] },
              { title: 'Y/R',  labels: ['Yards per reception','Y/R','Avg/Rec'] }
            ],
            OL: [
              { title: 'GP', labels: ['Games Played','GP','Games'] },
              { title: 'GS', labels: ['Games Started','GS','Starts'] }
            ],
            DL: [
              { title: 'TKL', labels: ['Total Tackles','Tackles','Comb'] },
              { title: 'SACK', labels: ['Sacks','Sck'] },
              { title: 'TFL', labels: ['Tackles for loss','TFL'] },
              { title: 'FF', labels: ['Forced Fumbles','FF'] },
              { title: 'FR', labels: ['Fumbles Recovered','FR'] }
            ],
            LB: [
              { title: 'TKL', labels: ['Total Tackles','Tackles','Comb'] },
              { title: 'SACK', labels: ['Sacks','Sck'] },
              { title: 'TFL', labels: ['Tackles for loss','TFL'] },
              { title: 'INT', labels: ['Interceptions','INT'] },
              { title: 'PD', labels: ['Passes Defended','PD'] }
            ],
            DB: [
              { title: 'TKL', labels: ['Total Tackles','Tackles','Comb'] },
              { title: 'INT', labels: ['Interceptions','INT'] },
              { title: 'PD',  labels: ['Passes Defended','PD'] },
              { title: 'TD',  labels: ['Defensive Touchdowns','TD'] }
            ],
            K: [
              { title: 'FGM', labels: ['Field Goals Made','FG Made','FGM'] },
              { title: 'FGA', labels: ['Field Goals Attempted','FG Att','FGA'] },
              { title: 'LONG', labels: ['Field Goal Long','Long'] },
              { title: 'XPM', labels: ['XP Made','XPM'] },
              { title: 'XPA', labels: ['XP Attempted','XPA'] }
            ],
            P: [
              { title: 'PUNTS', labels: ['Punts'] },
              { title: 'YDS', labels: ['Punt Yards','Yds'] },
              { title: 'AVG', labels: ['Punt Average','Avg'] },
              { title: 'LONG', labels: ['Punt Long','Long'] },
              { title: 'IN20', labels: ['Inside 20','In 20'] }
            ],
            OTH: [
              { title: 'GP', labels: ['Games Played','GP','Games'] },
              { title: 'GS', labels: ['Games Started','GS','Starts'] }
            ]
          };
          // 1) Team record (small header)
          const recs = teamData?.team?.record?.items || teamData?.record?.items || [];
          const overall = recs.find(r => (r.type || r.name || '').toLowerCase().includes('overall')) || recs[0];
          const overallText = overall?.summary || '-';

          // 2) Fetch roster to derive player stats by position
          const rosterData = await fetchRoster(teamId);
          const athletesGroups = rosterData?.athletes || rosterData?.roster || [];

          // Flatten roster into a single list of athlete objects
          const athleteRows = [];
          athletesGroups.forEach(group => {
            if (group?.items?.length) {
              group.items.forEach(a => athleteRows.push(a));
            } else if (group) {
              athleteRows.push(group);
            }
          });

          // Build: pos -> { labelSet:Set, players:[{id, name, number, pos, stats:Map<label,value>}] }
          const positions = new Map();
          function upsertPosition(posKey) {
            const k = String(posKey || 'OTH').toUpperCase();
            if (!positions.has(k)) positions.set(k, { labelSet: new Set(), players: [] });
            return positions.get(k);
          }

          // Try to normalize any stat entry into [label,value]
          function extractLabelValueArray(statsLike) {
            // supports arrays like [{label,displayValue},{name,value}], or a.stats where it's already pairs
            const out = [];
            if (!statsLike) return out;
            (Array.isArray(statsLike) ? statsLike : []).forEach(s => {
              if (!s) return;
              const label = (s.label || s.name || '').toString().trim();
              const value = (s.displayValue != null ? s.displayValue : (s.value != null ? s.value : ''));
              if (label) out.push([label, value]);
            });
            return out;
          }

          // First pass: collect any stats available directly on the roster items
          const pendingOverview = []; // to enrich players without stats

          athleteRows.forEach(a => {
            const pos = (a?.position?.abbreviation || a?.position || 'OTH').toString().toUpperCase();
            const bucket = upsertPosition(pos);

            const name = a?.displayName || a?.fullName || a?.name || '—';
            const number = a?.jersey || a?.jerseyNumber || '';
            const id = a?.id || a?.athlete?.id;

            const pairs = [
              ...extractLabelValueArray(a?.stats),
              ...extractLabelValueArray(a?.statistics)
            ];

            const statMap = new Map();
            pairs.forEach(([lbl, val]) => {
              bucket.labelSet.add(lbl);
              if (!statMap.has(lbl) || String(statMap.get(lbl) || '') === '') statMap.set(lbl, val);
            });

            const playerObj = { id, name, number, pos, stats: statMap };
            bucket.players.push(playerObj);

            if ((!pairs || pairs.length === 0) && id) {
              pendingOverview.push(playerObj);
            }
          });

          // Limit to the first 40 to avoid hammering the API; throttle concurrency to 8
          const toEnrich = pendingOverview.slice(0, 40);
          const CHUNK = 8;
          for (let i = 0; i < toEnrich.length; i += CHUNK) {
            const chunk = toEnrich.slice(i, i + CHUNK);
            const jsons = await Promise.all(chunk.map(p => fetchAthleteOverview(p.id).catch(() => null)));
            jsons.forEach((j, idx) => {
              if (!j) return;
              const pairs = extractPairsFromOverview(j);
              if (!pairs.length) return;
              const playerObj = chunk[idx];
              const bucket = positions.get(playerObj.pos) || upsertPosition(playerObj.pos);
              pairs.forEach(([lbl, val]) => {
                bucket.labelSet.add(lbl);
                if (!playerObj.stats.has(lbl) || String(playerObj.stats.get(lbl) || '') === '') {
                  playerObj.stats.set(lbl, val);
                }
              });
            });
          }

          // Ordering for positions
          const POSITION_ORDER = [
            'QB','RB','FB','WR','TE',
            'LT','LG','C','RG','RT','OL','T','G',
            'EDGE','DE','DT','DL',
            'LB','ILB','OLB',
            'CB','S','FS','SS','DB',
            'K','P','LS','KR','PR','OTH'
          ];
          const posKeys = Array.from(positions.keys()).sort((a,b) => {
            const ia = POSITION_ORDER.indexOf(a); const ib = POSITION_ORDER.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
          });


          function schemaForPos(posKey) {
            const g = POS_GROUP(posKey);
            return SCHEMAS[g] || SCHEMAS.OTH;
          }

          function pickValue(statMap, labelList) {
            for (const l of labelList) {
              const direct = statMap.get(l);
              if (direct != null && String(direct) !== '') return direct;
              // try loose match: find first key that includes label (case-insensitive)
              const foundKey = Array.from(statMap.keys()).find(k => String(k).toLowerCase() === String(l).toLowerCase() || String(k).toLowerCase().includes(String(l).toLowerCase()));
              if (foundKey) {
                const v = statMap.get(foundKey);
                if (v != null && String(v) !== '') return v;
              }
            }
            return '';
          }

          function renderPosSection(posKey, data) {
            const schema = schemaForPos(posKey);
            const thead = `
              <thead>
                <tr style="text-align:left;background:#1b1f29;">
                  <th style="padding:10px 12px;font-weight:600;">Player</th>
                  <th style="padding:10px 12px;font-weight:600;">#</th>
                  ${schema.map(col => `<th style=\"padding:10px 12px;font-weight:600;white-space:nowrap;\">${col.title}</th>`).join('')}
                </tr>
              </thead>`;

            const rows = data.players
              .sort((a,b) => a.name.localeCompare(b.name))
              .map(p => {
                const cells = schema.map(col => `<td style=\"padding:10px 12px;white-space:nowrap;\">${pickValue(p.stats, col.labels)}</td>`).join('');
                return `
                  <tr style=\"border-top:1px solid #232836;\">\n              <td style=\"padding:10px 12px;\">${p.name}</td>\n              <td style=\"padding:10px 12px;\">${p.number || ''}</td>\n              ${cells}\n            </tr>`;
              }).join('');

            return `
              <section style=\"margin:14px 0 18px 0;\">\n          <h4 style=\"margin:0 0 8px 0;font-size:1rem;opacity:.9;\">${posKey} <span style=\"opacity:.65;font-weight:500;\">(${data.players.length})</span></h4>\n          <div style=\"overflow:auto;border-radius:12px;border:1px solid #2a2e36;background:#14171f;\">\n            <table style=\"width:100%;border-collapse:collapse;min-width:720px;\">\n              ${thead}\n              <tbody>${rows}</tbody>\n            </table>\n          </div>\n        </section>`;
          }

          const sectionsHTML = posKeys.map(k => renderPosSection(k, positions.get(k))).join('');

          cache.stats = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:12px;">
              <div style="background:#12151d;border:1px solid #232836;border-radius:12px;padding:12px;">
                <div style="opacity:.75;font-size:.9rem;">Record (Overall)</div>
                <div style="font-size:1.25rem;font-weight:700;margin-top:4px;">${overallText}</div>
              </div>
            </div>
            ${sectionsHTML || '<div style="opacity:.8">No player stats available.</div>'}
          `;
        }

        tabContent.innerHTML = `
          <h3 style="margin:14px 0 10px 0;font-size:1.1rem;opacity:.9;">Team & Player Stats</h3>
          ${cache.stats}
        `;
      }

      async function showInjuries() {
        // opcional, luego lo llenamos
        const html = `<div style="opacity:.85">Injuries (coming soon)</div>`;
        tabContent.innerHTML = `<h3>Injuries</h3>${html}`;
      }

      async function showDepth() {
        const html = `<div style="opacity:.85">Depth chart (coming soon)</div>`;
        tabContent.innerHTML = `<h3>Depth Chart</h3>${html}`;
      }

      async function showNews() {
        if (!cache.news) {
          const items = await fetchTeamNews(teamId);
          cache.news = renderTeamNewsCards(items);
        }
        tabContent.innerHTML = `
          <h3 style="margin:14px 0 10px 0;font-size:1.1rem;opacity:.9;">News</h3>
          ${cache.news}
        `;
      }

      function setActive(tabName) {
        links.forEach(a => a.classList.toggle('active', a.dataset.tab === tabName));
      }

      // Wire clicks
      links.forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = a.dataset.tab;
          navigateToTeam(teamId, tab);
        });
      });

      // Default tab
      const show = {
        roster: showRoster,
        schedule: showSchedule,
        stats: showStats,
        news: showNews,
        injuries: showInjuries,
        depth: showDepth,
      }[String(currentView).toLowerCase()] || showRoster;

      setActive(String(currentView).toLowerCase());
      await show();

    } catch (e) {
      container.innerHTML = `<div class="panel-skel">Failed to load team.</div>`;
    }
  }

  // ------------- LISTA DE EQUIPOS -------------
  async function renderTeamsIndex() {
    container.innerHTML = `<div class="panel-skel">Loading teams…</div>`;

    try {
      const teams = await fetchAllTeams();

      const buckets = {
        AFC: { East: [], North: [], South: [], West: [] },
        NFC: { East: [], North: [], South: [], West: [] },
        Other: { Misc: [] }
      };

      teams.forEach(t => {
        const abbr = t.abbreviation || '';
        const { conf, div } = findPlacement(abbr);
        buckets[conf][div].push(t);
      });

      for (const conf of Object.keys(buckets)) {
        for (const div of Object.keys(buckets[conf])) {
          buckets[conf][div].sort((a, b) =>
            (a.displayName || '').localeCompare(b.displayName || '')
          );
        }
      }

      container.innerHTML = `
        ${['AFC','NFC','Other'].map(conf => {
          const divs = Object.keys(buckets[conf]).filter(d => buckets[conf][d].length);
          if (!divs.length) return '';
          return `
            <section class="division-card" style="margin-bottom:1rem;">
              <div class="division-title" style="margin-bottom:.4rem;">${conf}</div>
              ${divs.map(div => `
                <div class="division-title" style="font-size:.95rem;opacity:.85;margin:.4rem 0 .3rem;">${conf} • ${div}</div>
                <div class="team-grid">
                  ${buckets[conf][div].map(team => renderTeamItem(team)).join('')}
                </div>
              `).join('')}
            </section>
          `;
        }).join('')}
      `;

      // Delegación: click en equipo -> detalle
      container.addEventListener('click', (e) => {
        const item = e.target.closest('.team-item[data-id]');
        if (!item) return;
        const id = item.getAttribute('data-id');
        if (id) {
          e.preventDefault();
          navigateToTeam(id);
        }
      });

    } catch (e) {
      container.innerHTML = `<div class="panel-skel">Error loading teams.</div>`;
    }
  }

  function renderTeamItem(team) {
    const id = team.id;
    const name = team.displayName || team.name || '';
    const abbr = NORMALIZE_ABBR(team.abbreviation || '');
    const logo = team.logos?.[0]?.href || team.logo || '';
    return `
      <div class="team-item" data-id="${id}" title="${name}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#12151d;border:1px solid #232836;cursor:pointer;">
        <img src="${logo}" alt="${name} logo" style="width:40px;height:40px;object-fit:contain;">
        <div>
          <div class="name" style="font-weight:600;">${name}</div>
          <div class="abbr" style="opacity:.8;font-size:.9rem;">${abbr}</div>
        </div>
      </div>
    `;
  }

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    const p = new URLSearchParams(location.search);
    const qId = p.get('team');
    const v  = (p.get('view') || 'roster').toLowerCase();
    if (qId) renderTeamDetail(qId, v);
    else     renderTeamsIndex();
  });

  // ------- Arranque: decide listado o detalle -------
  if (teamIdParam) {
    await renderTeamDetail(teamIdParam, viewParam);
  } else {
    await renderTeamsIndex();
  }
})();