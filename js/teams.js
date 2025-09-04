// /js/teams.js
(() => {
    let APP = document.getElementById('teamsApp');
    let TOOLBAR = document.getElementById('teamsToolbar');

    // Fallback conference/division map by team abbreviation (ESPN-style)
    const CONF_DIV_BY_ABBR = {
      ARI:{conf:'NFC',div:'West'}, ATL:{conf:'NFC',div:'South'}, BAL:{conf:'AFC',div:'North'}, BUF:{conf:'AFC',div:'East'},
      CAR:{conf:'NFC',div:'South'}, CHI:{conf:'NFC',div:'North'}, CIN:{conf:'AFC',div:'North'}, CLE:{conf:'AFC',div:'North'},
      DAL:{conf:'NFC',div:'East'}, DEN:{conf:'AFC',div:'West'}, DET:{conf:'NFC',div:'North'}, GB:{conf:'NFC',div:'North'},
      HOU:{conf:'AFC',div:'South'}, IND:{conf:'AFC',div:'South'}, JAX:{conf:'AFC',div:'South'}, KC:{conf:'AFC',div:'West'},
      LAC:{conf:'AFC',div:'West'}, LAR:{conf:'NFC',div:'West'}, LV:{conf:'AFC',div:'West'}, MIA:{conf:'AFC',div:'East'},
      MIN:{conf:'NFC',div:'North'}, NE:{conf:'AFC',div:'East'}, NO:{conf:'NFC',div:'South'}, NYG:{conf:'NFC',div:'East'},
      NYJ:{conf:'AFC',div:'East'}, PHI:{conf:'NFC',div:'East'}, PIT:{conf:'AFC',div:'North'}, SEA:{conf:'NFC',div:'West'},
      SF:{conf:'NFC',div:'West'}, TB:{conf:'NFC',div:'South'}, TEN:{conf:'AFC',div:'South'}, WSH:{conf:'NFC',div:'East'}, WAS:{conf:'NFC',div:'East'}
    };
  
    // Cache en memoria
    let TEAM_MAP = null;              // { "DET": {id, abbreviation, displayName, conference, division, logo}, ... }
    const rosterCache = new Map();    // key: teamId -> data
    const scheduleCache = new Map();  // key: teamId|season -> data
    const injuriesCache = new Map();  // key: teamId -> data
    const depthChartCache = new Map();  // key: teamId|season -> data
    const athleteOverviewCache = new Map();  // key: athleteId|year -> data
    const athleteGamelogCache = new Map();   // key: athleteId|year -> data

    // ===== Extra helpers =====
    function calcAge(isoDate) {
      try {
        const d = new Date(isoDate);
        if (isNaN(d)) return '';
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        return age;
      } catch { return ''; }
    }

    // --- helpers to use roster cache for athlete fallback ---
    function _flattenRosterFromCache(teamId) {
      const ro = rosterCache.get(String(teamId));
      if (!ro) return [];
      const raw = ro?.athletes || [];
      const out = [];
      if (raw.length && (raw[0]?.items || raw[0]?.athletes)) {
        raw.forEach(group => {
          const list = group?.items || group?.athletes || [];
          list.forEach(a => out.push(a));
        });
      } else {
        raw.forEach(a => out.push(a));
      }
      return out;
    }
    function _getCachedAthlete(teamId, athleteId) {
      const list = _flattenRosterFromCache(teamId);
      const aid = String(athleteId);
      return list.find(p => String(p?.id) === aid || String(p?.athlete?.id) === aid) || null;
    }

    // Master order for position sections & chips
    const POS_ORDER_MASTER = ['QB','RB','WR','TE','OL','DL','EDGE','DE','DT','LB','CB','S','K','P','LS','FB','KR','PR','OTH'];
  
    // Estado de UI
    let activeConf = 'AFC';           // default
    let currentTeamId = null;
    let currentTab = 'roster';
  
    // Utilidades
    const fetchJSON = async (url, opts = {}) => {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    };

    function getSelectedSeasonYear() {
      const sel = document.getElementById('seasonYearSelect');
      const y = sel ? Number(sel.value) : (new Date()).getFullYear();
      return Number.isFinite(y) ? y : (new Date()).getFullYear();
    }
  
    async function loadTeamMap() {
      if (TEAM_MAP) return TEAM_MAP;
      try {
        const res = await fetch('/data/teams/nfl_teams.json', { cache: 'force-cache' });
        if (!res.ok) throw new Error('nfl_teams.json not found');
        TEAM_MAP = await res.json();
      } catch (e) {
        console.error('Failed to load nfl_teams.json. Falling back to ESPN teams list.', e);
        TEAM_MAP = await fallbackTeamsFromESPN();
      }
      TEAM_MAP = normalizeTeamMap(TEAM_MAP || {});
      return TEAM_MAP;
    }
  
    async function fallbackTeamsFromESPN() {
      const map = {};
      try {
        const data = await fetchJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
        const teams = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => t.team);
        teams.forEach(t => {
          const abbr = String(t.abbreviation || '').toUpperCase();
          const cd = CONF_DIV_BY_ABBR[abbr] || { conf: 'OTHER', div: 'OTHER' };
          map[abbr] = {
            id: String(t.id),
            abbreviation: abbr,
            displayName: t.displayName,
            conference: normalizeConference(cd.conf),
            division: normalizeDivision(cd.div),
            logo: t.logos?.[0]?.href || t.logo || ''
          };
        });
      } catch (err) {
        console.error('Fallback ESPN teams failed:', err);
      }
      return map;
    }

    // Helper: resolve a team id from ESPN by abbreviation or name
    async function resolveTeamId(abbrOrName) {
      try {
        const data = await fetchJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
        const teams = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => t.team);
        const key = String(abbrOrName || '').toUpperCase();
        const found = teams.find(tt => String(tt.abbreviation || '').toUpperCase() === key) ||
                      teams.find(tt => String(tt.displayName || '').toUpperCase() === key) ||
                      null;
        return found ? String(found.id) : '';
      } catch (e) {
        console.error('resolveTeamId failed', e);
        return '';
      }
    }

    function normalizeTeamMap(mapIn) {
      const out = {};
      Object.values(mapIn).forEach(t => {
        const abbr = String(t.abbreviation || t.abbr || '').toUpperCase();
        const id = String(t.id || '');
        const cd = CONF_DIV_BY_ABBR[abbr] || { conf: t.conference, div: t.division };
        const conf = normalizeConference(cd?.conf || t.conference || '');
        const div  = normalizeDivision(cd?.div || t.division || '');
        out[abbr] = {
          id,
          abbreviation: abbr,
          displayName: t.displayName || t.name || abbr,
          conference: conf,
          division: div,
          logo: t.logo || (t.logos?.[0]?.href || '')
        };
      });
      return out;
    }
  
    function byDivisionOrder(a, b) {
      const order = { EAST: 0, NORTH: 1, SOUTH: 2, WEST: 3, OTHER: 9 };
      const da = order[(a || 'OTHER').toUpperCase()] ?? 9;
      const db = order[(b || 'OTHER').toUpperCase()] ?? 9;
      return da - db;
    }
  
    function byTeamName(a, b) {
      return a.displayName.localeCompare(b.displayName);
    }

    function normalizeConference(val) {
      const u = String(val || '').toUpperCase();
      if (u.includes('AFC')) return 'AFC';
      if (u.includes('NFC')) return 'NFC';
      if (u.includes('AMERICAN')) return 'AFC';
      if (u.includes('NATIONAL')) return 'NFC';
      return u || 'OTHER';
    }

    function normalizeDivision(val) {
      // Make it robust to values like "West", "AFC West", "western", etc.
      const u = String(val || '')
        .toUpperCase()
        .replace(/[^A-Z]/g, ''); // strip spaces and punctuation -> "AFCWEST"
      if (u.includes('EAST'))  return 'EAST';
      if (u.includes('NORTH')) return 'NORTH';
      if (u.includes('SOUTH')) return 'SOUTH';
      if (u.includes('WEST'))  return 'WEST';
      return 'OTHER';
    }
  
    function groupTeamsByConfAndDivision(conf) {
      const divisions = { EAST: [], NORTH: [], SOUTH: [], WEST: [], OTHER: [] };
      const items = Object.values(TEAM_MAP || {});
      const wantedConf = normalizeConference(conf);

      items.forEach(team => {
        const tConf = normalizeConference(team.conference);
        if (tConf === wantedConf) {
          const key = normalizeDivision(team.division);
          (divisions[key] || divisions.OTHER).push(team);
        }
      });

      Object.keys(divisions).forEach(k => divisions[k].sort(byTeamName));
      return divisions;
    }

    function ensureMounts() {
      if (!document.getElementById('teamsToolbar')) {
        const tb = document.createElement('div');
        tb.id = 'teamsToolbar';
        (document.getElementById('teamsPage') || document.body).prepend(tb);
      }
      if (!document.getElementById('teamsApp')) {
        const app = document.createElement('div');
        app.id = 'teamsApp';
        (document.getElementById('teamsPage') || document.body).appendChild(app);
      }
    }
  
    function renderToolbar() {
      TOOLBAR.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'teams-toolbar';
  
      const afcBtn = document.createElement('button');
      afcBtn.className = `conf-btn ${activeConf === 'AFC' ? 'active' : ''}`;
      afcBtn.textContent = 'AFC';
      afcBtn.addEventListener('click', () => {
        if (activeConf !== 'AFC') {
          activeConf = 'AFC';
          renderTeamsList();
          renderToolbar(); // refresca estado "active"
          pushListState();
        }
      });
  
      const nfcBtn = document.createElement('button');
      nfcBtn.className = `conf-btn ${activeConf === 'NFC' ? 'active' : ''}`;
      nfcBtn.textContent = 'NFC';
      nfcBtn.addEventListener('click', () => {
        if (activeConf !== 'NFC') {
          activeConf = 'NFC';
          renderTeamsList();
          renderToolbar();
          pushListState();
        }
      });
  
      wrapper.appendChild(afcBtn);
      wrapper.appendChild(nfcBtn);
      TOOLBAR.appendChild(wrapper);
    }
  
    function renderTeamsList() {
      APP.innerHTML = '';
      const container = document.createElement('div');
      container.className = 'teams-list';

      const divisions = groupTeamsByConfAndDivision(activeConf);
      const divisionOrder = Object.keys(divisions).sort(byDivisionOrder);

      const totalTeams = Object.values(divisions).reduce((n, arr) => n + arr.length, 0);
      if (totalTeams === 0) {
        APP.innerHTML = '<div class="muted">No teams to show. If you are running locally, ensure <code>/data/teams/nfl_teams.json</code> exists or your network allows calls to ESPN.</div>';
        return;
      }

      divisionOrder.forEach(divKey => {
        const teams = divisions[divKey];
        if (!teams.length) return;

        const card = document.createElement('div');
        card.className = 'teams-division-card';

        const title = document.createElement('h3');
        title.className = 'division-title';
        title.textContent = `${activeConf} ${divKey[0] + divKey.slice(1).toLowerCase()}`;
        card.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'division-grid';

        teams.forEach(t => {
          const item = document.createElement('button');
          item.className = 'team-item';
          item.setAttribute('data-team-id', t.id);
          item.innerHTML = `
            <img src="${t.logo || ''}" alt="${t.displayName}" class="team-logo-sm"/>
            <div class="team-item-text">
              <div class="abbr">${t.abbreviation || ''}</div>
              <div class="name">${t.displayName || ''}</div>
            </div>
          `;
          item.addEventListener('click', async () => {
            let tid = String(t.id || '').trim();
            if (!tid) {
              // Try to resolve from ESPN using abbreviation first
              tid = await resolveTeamId(t.abbreviation || t.displayName || '');
              if (tid) {
                // persist back into TEAM_MAP for future clicks
                const tm = TEAM_MAP[t.abbreviation];
                if (tm) tm.id = tid;
              }
            }
            if (!tid) {
              alert('Could not resolve team id for this team. Try again or check your teams JSON.');
              return;
            }
            openTeam(tid);
          });
          grid.appendChild(item);
        });

        card.appendChild(grid);
        container.appendChild(card);
      });

      APP.appendChild(container);
    }
  
    // ======= TEAM DETAIL (SPA) =======
    async function openTeam(teamId, tab = 'roster') {
      currentTeamId = String(teamId);
      currentTab = tab;
      if (!currentTeamId) {
        // Attempt to resolve using team selected in map by name/abbr
        const tmById = findTeamById(teamId);
        const guessKey = tmById?.abbreviation || tmById?.displayName || '';
        const resolved = await resolveTeamId(guessKey);
        if (resolved) {
          currentTeamId = resolved;
        } else {
          APP.innerHTML = '<div class="error">Team ID is missing and could not be resolved.</div>';
          return;
        }
      }
      const tm = findTeamById(currentTeamId);
  
      // Skeleton de la subvista (todo inyectado por JS)
      APP.innerHTML = `
        <div class="team-detail">
          <div class="team-detail-header">
            <button class="back-btn" id="backToTeams">← All Teams</button>
            <div class="team-head">
              <img id="teamLogo" class="team-logo-lg" alt="Team Logo"/>
              <div class="team-head-text">
                <h3 id="teamName" class="team-title">Loading…</h3>
                <div id="teamSub" class="team-sub"></div>
              </div>
            </div>
          </div>

          <div class="tabs" id="teamTabs">
            <button class="tab-btn" data-tab="roster">Roster</button>
            <button class="tab-btn" data-tab="schedule">Schedule</button>
            <button class="tab-btn" data-tab="injuries">Injuries</button>
            <button class="tab-btn" data-tab="depth">Depth Chart</button>
            <button class="tab-btn" data-tab="stats">Stats</button>
          </div>

          <div id="scheduleFilters" class="filters hidden">
            <select id="seasonTypeSelect" class="season-type-select" aria-label="Season type">
              <option value="1">Preseason</option>
              <option value="2" selected>Regular Season</option>
              <option value="3">Postseason</option>
            </select>
            <select id="seasonYearSelect" class="season-year-select" aria-label="Season year"></select>
          </div>

          <div class="team-panels">
            <div id="panel-roster" class="tab-panel"></div>
            <div id="panel-schedule" class="tab-panel hidden"></div>
            <div id="panel-injuries" class="tab-panel hidden"></div>
            <div id="panel-depth" class="tab-panel hidden"></div>
            <div id="panel-stats" class="tab-panel hidden"></div>
          </div>
        </div>
      `;
  
      // Back
      document.getElementById('backToTeams').addEventListener('click', () => {
        pushListState(); // url limpia sin team
        renderToolbar();
        renderTeamsList();
      });
  
      // Header info
      const logoEl = document.getElementById('teamLogo');
      const nameEl = document.getElementById('teamName');
      const subEl  = document.getElementById('teamSub');
  
      if (tm) {
        logoEl.src = tm.logo || '';
        logoEl.alt = tm.displayName || '';
        nameEl.textContent = tm.displayName || `Team ${currentTeamId}`;
        subEl.textContent = `${tm.conference || '-'} • ${tm.division || '-'} • ${tm.abbreviation || ''}`;
      } else {
        // fallback a la API para nombre/logo si no existe en el JSON local
        try {
          const teamData = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${currentTeamId}`);
          const t = teamData?.team;
          nameEl.textContent = t?.displayName || `Team ${currentTeamId}`;
          logoEl.src = t?.logos?.[0]?.href || t?.logo || '';
          subEl.textContent = `${t?.displayName || ''}`;
          if (t?.abbreviation) {
            const ab = String(t.abbreviation).toUpperCase();
            if (TEAM_MAP[ab]) TEAM_MAP[ab].id = String(t.id || currentTeamId);
          }
        } catch {
          nameEl.textContent = `Team ${currentTeamId}`;
          subEl.textContent = '';
        }
      }
  
      // Tabs
      const tabsEl = document.getElementById('teamTabs');
      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const tabName = btn.dataset.tab;
        switchTab(tabName);
        pushTeamState(tabName);
      });
  
      // Año: llena con rango razonable
      initSeasonYearSelect();
  
      // Ir a la pestaña inicial
      switchTab(currentTab);
  
      // URL estado
      pushTeamState(currentTab);
    }
  
    function switchTab(tabName) {
      currentTab = tabName;

      // Toggle botones
      const allBtns = document.querySelectorAll('#teamTabs .tab-btn');
      allBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));

      // Toggle paneles
      const panels = ['roster','schedule','injuries','depth','stats'];
      panels.forEach(p => {
        document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== tabName);
      });

      // Filtros schedule on/off
      document.getElementById('scheduleFilters').classList.toggle('hidden', !(tabName === 'schedule' || tabName === 'depth'));

      // Cargar datos
      if (tabName === 'roster') renderRoster(currentTeamId);
      if (tabName === 'schedule') renderSchedule(currentTeamId);
      if (tabName === 'injuries') renderInjuries(currentTeamId);
      if (tabName === 'depth') renderDepthChart(currentTeamId);
      if (tabName === 'stats') renderStats(currentTeamId);
    }
  
    function initSeasonYearSelect() {
      const yearSel = document.getElementById('seasonYearSelect');
      if (!yearSel) return;
      const now = new Date();
      const yyyy = now.getFullYear();
      const years = [yyyy + 1, yyyy, yyyy - 1, yyyy - 2];
      yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === yyyy ? 'selected':''}>${y}</option>`).join('');
      // listeners
      yearSel.addEventListener('change', () => {
        if (currentTab === 'schedule') renderSchedule(currentTeamId);
        if (currentTab === 'depth') renderDepthChart(currentTeamId);
      });
      const stSel = document.getElementById('seasonTypeSelect');
      stSel.addEventListener('change', () => {
        if (currentTab === 'schedule') renderSchedule(currentTeamId);
        if (currentTab === 'depth') renderDepthChart(currentTeamId);
      });
    }
    async function loadDepthChart(teamId, seasonYear) {
      const key = `${teamId}|${seasonYear}`;
      if (depthChartCache.has(key)) return depthChartCache.get(key);
      try {
        const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${seasonYear}/teams/${teamId}/depthcharts`;
        const data = await fetchJSON(url);
        depthChartCache.set(key, data);
        return data;
      } catch (err) {
        depthChartCache.set(key, null);
        throw err;
      }
    }
    async function renderDepthChart(teamId) {
      const panel = document.getElementById('panel-depth');
      panel.innerHTML = `<div class="loading">Loading depth chart…</div>`;

      const yearSel = document.getElementById('seasonYearSelect');
      const year = yearSel ? Number(yearSel.value) : (new Date()).getFullYear();

      try {
        const data = await loadDepthChart(teamId, year);
        // Core API depth chart returns a collection with `items` URLs; follow "items" if present
        const items = data?.items || data?.entries || [];
        if (!items.length) {
          panel.innerHTML = `<div class="muted">No depth chart available.</div>`;
          return;
        }

        // Attempt to expand entries if they are referenced by href; if CORS blocks, show raw list gracefully
        const table = document.createElement('div');
        table.className = 'depth-table';
        table.innerHTML = `
          <div class="row header">
            <span>Position</span><span>1st</span><span>2nd</span><span>3rd</span><span>4th</span>
          </div>
        `;

        const expandItem = async (href) => {
          try {
            const node = await fetchJSON(href);
            return node;
          } catch {
            return null;
          }
        };

        // Collect rows. Each item is a position group with slots
        const rows = [];
        for (const it of items) {
          const node = it?.$ref || it?.href ? await expandItem(it.$ref || it.href) : it;
          const pos = node?.position?.abbreviation || node?.position?.name || node?.position || '-';
          const slots = node?.athletes || node?.slots || [];
          const names = [];
          for (let i = 0; i < 4; i++) {
            const slot = slots[i];
            if (!slot) { names.push('-'); continue; }
            const a = slot?.athlete || slot?.player || slot;
            const nm = a?.displayName || a?.fullName || a?.name || '-';
            names.push(nm);
          }
          rows.push({ pos, names });
        }

        rows.forEach(r => {
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `
            <span>${r.pos}</span>
            <span>${r.names[0] ?? '-'}</span>
            <span>${r.names[1] ?? '-'}</span>
            <span>${r.names[2] ?? '-'}</span>
            <span>${r.names[3] ?? '-'}</span>
          `;
          table.appendChild(row);
        });

        panel.innerHTML = '';
        panel.appendChild(table);
        initHScrollDrag(table);
      } catch (err) {
        panel.innerHTML = `<div class="error">Failed to load depth chart.<br><small>${err.message}</small></div>`;
      }
    }
  
    function findTeamById(id) {
      const items = Object.values(TEAM_MAP || {});
      return items.find(t => String(t.id) === String(id)) || null;
    }
  
    // ========== DATA LOADERS ==========
    async function loadRoster(teamId) {
      if (!teamId) throw new Error('Missing teamId for roster request');
      if (rosterCache.has(teamId)) return rosterCache.get(teamId);
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster?enable=roster,projection,stats`;
        const data = await fetchJSON(url);
        rosterCache.set(teamId, data);
        return data;
      } catch (err) {
        rosterCache.set(teamId, null);
        throw err;
      }
    }
  
    async function loadSchedule(teamId, seasonYear) {
      if (!teamId) throw new Error('Missing teamId');
      const key = `${teamId}|${seasonYear}`;
      if (scheduleCache.has(key)) return scheduleCache.get(key);
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule?season=${seasonYear}`;
        const data = await fetchJSON(url);
        scheduleCache.set(key, data);
        return data;
      } catch (err) {
        scheduleCache.set(key, null);
        throw err;
      }
    }
  
    async function loadInjuries(teamId) {
      if (!teamId) throw new Error('Missing teamId');
      if (injuriesCache.has(teamId)) return injuriesCache.get(teamId);
      try {
        // Core API injuries (puede fallar CORS según momento)
        const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/${teamId}/injuries`;
        const data = await fetchJSON(url);
        injuriesCache.set(teamId, data);
        return data;
      } catch (err) {
        injuriesCache.set(teamId, null);
        throw err;
      }
    }
  
    // ==== UI helpers for position grouping ====
    function buildPosIndex(panelEl, positions) {
      if (!panelEl) return;
      // Ensure unique & sorted by master order
      const uniq = Array.from(new Set(positions || []));
      const orderIdx = (p) => {
        const i = POS_ORDER_MASTER.indexOf(p);
        return i === -1 ? 999 : i;
      };
      const sorted = uniq.sort((a, b) => {
        const d = orderIdx(a) - orderIdx(b);
        return d !== 0 ? d : String(a).localeCompare(String(b));
      });

      let idx = panelEl.querySelector('.pos-index');
      if (!idx) {
        idx = document.createElement('div');
        idx.className = 'pos-index';
        idx.style.display = 'flex';
        idx.style.flexWrap = 'wrap';
        idx.style.gap = '8px';
        idx.style.margin = '8px 0 12px';
        panelEl.prepend(idx);
      } else {
        idx.innerHTML = '';
      }
      
      // Asegura contenedor scrollable horizontal
      idx.style.overflowX = 'auto';
      idx.style.overflowY = 'hidden';
      idx.style.webkitOverflowScrolling = 'touch';
      idx.style.scrollSnapType = 'x proximity';

      sorted.forEach(pos => {
        const btn = document.createElement('button');
        btn.className = 'pos-chip';
        btn.setAttribute('data-target', `pos-${pos}`);
        btn.textContent = pos;
        btn.style.padding = '6px 10px';
        btn.style.borderRadius = '999px';
        btn.style.border = '1px solid #2a2a2a';
        btn.style.background = '#111';
        btn.style.color = '#e5e7eb';
        btn.style.cursor = 'pointer';
        idx.appendChild(btn);
      });

      // Drag-scroll en la fila de chips
      initHScrollDrag(idx);

      // Delegate clicks to scroll
      idx.addEventListener('click', (e) => {
        const b = e.target.closest('button.pos-chip');
        if (!b) return;
        const id = b.getAttribute('data-target');
        const sec = panelEl.querySelector(`#${id}`);
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function attachCollapsible(panelEl) {
      panelEl.addEventListener('click', (e) => {
        const h = e.target.closest('h4.roster-pos, h4.stats-pos');
        if (!h) return;
        const sec = h.parentElement;
        const table = sec.querySelector('.roster-table, .stats-table');
        if (!table) return;
        const isHidden = table.style.display === 'none';
        table.style.display = isHidden ? '' : 'none';
      });
    }

    // ==== Sorting helpers (robust) ====
    function _jerseyNum(v) {
      const n = Number(String(v || '').replace(/[^0-9]/g, ''));
      return Number.isFinite(n) ? n : NaN; // keep NaN to detect missing
    }
    function _byName(a, b) {
      const A = (a?.displayName || a?.fullName || '').toString();
      const B = (b?.displayName || b?.fullName || '').toString();
      return A.localeCompare(B);
    }
    function _sortGroupSmart(list) {
      if (!Array.isArray(list) || list.length <= 1) return list;
      list.sort(_byName);
      return list;
    }

    // ==== Position normalization (map ESPN granular positions to buckets) ====
    function mapPosToBucket(posObjOrStr) {
      const ab = (typeof posObjOrStr === 'object' && posObjOrStr !== null)
        ? (posObjOrStr.abbreviation || posObjOrStr.name || posObjOrStr.displayName || '')
        : (posObjOrStr || '');
      const rawAbbr = String(ab).toUpperCase().trim();

      const rawName = (typeof posObjOrStr === 'object' && posObjOrStr !== null)
        ? String(posObjOrStr.name || posObjOrStr.displayName || '').toUpperCase()
        : '';

      // Helpers: abbreviations must match EXACTLY; name phrases may be contained
      const eqAbbr = (...tokens) => tokens.some(t => rawAbbr === t);
      const nameHas = (...phrases) => phrases.some(p => rawName.includes(p));

      // --- Defense (secondary first) ---
      if (eqAbbr('CB','NB','DB') || nameHas('CORNERBACK','NICKEL','NICKELBACK','DEFENSIVE BACK','DIME')) return 'CB';
      if (eqAbbr('S','FS','SS') || nameHas('SAFETY','FREE SAFETY','STRONG SAFETY')) return 'S';

      // Linebackers / Edge / DL
      if (eqAbbr('LB','OLB','ILB','MLB') || nameHas('LINEBACKER','SAM','WILL','MIKE')) return 'LB';
      if (eqAbbr('EDGE') || nameHas('EDGE RUSHER','RUSH LB')) return 'EDGE';
      if (eqAbbr('DE') || nameHas('DEFENSIVE END')) return 'DE';
      if (eqAbbr('DT','NT') || nameHas('DEFENSIVE TACKLE','NOSE TACKLE')) return 'DT';
      if (eqAbbr('DL') || nameHas('DEFENSIVE LINE')) return 'DL';

      // --- Offense ---
      if (eqAbbr('QB') || nameHas('QUARTERBACK')) return 'QB';
      if (eqAbbr('WR') || nameHas('WIDE RECEIVER','SLOT RECEIVER','SLOT')) return 'WR';
      if (eqAbbr('TE') || nameHas('TIGHT END')) return 'TE';
      if (eqAbbr('RB','HB','TB') || nameHas('RUNNING BACK','HALFBACK','TAILBACK')) return 'RB';
      if (eqAbbr('FB') || nameHas('FULLBACK')) return 'FB';

      // Offensive line → OL bucket
      if (eqAbbr('OT','T','LT','RT') || nameHas('OFFENSIVE TACKLE')) return 'OL';
      if (eqAbbr('OG','G','LG','RG') || nameHas('OFFENSIVE GUARD')) return 'OL';
      if (eqAbbr('C') || nameHas('CENTER')) return 'OL';
      if (eqAbbr('OL') || nameHas('OFFENSIVE LINE')) return 'OL';

      // --- Special teams ---
      if (eqAbbr('K','PK','KOS') || nameHas('PLACEKICKER','KICKOFF SPECIALIST')) return 'K';
      if (eqAbbr('P') || nameHas('PUNTER')) return 'P';
      if (eqAbbr('LS') || nameHas('LONG SNAPPER','LONG SNAP')) return 'LS';
      if (eqAbbr('KR','RS') || nameHas('KICK RETURNER','RETURN SPECIALIST')) return 'KR';
      if (eqAbbr('PR') || nameHas('PUNT RETURNER')) return 'PR';

      // Fallback
      return 'OTH';
    }

    function initHScrollDrag(scrollHost) {
      if (!scrollHost || scrollHost.__dragBound) return;
    
      let isDown = false, startX = 0, scrollLeft = 0;
    
      // Fuerza scroll horizontal nativo en touch y evita rebotes verticales
      scrollHost.style.touchAction = 'pan-x';
      scrollHost.style.overscrollBehaviorX = 'contain';
      scrollHost.style.cursor = 'grab';
      scrollHost.style.overflowX = scrollHost.style.overflowX || 'auto';
      scrollHost.style.webkitOverflowScrolling = 'touch';
    
      scrollHost.addEventListener('pointerdown', e => {
        isDown = true;
        startX = e.pageX - scrollHost.offsetLeft;
        scrollLeft = scrollHost.scrollLeft;
        scrollHost.style.cursor = 'grabbing';
        scrollHost.classList && scrollHost.classList.add('is-dragging');
        scrollHost.setPointerCapture(e.pointerId);
      });
    
      scrollHost.addEventListener('pointermove', e => {
        if (!isDown) return;
        const x = e.pageX - scrollHost.offsetLeft;
        scrollHost.scrollLeft = scrollLeft - (x - startX);
      });
    
      ['pointerup','pointerleave','pointercancel'].forEach(t =>
        scrollHost.addEventListener(t, () => {
          isDown = false;
          scrollHost.style.cursor = 'grab';
          scrollHost.classList && scrollHost.classList.remove('is-dragging');
        })
      );
    
      scrollHost.__dragBound = true;
    }

    // ========== RENDERERS ==========
    async function renderRoster(teamId) {
      const panel = document.getElementById('panel-roster');
      panel.innerHTML = `<div class="loading">Loading roster…</div>`;
      try {
        const data = await loadRoster(teamId);
        const raw = data?.athletes || [];

        // Helpers
        const POS_ORDER = POS_ORDER_MASTER;
        const normPos = (p) => mapPosToBucket(p);
        const jerseyNum = (v) => _jerseyNum(v);
        const fmt = {
          height: (p) => {
            let val = p?.displayHeight || p?.height || '-';
            if (typeof val === 'object' || String(val).includes('[object Object]')) return '-';
            return val;
          },
          weight: (p) => {
            let val = p?.displayWeight || p?.weight || '-';
            if (typeof val === 'object' || String(val).includes('[object Object]')) return '-';
            return val;
          },
          exp:    (p) => (p?.experience?.years ?? p?.experience?.displayValue ?? '-'),
          college:(p) => {
            let val = p?.college?.text || p?.college?.name || p?.college?.displayName || p?.collegeTeam?.displayName || '-';
            if (typeof val === 'object' || String(val).includes('[object Object]')) return '-';
            return val;
          }
        };

        // Build groups per-player (robust even if API groups are "Offense/Defense/ST")
        const groups = {}; // { POS: [player, ...] }

        const pushByPos = (ath) => {
          const pPos = ath?.position || ath?.defaultPosition || ath?.pos || ath?.athlete?.position || null;
          const bucket = normPos(pPos);
          if (!groups[bucket]) groups[bucket] = [];
          groups[bucket].push(ath);
        };

        if (raw.length && (raw[0]?.items || raw[0]?.athletes)) {
          // API returned groups; ignore group label and use each athlete's own position
          raw.forEach(group => {
            const list = group?.items || group?.athletes || [];
            list.forEach(pushByPos);
          });
        } else {
          // Flat list of athletes
          raw.forEach(pushByPos);
        }

        // Compose UI
        const frag = document.createDocumentFragment();
        POS_ORDER.forEach(pos => {
          const list = groups[pos];
          if (!list || !list.length) return;

          // smart sort: jersey if most have it; otherwise A–Z by name
          _sortGroupSmart(list);

          const sec = document.createElement('section');
          sec.className = 'roster-section';
          sec.id = `pos-${pos}`;
          sec.innerHTML = `<h4 class="roster-pos">${pos}</h4>`;

          const table = document.createElement('div');
          table.className = 'roster-table';
          table.innerHTML = `
            <div class="row header">
              <span>#</span><span>Name</span><span>Age</span><span>HT</span><span>WT</span><span>EXP</span><span>College</span>
            </div>
          `;

          list.forEach(p => {
            const row = document.createElement('div');
            row.className = 'row player-row';
            row.setAttribute('data-ath-id', p?.id || '');
            row.innerHTML = `
              <span>${p?.jersey || '-'}</span>
              <span><span class="linkish">${p?.displayName || p?.fullName || '-'}</span></span>
              <span>${p?.age ?? '-'}</span>
              <span>${fmt.height(p)}</span>
              <span>${fmt.weight(p)}</span>
              <span>${fmt.exp(p)}</span>
              <span>${fmt.college(p)}</span>
            `;
            table.appendChild(row);
          });

          sec.appendChild(table);
          frag.appendChild(sec);
        });

        panel.innerHTML = '';
        // Build position index chips using available groups
        const available = Object.keys(groups).filter(k => (groups[k] && groups[k].length));
        buildPosIndex(panel, available);
        attachCollapsible(panel);
        panel.appendChild(frag);
        panel.querySelectorAll('.roster-table').forEach(tbl => initHScrollDrag(tbl));
        if (!panel.children.length) {
          panel.innerHTML = `<div class="muted">No roster available.</div>`;
        }
      } catch (err) {
        panel.innerHTML = `<div class="error">Failed to load roster.<br><small>${err?.message || ''}</small></div>`;
      }
    }
    // Athlete click delegation (attach once after teamsApp exists)
    let athleteDelegationAttached = false;
    function ensureAthleteDelegation() {
      if (athleteDelegationAttached) return;
      const root = document.getElementById('teamsApp');
      if (!root) return; // will be called again after ensureMounts()
      root.addEventListener('click', (e) => {
        const row = e.target.closest('.row.player-row');
        const btn = e.target.closest('button.link-btn');
        const aid = (row && row.getAttribute('data-ath-id')) || (btn && btn.getAttribute('data-ath-id'));
        if (aid) {
          e.preventDefault();
          openAthlete(aid);
        }
      });
      athleteDelegationAttached = true;
    }

    
    // ======== ATHLETE (player) loaders ========
    async function loadAthleteOverview(athleteId, year) {
      const y = Number(year) || (new Date()).getFullYear();
      const key = `${athleteId}|${y}`;
      if (athleteOverviewCache.has(key)) return athleteOverviewCache.get(key);
      const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athleteId}/overview?year=${y}`;
      const data = await fetchJSON(url);
      athleteOverviewCache.set(key, data);
      return data;
    }
    async function loadAthleteGamelog(athleteId, seasonYear) {
      const y = Number(seasonYear) || (new Date()).getFullYear();
      const key = `${athleteId}|${y}`;
      if (athleteGamelogCache.has(key)) return athleteGamelogCache.get(key);
      const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athleteId}/gamelog?year=${y}`;
      const data = await fetchJSON(url);
      athleteGamelogCache.set(key, data);
      return data;
    }


    // ======== ATHLETE modal ========
    async function openAthlete(athleteId) {
      // push state so back button works
      pushTeamState(currentTab, athleteId);
      await renderAthleteModal(athleteId);
    }

    async function renderAthleteModal(athleteId) {
      // Create overlay container
      let overlay = document.getElementById('athleteOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'athleteOverlay';
        overlay.className = 'overlay';
        // minimal inline styles to ensure visibility without CSS file edits
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.55)';
        overlay.style.backdropFilter = 'blur(2px)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        APP.appendChild(overlay);
      }
      overlay.innerHTML = `
        <div id="athleteCard" style="max-width:900px;width:92%;background:#111;color:#eee;border:1px solid #333;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);">
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #2a2a2a;">
            <button id="closeAthlete" aria-label="Close" style="border:none;background:#222;color:#ddd;padding:8px 10px;border-radius:8px;cursor:pointer">✕</button>
            <h3 id="athName" style="margin:0;font-size:18px;">Loading…</h3>
            <span id="athMeta" style="margin-left:auto;font-size:12px;opacity:0.8"></span>
          </div>
          <div id="athBody" style="padding:12px 16px;max-height:70vh;overflow:auto;">
            <div class="loading">Loading player…</div>
          </div>
        </div>
      `;

      // Season year selection for fallback
      const ySel = document.getElementById('seasonYearSelect');
      const fallYear = ySel ? Number(ySel.value) : (new Date()).getFullYear();

      // Close actions
      overlay.addEventListener('click', (e) => {
        if (e.target.id === 'athleteOverlay' || e.target.id === 'closeAthlete') {
          overlay.remove();
          // drop player from URL but keep team/tab
          pushTeamState(currentTab, null);
        }
      });

      try {
        // 1) Primary source: ESPN web overview
        let overview = null;
        try {
          overview = await loadAthleteOverview(athleteId, fallYear);
        } catch (_) {
          overview = null;
        }

        // Extract from overview if present
        let p = overview?.athlete || overview?.header?.athlete || overview?.athletes?.[0] || null;

        // 2) Fallback to cached roster if overview was not available
        if (!p) {
          p = _getCachedAthlete(currentTeamId, athleteId);
        }

        // 3) If still nothing, show a friendly error
        if (!p) {
          document.getElementById('athBody').innerHTML = `<div class="error">Could not load this player right now.</div>`;
          return;
        }

        // Normalize basic fields (support both overview and roster schemas)
        const name = p?.displayName || p?.fullName || p?.athlete?.displayName || 'Player';
        const pos  = ((p?.position?.abbreviation || p?.position?.name || p?.athlete?.position?.abbreviation || p?.athlete?.position?.name || '') + '').toUpperCase();
        const teamName = p?.team?.displayName || p?.team?.name || p?.athlete?.team?.displayName || '';
        const headshotHref = p?.headshot?.href || p?.headshot || p?.athlete?.headshot?.href || '';

        document.getElementById('athName').textContent = name;
        document.getElementById('athMeta').textContent = [teamName, pos].filter(Boolean).join(' • ');

        const headshot = headshotHref
          ? `<img src="${headshotHref}" alt="${name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid #333;margin-right:8px;"/>`
          : '';

        const statusStr = p?.status?.type?.name || p?.status?.name || (p?.status?.active ? 'Active' : '') || '';
        const jersey = p?.jersey || p?.uniformNumber || p?.athlete?.jersey || '';
        const expStr = p?.experience?.displayValue || (Number.isFinite(p?.experience?.years) ? `${p.experience.years} Season${p.experience.years === 1 ? '' : 's'}` : '');
        const collegeStr = p?.college?.text || p?.college?.name || p?.collegeTeam?.displayName || '';
        const heightStr = p?.displayHeight || p?.height || '';
        const weightStr = p?.displayWeight || p?.weight || '';
        const birthIso =
        p?.birthDate ||
        p?.dateOfBirth ||
        overview?.athlete?.dateOfBirth ||
        overview?.athlete?.birthDate ||
        overview?.header?.athlete?.dateOfBirth ||
        '';
      const birthDateStr = birthIso ? new Date(birthIso).toLocaleDateString() : '';
      const ageYears = birthIso ? calcAge(birthIso) : '';
      const bp = p?.birthPlace || p?.birthplace || overview?.athlete?.birthPlace || {};
      const birthPlaceStr = [bp?.city || bp?.town, bp?.state || bp?.stateProvince, bp?.country].filter(Boolean).join(', ');
      const birthWithAge = birthDateStr ? `${birthDateStr}${ageYears ? ` (${ageYears})` : ''}` : '';

        const draft = p?.draft || p?.athlete?.draft || null;
        const draftStr = (() => {
          if (!draft) return '';
          const yr = draft.year || draft.season || '';
          const rd = draft.round || draft.roundNumber || '';
          const pk = draft.pick || draft.overall || '';
          const t  = draft.team?.abbreviation || draft.team?.displayName || '';
          const bits = [];
          if (yr) bits.push(yr);
          if (rd) bits.push(`Rd ${rd}`);
          if (pk) bits.push(`Pk ${pk}`);
          const base = bits.join(' • ');
          return base ? (t ? `${base} (${t})` : base) : '';
        })();

        const detailRows = [
          ['Team', teamName],
          ['Position', pos],
          ['Status', statusStr],
          ['Jersey', jersey ? `#${jersey}` : ''],
          ['College', collegeStr],
          ['Experience', expStr],
          ['HT/WT', [heightStr, weightStr].filter(Boolean).join(', ')],
          ['Draft Info', draftStr],
          ['Birth', birthWithAge],
          ['Birthplace', birthPlaceStr],
        ].filter(([,v]) => v);

        const infoHTML = detailRows.map(([k,v]) => `
          <div style="display:flex;gap:10px;align-items:center;margin:4px 0;">
            <div style="width:130px;opacity:.75">${k}</div>
            <div style="flex:1">${v}</div>
          </div>
        `).join('');

        let headerBlock = `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            ${headshot}
            <div>
              <div style="font-weight:600;margin-bottom:4px">${name}</div>
              <div style="opacity:.8;font-size:13px">${[teamName, pos].filter(Boolean).join(' • ')}</div>
            </div>
          </div>
        `;

        // Optional: best-effort recent games
        let gamelogHTML = '';
        try {
          const gl = await loadAthleteGamelog(athleteId, fallYear);
          const games = gl?.events || gl?.gamelog || gl?.items || [];
          if (games.length) {
            const rows = games.slice(0, 8).map(g => {
              const dt = g?.date ? new Date(g.date) : null;
              const dateStr = dt ? dt.toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '-';
              const opp = g?.opponent?.displayName || g?.opponent || '-';
              const res = g?.result || g?.outcome || '-';
              const line = g?.statLine || g?.line || '';
              return `<div style="display:grid;grid-template-columns:80px 1fr 80px;gap:8px;padding:6px 0;border-bottom:1px solid #222">
                <span>${dateStr}</span><span>${opp}</span><span>${res}</span>
                <span style="grid-column:1/-1;opacity:.9">${line}</span>
              </div>`;
            }).join('');
            gamelogHTML = `<h4 style="margin:16px 0 8px">Recent Games</h4><div>${rows}</div>`;
          }
        } catch { /* ignore gamelog errors */ }

        document.getElementById('athBody').innerHTML = `
          ${headerBlock}
          <div>
            <h4 style="margin:8px 0 8px">Biography</h4>
            <div>${infoHTML}</div>
          </div>
          ${gamelogHTML}
        `;
      } catch (err) {
        document.getElementById('athBody').innerHTML = `<div class="error">Failed to load player.<br><small>${err.message}</small></div>`;
      }
    }
  
    async function renderSchedule(teamId) {
      const panel = document.getElementById('panel-schedule');
      panel.innerHTML = `<div class="loading">Loading schedule…</div>`;
  
      const yearSel = document.getElementById('seasonYearSelect');
      const typeSel = document.getElementById('seasonTypeSelect');
      const year = yearSel ? Number(yearSel.value) : (new Date()).getFullYear();
      const st = typeSel ? String(typeSel.value) : '2';
  
      try {
        const data = await loadSchedule(teamId, year);
        const evts = data?.events || [];
        // Filtrar por seasonType (1=pre,2=reg,3=post)
        const filtered = evts.filter(e => {
          const w = e?.week;
          const comp = e?.competitions?.[0];
          const stype = String(comp?.type?.id || comp?.type || e?.seasonType || w?.type?.id || '');
          return stype === st;
        });
  
        if (!filtered.length) {
          panel.innerHTML = `<div class="muted">No games for selected season type.</div>`;
          return;
        }
  
        const table = document.createElement('div');
        table.className = 'schedule-table';
        table.innerHTML = `
          <div class="row header">
            <span>Date</span><span>Opponent</span><span>Venue</span><span>Result</span><span>Status</span>
          </div>
        `;
        filtered.forEach(ev => {
          const comp = ev.competitions?.[0] || {};
          const date = ev.date ? new Date(ev.date) : null;
          const dateStr = date ? date.toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '-';
          const isHome = (comp.competitors || []).find(c => c.homeAway === 'home' && c.team?.id === String(teamId));
          const opp = (comp.competitors || []).find(c => c.team?.id !== String(teamId));
          const oppName = opp?.team?.displayName || '-';
          const atStr = isHome ? 'vs' : '@';
          const venue = comp.venue?.fullName || '-';
  
          let result = '-';
          let status = comp.status?.type?.shortDetail || comp.status?.type?.description || '-';
          if (comp.status?.type?.state === 'post') {
            const scores = {};
            (comp.competitors || []).forEach(c => scores[c.team?.id] = Number(c.score || 0));
            const my = Number(isHome ? (comp.competitors.find(c => c.homeAway==='home')?.score || 0) : (comp.competitors.find(c => c.homeAway==='away')?.score || 0));
            const op = Number(opp?.score || 0);
            result = `${my}-${op}`;
          }
  
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `
            <span>${dateStr}</span>
            <span>${atStr} ${oppName}</span>
            <span>${venue}</span>
            <span>${result}</span>
            <span>${status}</span>
          `;
          table.appendChild(row);
        });
  
        panel.innerHTML = '';
        panel.appendChild(table);
        initHScrollDrag(table);
      } catch (err) {
        panel.innerHTML = `<div class="error">Failed to load schedule.<br><small>${err.message}</small></div>`;
      }
    }
  
    async function renderInjuries(teamId) {
      const panel = document.getElementById('panel-injuries');
      panel.innerHTML = `<div class="loading">Loading injuries…</div>`;
      try {
        const data = await loadInjuries(teamId);
        // Core API suele devolver items con links a jugadores; a veces es una colección con "items"
        const items = data?.items || data?.entries || [];
  
        if (!items.length) {
          panel.innerHTML = `<div class="muted">No injuries reported.</div>`;
          return;
        }
  
        const table = document.createElement('div');
        table.className = 'injuries-table';
        table.innerHTML = `
          <div class="row header">
            <span>Player</span><span>Status</span><span>Injury</span><span>Updated</span>
          </div>
        `;
  
        // Intento de parseo genérico
        items.forEach(it => {
          const plName = it?.athlete?.displayName || it?.athlete?.fullName || it?.athlete?.name || '-';
          const status = it?.status?.type?.name || it?.status?.name || it?.status || '-';
          const detail = it?.details?.[0]?.description || it?.note || it?.description || '-';
          const updated = it?.lastModified || it?.date || '';
  
          const row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = `
            <span>${plName}</span>
            <span>${status}</span>
            <span>${detail}</span>
            <span>${updated ? new Date(updated).toLocaleDateString() : '-'}</span>
          `;
          table.appendChild(row);
        });
  
        panel.innerHTML = '';
        panel.appendChild(table);
        initHScrollDrag(table);
      } catch (err) {
        panel.innerHTML = `<div class="error">Failed to load injuries.<br><small>${err.message}</small></div>`;
      }
    }
  
    async function renderStats(teamId) {
      const panel = document.getElementById('panel-stats');
      panel.innerHTML = `<div class="loading">Loading player stats…</div>`;

      try {
        const data = await loadRoster(teamId);
        const raw = data?.athletes || [];

        // === Group players by position (works for both schemas) ===
        const POS_ORDER = POS_ORDER_MASTER;
        const normPos = (p) => mapPosToBucket(p);
        const jerseyNum = (v) => _jerseyNum(v);

        const positionGroups = {}; // {POS: [player,...]}
        if (raw.length && (raw[0]?.items || raw[0]?.athletes)) {
          // grouped variant
          raw.forEach(group => {
            const pos = normPos(group?.position || group?.group || group?.name);
            const list = group?.items || group?.athletes || [];
            if (!positionGroups[pos]) positionGroups[pos] = [];
            list.forEach(a => positionGroups[pos].push(a));
          });
        } else {
          // flat variant
          raw.forEach(p => {
            const pos = normPos(p?.position);
            if (!positionGroups[pos]) positionGroups[pos] = [];
            positionGroups[pos].push(p);
          });
        }

        // === Schema per position ===
        const schema = {
          QB: ['Player','CMP/ATT','YDS','TD','INT','RUSH YDS','RUSH TD'],
          RB: ['Player','ATT','YDS','AVG','TD','REC','REC YDS'],
          WR: ['Player','REC','YDS','AVG','TD','LONG','TGTS'],
          TE: ['Player','REC','YDS','AVG','TD','LONG','TGTS'],
          OL: ['Player','GP','GS','PEN','YDS'],
          DL: ['Player','TOT','SACK','TFL','QB HIT','FF'],
          EDGE: ['Player','TOT','SACK','TFL','QB HIT','FF'],
          DE: ['Player','TOT','SACK','TFL','QB HIT','FF'],
          DT: ['Player','TOT','SACK','TFL','QB HIT','FF'],
          LB: ['Player','TOT','SACK','TFL','INT','PD'],
          CB: ['Player','TOT','INT','PD','TD','TFL'],
          S:  ['Player','TOT','INT','PD','TD','TFL'],
          K:  ['Player','FGM/FGA','FG%','LONG','XPM/XPA','PTS'],
          P:  ['Player','PUNTS','AVG','LONG','INS20','TB'],
          LS: ['Player','GP','GS'],
          FB: ['Player','ATT','YDS','TD','REC','REC YDS'],
          KR: ['Player','RET','YDS','AVG','TD','LONG'],
          PR: ['Player','RET','YDS','AVG','TD','LONG'],
          OTH:['Player','GP','GS']
        };

        // Extract generic stat map {LABEL -> value}
        const toStatMap = (pl) => {
          const m = {};
          const groups = pl?.statistics || pl?.stats || [];
          groups.forEach(g => {
            const stats = g?.stats || g?.statistics || [];
            stats.forEach(s => {
              const key = s?.label || s?.name || '';
              const val = s?.displayValue ?? s?.value ?? '';
              if (key) m[key.toUpperCase()] = val;
            });
          });
          return m;
        };

        const makeRow = (cols) => `<div class="row">${cols.map(c => `<span>${c ?? '-'}</span>`).join('')}</div>`;

        const frag = document.createDocumentFragment();

        POS_ORDER.forEach(pos => {
          const list = positionGroups[pos];
          if (!list || !list.length) return;
          _sortGroupSmart(list);

          const sec = document.createElement('section');
          sec.className = 'stats-section';
          sec.id = `pos-${pos}`;
          sec.innerHTML = `<h4 class="stats-pos">${pos}</h4>`;

          const table = document.createElement('div');
          table.className = 'stats-table';
          const cols = schema[pos] || schema.OTH;
          table.innerHTML = makeRow(cols.map(c => `<b>${c}</b>`));

          list.forEach(p => {
            const smap = toStatMap(p);
            const getAny = (...keys) => {
              for (const k of keys) { const v = smap[String(k).toUpperCase()]; if (v !== undefined) return v; }
              return '';
            };
            const val = (label) => {
              const key = String(label || '').toUpperCase();
              switch (label) {
                case 'Player': return p?.displayName || p?.fullName || '-';
                // QB
                case 'CMP/ATT': return getAny('COMP/ATT','C-A','CMP/ATTEMPT','COMP ATT');
                case 'YDS': return getAny('YDS','PASSING YARDS','RUSH YDS','REC YDS','YARDS');
                case 'TD': return getAny('TD','PASS TD','RUSH TD','REC TD','TOUCHDOWNS');
                case 'INT': return getAny('INT','INTERCEPTIONS');
                // RB
                case 'ATT': return getAny('ATT','RUSH ATT','ATTEMPTS');
                case 'AVG': return getAny('AVG','YDS/ATT','YDS/REC');
                // WR/TE
                case 'REC': return getAny('REC','RECEPTIONS');
                case 'LONG': return getAny('LONG','LONGEST');
                case 'TGTS': return getAny('TARGETS','TGTS');
                // Defense
                case 'TOT': return getAny('TOT','TOTAL','TACKLES','COMBINED TACKLES');
                case 'SACK': return getAny('SACK','SACKS');
                case 'TFL': return getAny('TFL','TACKLES FOR LOSS','TFLS');
                case 'QB HIT': return getAny('QB HITS','QB HIT');
                case 'FF': return getAny('FORCED FUMBLES','FF');
                case 'PD': return getAny('PD','PASSES DEFENDED','PASS DEF');
                // K/P
                case 'FGM/FGA': return getAny('FGM-FGA','FGM/FGA');
                case 'FG%': return getAny('FG%','FIELD GOAL %');
                case 'XPM/XPA': return getAny('XPM-XPA','XPM/XPA');
                case 'PTS': return getAny('PTS','POINTS');
                case 'PUNTS': return getAny('PUNTS','# OF PUNTS','NO. OF PUNTS');
                case 'INS20': return getAny('IN20','INSIDE 20');
                case 'TB': return getAny('TB','TOUCHBACKS');
                // ST
                case 'RET': return getAny('RET','RETURNS');
                // Generic
                case 'GP': return getAny('GP','GAMES PLAYED');
                case 'GS': return getAny('GS','GAMES STARTED');
                default: return getAny(key);
              }
            };

            const rowVals = (schema[pos] || schema.OTH).map(val);
            const rowEl = document.createElement('div');
            rowEl.className = 'row player-row';
            rowEl.setAttribute('data-ath-id', p?.id || '');
            rowEl.innerHTML = rowVals.map(c => `<span>${c ?? '-'}</span>`).join('');
            table.appendChild(rowEl);
          });

          sec.appendChild(table);
          frag.appendChild(sec);
        });

        panel.innerHTML = '';
        const availableStats = Object.keys(positionGroups).filter(k => (positionGroups[k] && positionGroups[k].length));
        buildPosIndex(panel, availableStats);
        attachCollapsible(panel);
        panel.appendChild(frag);
        panel.querySelectorAll('.stats-table').forEach(tbl => initHScrollDrag(tbl));
        if (!panel.children.length) {
          panel.innerHTML = `<div class="muted">No player stats available.</div>`;
        }
      } catch (err) {
        panel.innerHTML = `<div class="error">Failed to load player stats.<br><small>${err.message}</small></div>`;
      }
    }
  
    // ======= History (URLs bonitas) =======
    function pushListState() {
      const url = new URL(location.href);
      url.searchParams.delete('team');
      url.searchParams.delete('tab');
      url.searchParams.set('conf', activeConf);
      history.pushState({ view: 'list', conf: activeConf }, '', url.toString());
    }
    function pushTeamState(tab, playerId = null) {
      const url = new URL(location.href);
      url.searchParams.set('team', currentTeamId);
      url.searchParams.set('tab', tab);
      url.searchParams.set('conf', activeConf);
      if (playerId) url.searchParams.set('player', playerId); else url.searchParams.delete('player');
      history.pushState({ view: 'team', team: currentTeamId, tab, conf: activeConf, player: playerId }, '', url.toString());
    }
  
    window.addEventListener('popstate', () => {
      const url = new URL(location.href);
      const team = url.searchParams.get('team');
      const tab = url.searchParams.get('tab') || 'roster';
      const conf = url.searchParams.get('conf') || 'AFC';
      const player = url.searchParams.get('player');
      activeConf = conf;

      if (team) {
        renderToolbar();
        openTeam(team, tab).then(() => {
          if (player) openAthlete(player);
        });
      } else {
        renderToolbar();
        renderTeamsList();
      }
    });
  
    // ======= Boot =======
    document.addEventListener('DOMContentLoaded', async () => {
      ensureMounts();
      // Refresh refs if they were null before (ensureMounts may have created them)
      APP = document.getElementById('teamsApp');
      TOOLBAR = document.getElementById('teamsToolbar');
      ensureAthleteDelegation();
      if (!APP || !TOOLBAR) {
        console.error('teams.js: Required mounts not found (teamsApp / teamsToolbar).');
        return;
      }
      await loadTeamMap();

      // Lee URL inicial
      const url = new URL(location.href);
      const team = url.searchParams.get('team');
      const tab = url.searchParams.get('tab') || 'roster';
      const conf = url.searchParams.get('conf') || 'AFC';
      const player = url.searchParams.get('player');
      activeConf = conf;

      renderToolbar();

      if (team) {
        openTeam(team, tab).then(() => {
          if (player) openAthlete(player);
        });
      } else {
        renderTeamsList();
        pushListState();
      }
    });
  })();