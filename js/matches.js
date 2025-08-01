document.addEventListener('DOMContentLoaded', () => {
  const matchesContainer = document.getElementById('matchesContainer');
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const searchInput = document.getElementById('searchInput');
  const weekFilter = document.getElementById('weekFilter');
  const seasonTypeFilter = document.getElementById('seasonTypeFilter');

  let currentLeague = 'nfl';
  let currentSeasonType = '1';

  function getScheduleUrl(week, weekpre) {
    if (currentSeasonType === '1') {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=1&week=${weekpre}`;
    } else if (currentSeasonType === '2') {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=2&week=${week}`;
    } else {
      return `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2025&seasontype=3&week=${week}`;
    }
  }

  async function fetchWeekData(week) {
    const weekpre = week;
    const url = getScheduleUrl(week, weekpre);
    console.log("🌐 URL solicitada:", url);
  
    const res = await fetch(url);
    const data = await res.json();
  
    const events = data.events || [];
  
    console.log(`✅ Eventos recibidos (SeasonType ${currentSeasonType}):`, events.length, events.map(e => e.name));
  
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
      if (selectedWeek === 'all' && currentSeasonType !== '1') {
        const weekPromises = [];
        for (let i = 1; i <= 18; i++) {
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

    // ...el resto de tu código igual

// ... Lo de arriba igual ...

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

  // Time display: cuarto y tiempo si está en vivo
  let timeDisplay = `${date} | ${time}`;
  if (isLive && status.period && status.displayClock) {
    timeDisplay = `Q${status.period} • ${status.displayClock}`;
  }

  // Status badge: LIVE o FINAL
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
        <span class="score">${away?.score ?? '0'}</span>
      </div>
      <span class="vs-text">VS</span>
      <div class="team">
        <img src="${home?.team?.logo || ''}" class="team-logo">
        <span class="team-name">${home?.team?.displayName || 'TBD'}</span>
        <span class="score">${home?.score ?? '0'}</span>
      </div>
    </div>
    <div class="match-details">
      <p class="match-week">${getWeekLabel(weekNumber)}</p>
      <p class="match-stadium">@ ${comp.venue?.fullName || 'TBD'}</p>
    </div>`;

  // Permite modal tanto LIVE como FINAL
  if (comp?.playByPlayAvailable && (isLive || isFinal)) {
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

      // Cambiar tabs
      const tabBtns = overlay.querySelectorAll('.tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          overlay.querySelector('.tab-pbp').style.display = btn.dataset.tab === 'pbp' ? '' : 'none';
          overlay.querySelector('.tab-stats').style.display = btn.dataset.tab === 'stats' ? '' : 'none';
        });
      });

      // Play-by-play highlights
      try {
        const playsData = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${evt.id}/competitions/${evt.id}/plays?limit=300`).then(r => r.json());
        const plays = playsData.items || [];
        const highlightWords = [
          { word: 'two-minute warning', label: '2MW', style: 'color:#fff;background:#1b102f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #7521f3;' },
          { word: 'penalty', label: 'FLAG', style: 'color:#fff;background:#2f2a10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f3d321;' },
          { word: 'end game', label: 'FINAL', style: 'color:#fff;background:#10162f;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #EF7C08;' },
          { word: 'touchdown', label: 'TD', style: 'color:#fff;background:#2f1e10;padding:0.13em 0.7em;border-radius:6px;font-size:.98em;font-weight:bolder;letter-spacing:1px;border:2px solid #f38321;' },          { word: 'fumble', label: 'FUM', style: 'color:#222;background:#FFEE5C;padding:0.1em 0.5em;border-radius:6px;font-weight:bold;font-size:.93em;' },
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
        overlay.querySelector('.tab-pbp').innerHTML = `<ul style="margin:0;padding:0 0 0 10px;list-style:none;">${list}</ul>`;
      } catch {
        overlay.querySelector('.tab-pbp').innerHTML = `<p>Error loading plays.</p>`;
      }

      // --- STATS TAB ---
      try {
        // Usa la ruta de tu proxy a la CDN, o directo si es local
        const boxRes = await fetch(`/api/espn-boxscore-cdn?gameId=${evt.id}`);
        const boxData = await boxRes.json();
      
        const box = boxData.gamepackageJSON?.boxscore;
        const teams = box?.teams || [];
        if (!teams[0] || !teams[1]) throw new Error("No team stats found.");
      
        const teamNames = teams.map(t => t.team.displayName);
        const teamColors = ['#EF7C08', '#2196F3'];
      
        // --- TEAM STATS BAR ---
        const teamStatsDefs = [
          { label: 'Plays', key: 'totalOffensivePlays' },
          { label: '3rd Down Efficiency', key: 'thirdDownEff' },
          { label: 'Yards', key: 'totalYards' },
          { label: 'Yards per Play', key: 'yardsPerPlay' },
          { label: 'Passing Yards', key: 'netPassingYards' },
          { label: 'Rushing Yards', key: 'rushingYards' },
          { label: '1st Downs', key: 'firstDowns' },
          { label: 'Fumbles Lost', key: 'fumblesLost' },
          { label: 'Interceptions', key: 'interceptions' },
          { label: 'Penalties', key: 'totalPenaltiesYards', isPenalty: true },
          { label: 'Time of Possession', key: 'possessionTime', isTime: true }
        ];
      
        const getStatValue = (team, key, isPenalty, isTime) => {
          let stat = team.statistics?.find(s => s.name === key || s.label === key);
          if (!stat) {
            if (isPenalty) {
              stat = team.statistics?.find(s => s.name === "totalPenaltiesYards");
              return stat ? (stat.displayValue || "-").split('-') : ['-', '-'];
            }
            return "-";
          }
          if (isTime) return stat.displayValue || "-";
          return stat.displayValue || "-";
        };
      
        let teamStatsHTML = `<div class="team-stats-chart"><div style="text-align:center;color:#fff;font-size:1.12em;margin-bottom:6px;font-weight:600;">Team Stats</div>`;
        teamStatsDefs.forEach(def => {
          let v0 = getStatValue(teams[0], def.key, def.isPenalty, def.isTime);
          let v1 = getStatValue(teams[1], def.key, def.isPenalty, def.isTime);
          let statLabel = def.label;
          let valA = v0, valB = v1;
          if (def.isPenalty) {
            valA = v0[0]; valB = v1[0];
            statLabel = "Penalties";
          }
          if (def.label === "Time of Possession") {
            valA = v0; valB = v1;
          }
          let numA = isNaN(Number(valA)) ? 0 : Number(valA);
          let numB = isNaN(Number(valB)) ? 0 : Number(valB);
          if (def.isTime) {
            const tSec = s => {
              if (typeof s !== 'string' || !s.includes(':')) return 0;
              const [min, sec] = s.split(':');
              return parseInt(min, 10)*60 + parseInt(sec, 10);
            };
            numA = tSec(valA); numB = tSec(valB);
          }
          let pctA = 0, pctB = 0, sum = numA + numB;
          if (sum > 0) {
            pctA = Math.round((numA / sum) * 100);
            pctB = Math.round((numB / sum) * 100);
          }
          if (def.label === "Yards per Play") {
            pctA = Math.min(100, Math.round(numA * 10));
            pctB = Math.min(100, Math.round(numB * 10));
          }
          teamStatsHTML += `
            <div class="team-stats-row">
              <span class="stat-value teamA" style="color:${teamColors[0]}">${valA}</span>
              <span class="stat-label">${statLabel}</span>
              <span class="stat-value teamB" style="color:${teamColors[1]}">${valB}</span>
              <div class="bar">
                <div class="bar-a" style="width:${pctA}%;background:${teamColors[0]}"></div>
                <div class="bar-b" style="width:${pctB}%;background:${teamColors[1]}"></div>
              </div>
            </div>
          `;
          if (def.isPenalty) {
            let yardsA = parseInt(v0[1]) || 0, yardsB = parseInt(v1[1]) || 0;
            let yardsSum = yardsA + yardsB || 1;
            teamStatsHTML += `
              <div class="team-stats-row">
                <span class="stat-value teamA" style="color:${teamColors[0]}">${v0[1]}</span>
                <span class="stat-label">Penalty Yards</span>
                <span class="stat-value teamB" style="color:${teamColors[1]}">${v1[1]}</span>
                <div class="bar">
                  <div class="bar-a" style="width:${Math.round((yardsA/yardsSum)*100)}%;background:${teamColors[0]}"></div>
                  <div class="bar-b" style="width:${Math.round((yardsB/yardsSum)*100)}%;background:${teamColors[1]}"></div>
                </div>
              </div>
            `;
          }
        });
        teamStatsHTML += "</div>";
      
        // --- PLAYER STATS TABLES ---
const categories = [
  { key: "passing", label: "Passing", cols: ["C/ATT", "YDS", "AVG", "TD", "INT"] },
  { key: "rushing", label: "Rushing", cols: ["CAR", "YDS", "AVG", "TD", "LONG"] },
  { key: "receiving", label: "Receiving", cols: ["REC", "YDS", "AVG", "TD", "LONG"] },
  { key: "kicking", label: "Kicking", cols: ["FG", "PCT", "LONG", "XP", "PTS"] },
  { key: "punting", label: "Punting", cols: ["PUNTS", "AVG", "I20", "TD", "LONG"] }
];

// Aquí buscamos si los datos existen en otra estructura
let playerStats = [];
if (box?.players?.length) {
  playerStats = box.players.map(t => ({
    team: t.team?.displayName || '',
    teamAbbr: t.team?.abbreviation || '',
    categories: t.statistics || []
  }));
} else if (boxData.gamepackageJSON?.playerStats) {
  // Fallback: a veces está en boxData.gamepackageJSON.playerStats
  playerStats = (boxData.gamepackageJSON.playerStats.teams || []).map(t => ({
    team: t.team?.displayName || '',
    teamAbbr: t.team?.abbreviation || '',
    categories: t.categories || []
  }));
}

let playerStatsHTML = "";
categories.forEach(cat => {
  playerStatsHTML += `<div class="player-stats-section"><h3>${cat.label}</h3>`;
  playerStats.forEach((t, i) => {
    // ESPN cambia el key: a veces name, a veces displayName
    const statObj = t.categories.find(s => 
      (s.name && s.name.toLowerCase() === cat.key) ||
      (s.displayName && s.displayName.toLowerCase() === cat.label.toLowerCase())
    );
    playerStatsHTML += `<div class="team-name" style="color:${teamColors[i]}">${t.team}</div>`;
    playerStatsHTML += `<table class="player-stats-table"><thead><tr><th>Player</th>`;
    cat.cols.forEach(col => playerStatsHTML += `<th>${col}</th>`);
    playerStatsHTML += `</tr></thead><tbody>`;
    if (statObj && Array.isArray(statObj.names) && Array.isArray(statObj.labels) && Array.isArray(statObj.statistics)) {
      for (let idx = 0; idx < statObj.names.length; idx++) {
        playerStatsHTML += `<tr><td>${statObj.names[idx]}</td>`;
        cat.cols.forEach(col => {
          const colIdx = statObj.labels.indexOf(col);
          let stat = (colIdx !== -1 && Array.isArray(statObj.statistics[colIdx])) ? statObj.statistics[colIdx][idx] : '-';
          if (stat === undefined) stat = '-';
          playerStatsHTML += `<td>${stat}</td>`;
        });
        playerStatsHTML += `</tr>`;
      }
    } else {
      playerStatsHTML += `<tr><td colspan="${cat.cols.length+1}" style="text-align:center;">-</td></tr>`;
    }
    playerStatsHTML += `</tbody></table>`;
  });
  playerStatsHTML += `</div>`;
});

      
        overlay.querySelector('.tab-stats').innerHTML = `
          ${teamStatsHTML}
          ${playerStatsHTML}
        `;
      } catch (err) {
        overlay.querySelector('.tab-stats').innerHTML = `<p style="padding:32px;text-align:center;">No stats available.<br><small>${err.message}</small></p>`;
      }
      
      
    });
  }

  matchesContainer.appendChild(matchCard);
});

// ... Lo de abajo igual ...


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

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLeague = btn.dataset.league;
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

  updateWeekFilterForSeasonType();
  renderMatches();
  setInterval(() => {
    const scrollY = window.scrollY; // guarda posición actual
    renderMatches().then(() => {
      window.scrollTo(0, scrollY); // restaura posición para que no "salte"
    });
  }, 60000);
});