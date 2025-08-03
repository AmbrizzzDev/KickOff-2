document.addEventListener('DOMContentLoaded', () => {
  const matchesContainer = document.getElementById('matchesContainer');
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const searchInput = document.getElementById('searchInput');
  const weekFilter = document.getElementById('weekFilter');
  const seasonTypeFilter = document.getElementById('seasonTypeFilter');

  let currentLeague = 'nfl'; // DEFAULT: NFL
  let currentSeasonType = '1';

  // Dynamic update of seasonTypeFilter based on league
  function updateSeasonTypeFilterForLeague() {
    if (currentLeague === 'nfl') {
      seasonTypeFilter.innerHTML = `
        <option value="1">Preseason</option>
        <option value="2">Regular Season</option>
        <option value="3">Postseason</option>
      `;
    } else {
      seasonTypeFilter.innerHTML = `
        <option value="2">Regular Season</option>
        <option value="3">Postseason</option>
      `;
    }
    // Set value to currentSeasonType if possible, else default to first option
    if ([...seasonTypeFilter.options].some(opt => opt.value === currentSeasonType)) {
      seasonTypeFilter.value = currentSeasonType;
    } else {
      currentSeasonType = seasonTypeFilter.options[0].value;
      seasonTypeFilter.value = currentSeasonType;
    }
  }

  // Marcar NFL como activo al inicio
  document.querySelector('.toggle-btn[data-league="nfl"]').classList.add('active');

  function getScheduleUrl(week, weekpre) {
    if (currentLeague === 'nfl') {
      if (currentSeasonType === '1') {
        return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=1&week=${weekpre}`;
      } else if (currentSeasonType === '2') {
        return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`;
      } else {
        return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=${week}`;
      }
    } else {
      // NCAA: ahora soporta regular season y bowls (postseason)
      if (currentSeasonType === '2') {
        return `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2025&seasontype=2&week=${week}`;
      } else if (currentSeasonType === '3') {
        return `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2025&seasontype=3&week=${week}`;
      }
      // Por default, regular season week 1
      return `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=2025&seasontype=2&week=1`;
    }
  }

  async function fetchWeekData(week) {
    const weekpre = week;
    const url = getScheduleUrl(week, weekpre);
    console.log("🌐 URL solicitada:", url);

    const res = await fetch(url);
    const data = await res.json();
    const events = data.events || [];

    console.log(`✅ Eventos recibidos (${currentLeague}):`, events.length, events.map(e => e.name));

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

    try {
      if (selectedWeek === 'all' && currentSeasonType !== '1' && currentLeague === 'nfl') {
        const weekPromises = [];
        for (let i = 1; i <= 18; i++) {
          weekPromises.push(fetchWeekData(i));
        }
        const allWeeks = await Promise.all(weekPromises);
        allGames = allWeeks.flat();
      } else if (selectedWeek === 'all' && currentLeague === 'cfb' && currentSeasonType === '2') {
        // All weeks para NCAA regular season (16)
        const weekPromises = [];
        for (let i = 1; i <= 16; i++) {
          weekPromises.push(fetchWeekData(i));
        }
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

    allGames.forEach(evt => {
      const comp = evt.competitions[0];
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      const status = comp.status || {};
      const isLive = status.type?.state === 'in';
      const isFinal = status.type?.state === 'post';
      const d = new Date(evt.date);
      const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const weekNumber = evt.week?.number || 'N/A';

      let timeDisplay = `${date} | ${time}`;
      if (isLive && status.period && status.displayClock) {
        timeDisplay = `Q${status.period} • ${status.displayClock}`;
      }

      let statusBadge = '';
      if (isLive) statusBadge = '<div class="live-badge">LIVE</div>';
      else if (isFinal) statusBadge = '<div class="final-badge">FINAL</div>';

      const matchCard = document.createElement('div');
      matchCard.className = `match-card ${isLive ? 'live' : ''} ${isFinal ? 'final' : ''}`;
      matchCard.innerHTML = `
        <div class="match-header">
          ${statusBadge}
          <span class="match-time">${timeDisplay}</span>
        </div>
        <div class="teams-container">
          <div class="team">
            <img src="${away?.team?.logo || ''}" class="team-logo">
            <span class="team-name">${away?.team?.displayName || 'TBD'}</span>
            ${(isLive || isFinal) ? `<span class="score">${away?.score ?? '0'}</span>` : ''}
          </div>
          <span class="vs-text">VS</span>
          <div class="team">
            <img src="${home?.team?.logo || ''}" class="team-logo">
            <span class="team-name">${home?.team?.displayName || 'TBD'}</span>
            ${(isLive || isFinal) ? `<span class="score">${home?.score ?? '0'}</span>` : ''}
          </div>
        </div>
        <div class="match-details">
          <p class="match-week">${getWeekLabel(weekNumber)}</p>
          <p class="match-stadium">@ ${comp.venue?.fullName || 'TBD'}</p>
        </div>`;

        if ((isLive || isFinal)) {
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
  
            // PLAY-BY-PLAY TAB
            if (currentLeague === 'nfl') {
              try {
                const playsData = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${evt.id}/competitions/${evt.id}/plays?limit=300`).then(r => r.json());
                const plays = playsData.items || [];
                const highlightWords = [
                  { word: 'two-minute warning', label: '2MW', style: 'color:#fff;background:#1b102f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #7521f3;' },
                  { word: 'penalty', label: 'FLAG', style: 'color:#fff;background:#2f2a10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f3d321;' },
                  { word: 'end game', label: 'FINAL', style: 'color:#fff;background:#10162f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #EF7C08;' },
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
                    if (playText.includes(h.word)) {
                      tag = `<span style="${h.style}">${h.label}</span>`;
                      break;
                    }
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
            } else {
              // NCAA: no hay play-by-play (oficial)
              overlay.querySelector('.tab-pbp').innerHTML = `<p style="padding:32px;text-align:center;">No play-by-play available for college football games.</p>`;
            }
  
// STATS TAB (Apple Sports style, centrado, sin barras)
try {
  const boxscoreUrl = currentLeague === 'nfl'
    ? `/api/espn-boxscore-cdn?gameId=${evt.id}`
    : `https://site.api.espn.com/apis/site/v2/sports/football/college-football/boxscore?event=${evt.id}`;
  const boxRes = await fetch(boxscoreUrl);
  const boxData = await boxRes.json();
  const teams = currentLeague === 'nfl'
    ? boxData.gamepackageJSON?.boxscore?.teams || []
    : boxData.boxscore?.teams || [];
  if (teams.length !== 2) throw new Error("No team stats found.");

  // Mostrar todos los stats posibles de cada equipo
  function getStatsTable(team) {
    if (!team.statistics || !team.statistics.length) return '';
    return `
      <table class="apple-stats-table" style="margin: 0 auto;">
        <thead>
          <tr>
            <th style="text-align:center;">Stat</th>
            <th style="text-align:center;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${team.statistics.map(stat => `
            <tr>
              <td style="text-align:center;">${stat.label}</td>
              <td style="text-align:center;">${stat.displayValue}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const home = teams[1], away = teams[0];

  overlay.querySelector('.tab-stats').innerHTML = `
    <div class="apple-stats-header" style="display: flex; justify-content: center; align-items: flex-start; gap: 32px; flex-wrap: wrap;">
      <div class="apple-team apple-left" style="flex:1; min-width:220px; text-align:center;">
        <img src="${away.team.logo}" alt="${away.team.displayName}" class="apple-team-logo" style="height:56px;margin-bottom:8px;"/>
        <div class="apple-team-name" style="font-weight:bold;font-size:1.15em;margin-bottom:10px;">${away.team.displayName}</div>
        ${getStatsTable(away)}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;font-size:1.5em;font-weight:bold;min-width:40px;">VS</div>
      <div class="apple-team apple-right" style="flex:1; min-width:220px; text-align:center;">
        <img src="${home.team.logo}" alt="${home.team.displayName}" class="apple-team-logo" style="height:56px;margin-bottom:8px;"/>
        <div class="apple-team-name" style="font-weight:bold;font-size:1.15em;margin-bottom:10px;">${home.team.displayName}</div>
        ${getStatsTable(home)}
      </div>
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
          // Evita múltiples intervalos para el mismo partido
          if (liveIntervals[evt.id]) clearInterval(liveIntervals[evt.id]);
          liveIntervals[evt.id] = setInterval(() => {
            updateLiveGameCard(evt.id, matchCard);
          }, 20000);
        } else {
          // Si el partido ya no está en vivo, limpia el intervalo
          if (liveIntervals[evt.id]) {
            clearInterval(liveIntervals[evt.id]);
            delete liveIntervals[evt.id];
          }
        }
      });
    }

    

  function updateWeekFilterForSeasonType() {
    const weekFilter = document.getElementById('weekFilter');
    if (currentLeague === 'nfl') {
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
    } else {
      // NCAA: Regular Season y Postseason (Bowls)
      if (currentSeasonType === '2') {
        weekFilter.innerHTML = `
          ${Array.from({ length: 16 }, (_, i) => `<option value="${i + 1}">Week ${i + 1}</option>`).join('')}
          <option value="all">All Weeks</option>
        `;
      } else if (currentSeasonType === '3') {
        // Los bowls tienen week 1,2,3... pero en la práctica ESPN te los pone como week=1,2,3
        weekFilter.innerHTML = `
          <option value="1">Bowls</option>
        `;
      }
      weekFilter.disabled = false;
      seasonTypeFilter.disabled = false;
    }
  }

  function getWeekLabel(weekNumber) {
    if (currentLeague === 'nfl') {
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
    } else {
      if (currentSeasonType === '2') return `Week ${weekNumber}`;
      if (currentSeasonType === '3') return `Bowls Week ${weekNumber}`;
      return 'NCAA';
    }
  }

  // --- Toggle league ---
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeague = btn.dataset.league;
      // Si cambias a NCAA, cambia default a regular season
      if (currentLeague === 'cfb') currentSeasonType = '2';
      else currentSeasonType = '1';
      updateSeasonTypeFilterForLeague();
      updateWeekFilterForSeasonType();
      renderMatches();
    });
  });

  weekFilter.addEventListener('change', renderMatches);

  seasonTypeFilter.addEventListener('change', () => {
    currentSeasonType = seasonTypeFilter.value;
    updateWeekFilterForSeasonType();
    renderMatches();
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('.match-card').forEach(card => {
      const names = Array.from(card.querySelectorAll('.team-name')).map(n => n.textContent.toLowerCase());
      card.style.display = names.some(n => n.includes(term)) ? '' : 'none';
    });
  });

  

  updateSeasonTypeFilterForLeague();
  updateWeekFilterForSeasonType();
  renderMatches();
  setInterval(() => {
    const scrollY = window.scrollY;
    renderMatches().then(() => {
      window.scrollTo(0, scrollY);
    });
  }, 60000);
});

const liveIntervals = {};

function updateLiveGameCard(gameId, card, league) {
  // Clean previous interval for this card if any
  if (liveIntervals[gameId]) {
    clearInterval(liveIntervals[gameId]);
  }
  async function update() {
    let url;
    if (league === 'nfl') {
      url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
    } else {
      url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${gameId}`;
    }
    try {
      const res = await fetch(url);
      const data = await res.json();
      const comp = data.header?.competitions?.[0];
      if (!comp) return;
      const status = comp.status || {};
      const isLive = status.type?.state === 'in';
      // Update time display
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
      // Update scores
      const home = comp.competitors.find(c => c.homeAway === 'home');
      const away = comp.competitors.find(c => c.homeAway === 'away');
      const scoreSpans = card.querySelectorAll('.score');
      if (scoreSpans.length === 2) {
        scoreSpans[0].textContent = away?.score ?? '0';
        scoreSpans[1].textContent = home?.score ?? '0';
      }
      // Update badge
      const matchHeader = card.querySelector('.match-header');
      if (matchHeader) {
        let badge = '';
        if (isLive) badge = '<div class="live-badge">LIVE</div>';
        else if (status.type?.state === 'post') badge = '<div class="final-badge">FINAL</div>';
        matchHeader.innerHTML = `${badge}<span class="match-time">${timeDisplay}</span>`;
      }
    } catch (e) {
      // Ignore update errors
    }
  }
  update();
  liveIntervals[gameId] = setInterval(update, 20000);
}