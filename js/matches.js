const liveIntervals = {};
const suspendedGames = new Set(["401773016"]);

document.addEventListener('DOMContentLoaded', () => {
  const matchesContainer = document.getElementById('matchesContainer');
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const searchInput = document.getElementById('searchInput');
  const weekFilter = document.getElementById('weekFilter');
  const seasonTypeFilter = document.getElementById('seasonTypeFilter');

  // --- Local team assets (logos/names) map
  let TEAM_MAP = null;
  async function loadTeamMap() {
    if (TEAM_MAP) return TEAM_MAP;
    try {
      const res = await fetch('/data/teams/nfl_teams.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error('nfl_teams.json not found');
      TEAM_MAP = await res.json();
    } catch (e) {
      console.warn('TEAM_MAP not available for matches:', e.message);
      TEAM_MAP = {};
    }
    return TEAM_MAP;
  }
  function teamKeyFromRaw(t) {
    if (!t) return '';
    return String(t.abbreviation || t.shortDisplayName || t.displayName || t.name || '').toUpperCase();
  }
  function getTeamLogoRaw(t) {
    const key = teamKeyFromRaw(t);
    const local = TEAM_MAP && TEAM_MAP[key];
    return (local && local.logo) || t?.logo || t?.logos?.[0]?.href || '';
  }
  function getTeamNameRaw(t) {
    const key = teamKeyFromRaw(t);
    const local = TEAM_MAP && TEAM_MAP[key];
    return (local?.displayName) || t?.displayName || t?.shortDisplayName || t?.name || key || 'TBD';
  }

  // Render timeouts (NFL): 3 pips per team, remaining vs used
  function renderTimeoutsInto(card, awayTeamObj, homeTeamObj, awayRemain, homeRemain) {
    const container = card.querySelector('.timeouts-container');
    if (!container) return;

    // Clamp values between 0 and 3
    const clamp = v => Math.max(0, Math.min(3, Number.isFinite(Number(v)) ? Number(v) : 0));
    const aRem = clamp(awayRemain);
    const hRem = clamp(homeRemain);

    const pipRow = (label, rem) => {
      const pips = Array.from({ length: 3 }, (_, i) => {
        const filled = i < rem; // left to right fill
        return `<span class="pip" style="display:inline-block;width:10px;height:10px;border-radius:999px;margin:0 4px;${filled ? 'background:#13B355;border:1px solid #0e8f44;' : 'background:#d1d5db;border:1px solid #bfc5ce;opacity:.8;'}"></span>`;
      }).join('');
      return `
        <div class="to-row" style="display:flex;align-items:center;justify-content:space-between;margin:4px 0;gap:10px;">
          <span class="to-label" style="flex:0 0 auto;min-width:90px;font-size:.85rem;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</span>
          <span class="to-pips" style="flex:1 1 auto;text-align:right;">${pips}</span>
        </div>`;
    };

    const awayLabel = getTeamNameRaw(awayTeamObj);
    const homeLabel = getTeamNameRaw(homeTeamObj);

    container.innerHTML = `
      <div class="timeouts-wrap" style="border-top:1px solid rgba(255,255,255,.08);margin-top:8px;padding-top:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:.78rem;letter-spacing:.04em;color:#bbb;">TIMEOUTS</span>
          <span style="font-size:.72rem;opacity:.65;">remaining</span>
        </div>
        ${pipRow(awayLabel, aRem)}
        ${pipRow(homeLabel, hRem)}
      </div>`;

    container.style.display = '';
  }

  let currentLeague = 'nfl'; // fixed to NFL
  let currentSeasonType = '2';

  // Intervalo dinámico (NFL-only)
  function computeLiveIntervalMs(liveCount) {
    if (liveCount <= 6) return 5000;     // 5s
    if (liveCount <= 12) return 10000;   // 10s
    return 15000;                        // 15s
  }

  // Base URL ESPN NFL
  function buildScoreboardBaseUrl(seasonType) {
    const year = 2025;
    return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}`;
  }

  // Detect current season type (pre/regular/post) and week using ESPN calendar windows.
  // More robust: first tries to read "current" from the calendar root; falls back to window scanning if needed.
  async function detectSeasonTypeAndWeek() {
    const year = 2025;
    const base = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}`;

    // Try grabbing "current" directly from calendar root
    try {
      const rootRes = await fetch(base);
      const root = await rootRes.json();
      const cal = root?.leagues?.[0]?.calendar;
      const current = cal?.current || null;

      // ESPN sometimes nests the shape as { current: { value: '2', week: { number: '1' } } }
      if (current && (current.value || current.seasontype || current.seasonType)) {
        const st =
          String(current.value ?? current.seasontype ?? current.seasonType ?? '2');
        const wk =
          String(current.week?.number ??
                 current.weekNumber ??
                 root?.week?.number ??
                 root?.events?.[0]?.week?.number ??
                 '1');
        if (st && wk) {
          return { seasonType: st, week: wk, data: root };
        }
      }

      // If there's no `current`, try to infer by scanning labeled buckets
      const buckets = Array.isArray(cal) ? cal : [];
      const now = new Date();
      const pickFromBucket = (labelNeedle) => {
        const node = buckets.find(n =>
          String(n?.value) === labelNeedle ||
          String(n?.label || '').toLowerCase().includes(
            labelNeedle === '2' ? 'regular' : (labelNeedle === '1' ? 'pre' : 'post')
          )
        );
        const weeks = node?.entries || node?.calendar || [];
        for (const w of (weeks || [])) {
          const sd = w?.startDate ? new Date(w.startDate) : null;
          const ed = w?.endDate ? new Date(w.endDate) : null;
          if (sd && ed && now >= sd && now <= ed) {
            return String(w.value ?? w.weekNumber ?? w.number ?? '');
          }
        }
        return null;
      };

      // Prefer REGULAR
      let wk = pickFromBucket('2');
      if (wk) return { seasonType: '2', week: wk, data: root };
      // Then PRE
      wk = pickFromBucket('1');
      if (wk) return { seasonType: '1', week: wk, data: root };
      // Then POST
      wk = pickFromBucket('3');
      if (wk) return { seasonType: '3', week: wk, data: root };

      // Final fallback: use values present in root if any
      const fbWeek =
        root?.week?.number ||
        root?.leagues?.[0]?.calendar?.current?.week?.number ||
        root?.events?.[0]?.week?.number || '1';
      return { seasonType: '2', week: String(fbWeek), data: root };
    } catch {
      // Absolute fallback if root fetch fails: probe season types
      async function trySeasonType(st) {
        const res = await fetch(`${base}&seasontype=${st}`);
        const data = await res.json();
        const calRoot = data?.leagues?.[0]?.calendar;
        const stStr = String(st);
        const labelNeedle = st === 1 ? 'pre' : st === 2 ? 'regular' : 'post';
        const typeNode = Array.isArray(calRoot)
          ? calRoot.find(n => String(n?.value) === stStr || String(n?.label || '').toLowerCase().includes(labelNeedle))
          : null;
        const weeks = typeNode?.entries || typeNode?.calendar || [];
        const now = new Date();
        let week = null;
        if (Array.isArray(weeks) && weeks.length) {
          for (const w of weeks) {
            const sd = w?.startDate ? new Date(w.startDate) : null;
            const ed = w?.endDate ? new Date(w.endDate) : null;
            if (sd && ed && now >= sd && now <= ed) {
              week = String(w.value ?? w.weekNumber ?? w.number ?? '');
              break;
            }
          }
        }
        return { data, week };
      }
      try {
        let r = await trySeasonType(2);
        if (r.week) return { seasonType: '2', week: r.week, data: r.data };
        let p = await trySeasonType(1);
        if (p.week) return { seasonType: '1', week: p.week, data: p.data };
        let q = await trySeasonType(3);
        if (q.week) return { seasonType: '3', week: q.week, data: q.data };
        return { seasonType: '2', week: '1', data: null };
      } catch {
        return { seasonType: '2', week: '1', data: null };
      }
    }
  }

  // Init filtros + render
  async function initDefaultWeekAndRender() {
    // Detect actual season + week from ESPN and sync the UI before first render
    const detected = await detectSeasonTypeAndWeek();
    // --- Safeguard: if detected preseason but regular is ongoing, override to regular
    try {
      if (detected?.seasonType === '1') {
        const base = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2`;
        const res = await fetch(base);
        const data = await res.json();
        const calRoot = data?.leagues?.[0]?.calendar;
        const regNode = Array.isArray(calRoot) ? calRoot.find(n => String(n?.value) === '2') : null;
        const weeks = regNode?.entries || regNode?.calendar || [];
        const now = new Date();
        const activeReg = (weeks || []).find(w => {
          const sd = w?.startDate ? new Date(w.startDate) : null;
          const ed = w?.endDate ? new Date(w.endDate) : null;
          return sd && ed && now >= sd && now <= ed;
        });
        if (activeReg) {
          detected.seasonType = '2';
          detected.week = String(activeReg.value ?? activeReg.weekNumber ?? activeReg.number ?? detected.week);
        }
      }
    } catch {}
    if (detected?.seasonType) {
      currentSeasonType = detected.seasonType;
    }
    else {
      currentSeasonType = '2';
    }
    updateSeasonTypeFilterForLeague();
    updateWeekFilterForSeasonType();

    if (!detected?.week) {
      // Default to Week 1 for Regular Season preset
      const defaultWeek = '1';
      if ([...weekFilter.options].some(o => o.value === defaultWeek)) {
        weekFilter.value = defaultWeek;
      }
    }

    if (detected?.week && [...weekFilter.options].some(o => o.value === detected.week)) {
      weekFilter.value = detected.week;
    }
    // First paint
    await renderMatches();
  }

  // Opciones de temporada (NFL-only)
  function updateSeasonTypeFilterForLeague() {
    seasonTypeFilter.innerHTML = `
      <option value="1">Preseason</option>
      <option value="2">Regular Season</option>
      <option value="3">Postseason</option>
    `;
    if ([...seasonTypeFilter.options].some(opt => opt.value === currentSeasonType)) {
      seasonTypeFilter.value = currentSeasonType;
    } else {
      currentSeasonType = seasonTypeFilter.options[0].value;
      seasonTypeFilter.value = currentSeasonType;
    }
  }

  // Marcar NFL como activo al inicio
  document.querySelector('.toggle-btn[data-league="nfl"]')?.classList.add('active');

  function getScheduleUrl(week) {
    if (currentSeasonType === '1') {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=1&week=${week}`;
    } else if (currentSeasonType === '2') {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`;
    } else {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=${week}`;
    }
  }

  async function fetchWeekData(week) {
    const url = getScheduleUrl(week);
    console.log("🌐 URL solicitada:", url);

    const res = await fetch(url);
    const data = await res.json();
    const events = data.events || [];

    console.log(`✅ Eventos recibidos (NFL):`, events.length, events.map(e => e.name));

    return events.map(evt => {
      const comp = evt.competitions[0];
      return {
        id: evt.id,
        name: evt.name,
        date: evt.date,
        week: evt.week || { number: 'N/A' },
        competitions: [
          {
            ...comp,
            venue: comp.venue || { fullName: 'TBD' },
            competitors: comp.competitors || [],
            status: comp.status || {},
            playByPlayAvailable: comp.playByPlayAvailable ?? false
          }
        ]
      };
    });
  }

  async function renderMatches() {
    matchesContainer.innerHTML = '';
    const selectedWeek = weekFilter.value;
    let allGames = [];
    await loadTeamMap();

    try {
      if (selectedWeek === 'all' && currentSeasonType !== '1') {
        const weekPromises = [];
        const maxWeeks = currentSeasonType === '2' ? 18 : 4; // Regular 18, Post 4
        for (let i = 1; i <= maxWeeks; i++) weekPromises.push(fetchWeekData(i));
        const allWeeks = await Promise.all(weekPromises);
        allGames = allWeeks.flat();
      } else {
        allGames = await fetchWeekData(selectedWeek);
      }
    } catch (e) {
      matchesContainer.innerHTML = '<p>Error loading data. Please try again later.</p>';
      return;
    }

    if (!allGames.length) {
      matchesContainer.innerHTML = '<p>No matches available.</p>';
      return;
    }

    // Calcula juegos en vivo para decidir el intervalo de actualización
    const liveCount = allGames.filter(g => g?.competitions?.[0]?.status?.type?.state === 'in').length;
    const intervalMsForThisRender = computeLiveIntervalMs(liveCount);

    allGames.forEach(evt => {
      const comp = evt.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      const status = comp.status || {};
      const isLive = status.type?.state === 'in';
      const isFinal = status.type?.state === 'post';

      const isSuspended =
        suspendedGames.has(String(evt.id)) ||
        (status?.type?.name === 'STATUS_SUSPENDED') ||
        /suspend/i.test(status?.type?.description || '') ||
        /suspend/i.test(status?.type?.detail || '');

      const d = new Date(evt.date);
      const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const weekNumber = evt.week?.number || 'N/A';

      let timeDisplay = `${date} | ${time}`;
      if (isLive && status.period && status.displayClock) {
        timeDisplay = `Q${status.period} • ${status.displayClock}`;
      }

      let statusBadge = '';
      if (isSuspended) statusBadge = '<div class="suspended-badge">SUSPENDED</div>';
      else if (isLive) statusBadge = '<div class="live-badge">LIVE</div>';
      else if (isFinal) statusBadge = '<div class="final-badge">FINAL</div>';

      const matchCard = document.createElement('div');
      matchCard.className = `match-card ${isLive ? 'live' : ''} ${isFinal ? 'final' : ''} ${isSuspended ? 'suspended' : ''}`;
      matchCard.innerHTML = `
        <div class="match-header">
          ${statusBadge}
          <span class="match-time">${timeDisplay}</span>
        </div>
        <div class="teams-container">
          <div class="team">
            <img src="${getTeamLogoRaw(away?.team)}" class="team-logo">
            <span class="team-name">${getTeamNameRaw(away?.team)}</span>
            ${(isLive || isFinal || isSuspended) ? `<span class="score">${away?.score ?? '0'}</span>` : ''}
          </div>
          <span class="vs-text">VS</span>
          <div class="team">
            <img src="${getTeamLogoRaw(home?.team)}" class="team-logo">
            <span class="team-name">${getTeamNameRaw(home?.team)}</span>
            ${(isLive || isFinal || isSuspended) ? `<span class="score">${home?.score ?? '0'}</span>` : ''}
          </div>
        </div>
        <div class="timeouts-container" style="display:none;margin:6px 10px 0 10px;"></div>
        <div class="match-details">
          <p class="match-week">${getWeekLabel(weekNumber)}</p>
          <p class="match-stadium">@ ${comp.venue?.fullName || 'TBD'}</p>
        </div>`;

      // Final: resaltar ganador/empate
      (function applyFinalStyling(){
        const teamEls = matchCard.querySelectorAll('.team');
        const awayEl = teamEls[0];
        const homeEl = teamEls[1];
        [awayEl, homeEl].forEach(el => el && el.classList.remove('winner-final','tie-final'));
        if (isFinal && !isSuspended && awayEl && homeEl) {
          const aScore = Number(away?.score ?? 0);
          const hScore = Number(home?.score ?? 0);
          if (Number.isFinite(aScore) && Number.isFinite(hScore)) {
            if (aScore > hScore) {
              awayEl.classList.add('winner-final');
            } else if (hScore > aScore) {
              homeEl.classList.add('winner-final');
            } else {
              awayEl.classList.add('tie-final');
              homeEl.classList.add('tie-final');
            }
          }
        }
      })();

      if ((isLive || isFinal || isSuspended)) {
        matchCard.addEventListener('click', async () => {
          const existingOverlay = document.querySelector('.pbp-overlay');
          if (existingOverlay) existingOverlay.remove();

          const overlay = document.createElement('div');
          overlay.className = 'pbp-overlay';
          overlay.innerHTML = `
            <div class="pbp-card">
              <button class="close-pbp" aria-label="Cerrar">✕</button>
              <div class="tabs">
                <button class="tab-btn active" data-tab="pbp">Play-by-Play</button>
                <button class="tab-btn" data-tab="stats">Stats</button>
              </div>
              <div class="tab-content tab-pbp">Cargando jugadas...</div>
              <div class="tab-content tab-stats" style="display:none">Cargando estadísticas...</div>
            </div>
          `;
          document.body.appendChild(overlay);

          overlay.addEventListener('click', e => {
            if (e.target.classList.contains('close-pbp') || e.target.classList.contains('pbp-overlay')) {
              overlay.remove();
            }
          });

          // Tabs
          const tabBtns = overlay.querySelectorAll('.tab-btn');
          tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
              tabBtns.forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              overlay.querySelector('.tab-pbp').style.display = btn.dataset.tab === 'pbp' ? '' : 'none';
              overlay.querySelector('.tab-stats').style.display = btn.dataset.tab === 'stats' ? '' : 'none';
            });
          });

          // PLAY-BY-PLAY (NFL)
          try {
            const playsData = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${evt.id}/competitions/${evt.id}/plays?limit=300`).then(r => r.json());
            const plays = playsData.items || [];
            const highlightWords = [
              { word: 'two-minute warning', label: '2MW', style: 'color:#fff;background:#1b102f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #7521f3;' },
              { word: 'blocked', label: 'BLOCKED', style: 'color:#fff;background:#2f1010;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid#f35d21;' },
              { word: 'suspended', label: 'SUSPENDED', style: 'color:#fff;background:#2f1010;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f32121;' },
              { word: 'penalty', label: 'FLAG', style: 'color:#fff;background:#2f2a10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f3d321;' },
              { word: 'challenge', label: 'CHALLENGE', style: 'color:#fff;background:#C82333;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #C82333;' },
              { word: 'end game', label: 'FINAL', style: 'color:#fff;background:#10162f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #EF7C08;' },
              { word: 'reversed', label: 'R', style: 'color:#fff;background:#2f1e10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f38321;' },
              { word: 'touchdown', label: 'TD', style: 'color:#fff;background:#2f1e10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f38321;' },
              { word: 'fumble', label: 'FUM', style: 'color:#222;background:#FFEE5C;padding:0.1em 0.5em;border-radius:6px;font-weight:bold;font-size:.93em;' },
              { word: 'intercepted', label: 'INT', style: 'color:#fff;background:#C82333;padding:0.1em 0.5em;border-radius:6px;font-weight:bold;font-size:.93em;' },
              { word: 'timeout #', label: 'TO', style: 'color:#fff;background:#003366;padding:0.1em 0.5em;border-radius:6px;font-size:.91em;' },
              { word: 'official timeout', label: 'O.TO', style: 'color:#222;background:#d1d5db;padding:0.1em 0.5em;border-radius:6px;font-size:.91em;font-weight:normal;' },
              { word: 'end quarter', label: 'END Q', style: 'color:#fff;background:#10162f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #2196f3;' },
              { word: 'field goal is good', label: 'FG', style: 'color:#fff;background:#13B355;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;font-weight:bold;' },
              { word: 'field goal is no good', label: 'FG X', style: 'color:#fff;background:#C82333;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;font-weight:bold;' }
            ];
            const list = plays.reverse().map(p => {
              let tag = '';
              const playText = (p.text || '').toLowerCase();
              for (let h of highlightWords) {
                if (playText.includes(h.word)) { tag = `<span style="${h.style}">${h.label}</span>`; break; }
              }
              return `
                <li style="margin-bottom:4px;">
                  <span style="display:inline-block;min-width:44px;color:#2196F3;">${p.clock.displayValue || ''}</span>
                  ${tag ? tag + ' ' : ''}
                  <span>${p.text}</span>
                </li>`;
            }).join('');
            overlay.querySelector('.tab-pbp').innerHTML = `<ul class="pbp-list" style="margin:0;padding:0 0 0 10px;list-style:none;">${list}</ul>`;
          } catch {
            overlay.querySelector('.tab-pbp').innerHTML = `<p>Error loading plays.</p>`;
          }

          // STATS (NFL)
          try {
            const boxscoreUrl = `/api/espn-boxscore-cdn?gameId=${evt.id}`;
            const boxRes = await fetch(boxscoreUrl);
            const boxData = await boxRes.json();
            const teams = boxData.gamepackageJSON?.boxscore?.teams || [];
            if (teams.length !== 2) throw new Error("No team stats found.");

            const allLabels = [
              ...new Set([
                ...(teams[0].statistics || []).map(s => s.label),
                ...(teams[1].statistics || []).map(s => s.label)
              ])
            ].filter(Boolean);

            const getStatValue = (team, label) => {
              const s = (team.statistics || []).find(stat => stat.label === label);
              return s ? s.displayValue : '-';
            };

            const awayT = teams[0], homeT = teams[1];

            overlay.querySelector('.tab-stats').innerHTML = `
              <div class="apple-stats-comparative" style="width:100%;max-width:650px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                  <div style="text-align:center;flex:1;">
                    <img src="${getTeamLogoRaw(awayT.team)}" alt="${awayT.team.displayName}" style="height:48px;">
                    <div style="font-size:1em;font-weight:600;">${getTeamNameRaw(awayT.team)}</div>
                  </div>
                  <div style="flex:0 0 110px;text-align:center;font-size:1.2em;font-weight:600;opacity:.78;">STATS</div>
                  <div style="text-align:center;flex:1;">
                    <img src="${getTeamLogoRaw(homeT.team)}" alt="${homeT.team.displayName}" style="height:48px;">
                    <div style="font-size:1em;font-weight:600;">${getTeamNameRaw(homeT.team)}</div>
                  </div>
                </div>
                <table class="apple-comparison-table" style="width:100%;border-collapse:separate;border-spacing:0 4px;">
                  <tbody>
                  ${allLabels.map(label => `
                    <tr>
                      <td style="text-align:center;width:32%;font-weight:500;">${getStatValue(awayT, label)}</td>
                      <td style="text-align:center;width:36%;color:#bbb;font-size:.99em;">${label}</td>
                      <td style="text-align:center;width:32%;font-weight:500;">${getStatValue(homeT, label)}</td>
                    </tr>
                  `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          } catch (err) {
            overlay.querySelector('.tab-stats').innerHTML = `
              <div style="padding:24px;text-align:center;">
                <b>No stats available.</b>
                <br><small>${err.message}</small>
              </div>`;
          }
        });
      }

      matchesContainer.appendChild(matchCard);

      if (isLive) {
        matchCard.setAttribute('data-id', evt.id);
        // Initial placeholder for timeouts on live games
        renderTimeoutsInto(matchCard, away?.team, home?.team, 0, 0);
        if (liveIntervals[evt.id]) clearInterval(liveIntervals[evt.id]);
        liveIntervals[evt.id] = setInterval(() => {
          updateLiveGameCard(evt.id, matchCard);
        }, intervalMsForThisRender);
        updateLiveGameCard(evt.id, matchCard);
      } else {
        if (liveIntervals[evt.id]) {
          clearInterval(liveIntervals[evt.id]);
          delete liveIntervals[evt.id];
        }
      }
    });
  }

  function updateWeekFilterForSeasonType() {
    const weekFilter = document.getElementById('weekFilter');
    if (currentSeasonType === '1') {
      weekFilter.innerHTML = `
        <option value="1">HOF Game</option>
        <option value="2">Preseason Week 1</option>
        <option value="3">Preseason Week 2</option>
        <option value="4">Preseason Week 3</option>
      `;
    } else if (currentSeasonType === '2') {
      weekFilter.innerHTML = `
        ${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">Week ${i + 1}</option>`).join('')}
        <option value="all">All Weeks</option>
      `;
    } else if (currentSeasonType === '3') {
      weekFilter.innerHTML = `
        <option value="1">Wild Card</option>
        <option value="2">Divisional Round</option>
        <option value="3">Conference Championship</option>
        <option value="4">Super Bowl</option>
      `;
    }
    weekFilter.disabled = false;
    seasonTypeFilter.disabled = false;
  }

  function getWeekLabel(weekNumber) {
    if (currentSeasonType === '1') {
      switch (parseInt(weekNumber)) {
        case 1: return 'Hall of Fame Game';
        case 2: return 'Preseason Week 1';
        case 3: return 'Preseason Week 2';
        case 4: return 'Preseason Week 3';
        default: return 'Preseason';
      }
    }
    return `Week ${weekNumber}`;
  }

  // --- Toggle league (NFL only) ---
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.league !== 'nfl') return; // ignorar colegial
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeague = 'nfl';
      // Sync season/week using ESPN detector
      detectSeasonTypeAndWeek().then(detected => {
        if (detected?.seasonType) currentSeasonType = detected.seasonType;
        updateSeasonTypeFilterForLeague();
        updateWeekFilterForSeasonType();
        if (detected?.week && [...weekFilter.options].some(o => o.value === detected.week)) {
          weekFilter.value = detected.week;
        }
        renderMatches();
      }).catch(() => {
        updateSeasonTypeFilterForLeague();
        updateWeekFilterForSeasonType();
        renderMatches();
      });
    });
  });

  weekFilter.addEventListener('change', renderMatches);

  seasonTypeFilter.addEventListener('change', () => {
    currentSeasonType = seasonTypeFilter.value;
    updateWeekFilterForSeasonType();
    // If user manually changes season type, pick week 1 by default for that season
    const defaultWeek = currentSeasonType === '2' ? '1' : (currentSeasonType === '3' ? '1' : '1');
    if ([...weekFilter.options].some(o => o.value === defaultWeek)) {
      weekFilter.value = defaultWeek;
    }
    renderMatches();
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('.match-card').forEach(card => {
      const names = Array.from(card.querySelectorAll('.team-name')).map(n => n.textContent.toLowerCase());
      card.style.display = names.some(n => n.includes(term)) ? '' : 'none';
    });
  });

  initDefaultWeekAndRender();
  // Se eliminó la recarga automática de toda la página
  // Solo se mantiene la actualización de las tarjetas de partidos en vivo
});

async function updateLiveGameCard(gameId, card) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const comp = data.header?.competitions?.[0];
    if (!comp) return;

    const status = comp.status || {};
    const isLive = status.type?.state === 'in';

    const isSuspended =
      suspendedGames.has(String(gameId)) ||
      (status?.type?.name === 'STATUS_SUSPENDED') ||
      /suspend/i.test(status?.type?.description || '') ||
      /suspend/i.test(status?.type?.detail || '');

    let timeDisplay = '';
    if (isLive && status.period && status.displayClock) {
      timeDisplay = `Q${status.period} • ${status.displayClock}`;
    } else {
      const d = new Date(comp.date);
      const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      timeDisplay = `${date} | ${time}`;
    }
    const matchTime = card.querySelector('.match-time');
    if (matchTime) matchTime.textContent = timeDisplay;

    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');

    // Timeouts from ESPN summary (NFL)
    const sit = comp.situation || {};
    // ESPN commonly provides `homeTimeouts` and `awayTimeouts` in `situation` for NFL
    const awayRemain = typeof sit.awayTimeouts !== 'undefined' ? sit.awayTimeouts : (away?.timeouts ?? null);
    const homeRemain = typeof sit.homeTimeouts !== 'undefined' ? sit.homeTimeouts : (home?.timeouts ?? null);

    if (isLive && (awayRemain !== null || homeRemain !== null)) {
      renderTimeoutsInto(card, away?.team, home?.team, awayRemain ?? 0, homeRemain ?? 0);
    } else {
      const toC = card.querySelector('.timeouts-container');
      if (toC) toC.style.display = 'none';
    }

    const scoreSpans = card.querySelectorAll('.score');
    if (scoreSpans.length === 2) {
      scoreSpans[0].textContent = away?.score ?? '0';
      scoreSpans[1].textContent = home?.score ?? '0';
    }

    const matchHeader = card.querySelector('.match-header');
    if (matchHeader) {
      let badge = '';
      if (isSuspended) badge = '<div class="suspended-badge">SUSPENDED</div>';
      else if (isLive) badge = '<div class="live-badge">LIVE</div>';
      else if (status.type?.state === 'post') badge = '<div class="final-badge">FINAL</div>';
      matchHeader.innerHTML = `${badge}<span class="match-time">${timeDisplay}</span>`;
    }

    if (isSuspended || status.type?.state === 'post') {
      card.classList.toggle('suspended', isSuspended);
      card.classList.remove('live');
      const toC = card.querySelector('.timeouts-container');
      if (toC) toC.style.display = 'none';
      if (liveIntervals[gameId]) {
        clearInterval(liveIntervals[gameId]);
        delete liveIntervals[gameId];
      }
    }
  } catch (_) { /* silent */ }
}