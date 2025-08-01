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

allGames.forEach(evt => {
  const comp = evt.competitions[0];
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');
  const status = comp.status || {};
  const live = status.type?.state === 'in';
  const d = new Date(evt.date);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const weekNumber = evt.week?.number || 'N/A';

  // NUEVO: Si el partido está en vivo, muestra cuarto y tiempo
  let timeDisplay = `${date} | ${time}`;
  if (live && status.period && status.displayClock) {
    timeDisplay = `Q${status.period} • ${status.displayClock}`;
  }

  const matchCard = document.createElement('div');
  matchCard.className = `match-card ${live ? 'live' : ''}`;
  matchCard.innerHTML = `
    <div class="match-header">
      ${live ? '<div class="live-badge">LIVE</div>' : ''}
      <span class="match-time">${timeDisplay}</span>
    </div>
    <div class="teams-container">
      <div class="team">
        <img src="${away?.team?.logo || ''}" class="team-logo">
        <span class="team-name">${away?.team?.displayName || 'TBD'}</span>
        ${live ? `<span class="score">${away?.score || '0'}</span>` : ''}
      </div>
      <span class="vs-text">VS</span>
      <div class="team">
        <img src="${home?.team?.logo || ''}" class="team-logo">
        <span class="team-name">${home?.team?.displayName || 'TBD'}</span>
        ${live ? `<span class="score">${home?.score || '0'}</span>` : ''}
      </div>
    </div>
    <div class="match-details">
      <p class="match-week">${getWeekLabel(weekNumber)}</p>
      <p class="match-stadium">@ ${comp.venue?.fullName || 'TBD'}</p>
    </div>`;

  // Solo abrir el modal si está en vivo
  if (comp?.playByPlayAvailable && live) {
    matchCard.addEventListener('click', async () => {
      // Solo para partidos en vivo
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
    
      // Cerrar modal
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
    
      // Play-by-play con jugadas clave simples
      try {
        const playsData = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${evt.id}/competitions/${evt.id}/plays?limit=300`).then(r => r.json());
        const plays = playsData.items || [];
        const highlightWords = [
          { word: 'touchdown', label: 'TD', style: 'color:#fff;background:#EF7C08;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;' },
          { word: 'interception', label: 'INT', style: 'color:#fff;background:#C82333;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;' },
          { word: 'fumble', label: 'FUM', style: 'color:#333;background:#FFEE5C;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;' },
          { word: 'field goal', label: 'FG', style: 'color:#fff;background:#13B355;padding:0.1em 0.5em;border-radius:6px;font-size:.93em;' }
        ];
        const list = plays.reverse().map(p => {
          let tag = '';
          for (let h of highlightWords) {
            if (p.text && p.text.toLowerCase().includes(h.word)) {
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
        overlay.querySelector('.tab-pbp').innerHTML = `<p>Error cargando jugadas.</p>`;
      }
    
  // --- STATS TAB, CORRECT, ENGLISH, ROBUST, SAFE ---
  try {
    // 1. Pide stats al proxy de Vercel (usa gameId, no event)
    const boxRes = await fetch(`/api/espn-boxscore-cdn?gameId=${evt.id}`);
    const boxData = await boxRes.json();
  
    // 2. Busca equipos y stats
    const teams = boxData.gamepackageJSON?.boxscore?.teams || [];
    if (teams.length !== 2) throw new Error("No team stats found.");
  
    // 3. Labels de stats a mostrar (puedes cambiar los que quieras)
    const statsList = [
      "Total Yards",
      "Passing",
      "Rushing",
      "Turnovers",
      "1st Downs"
    ];
  
    // 4. Nombres de equipos
    const teamNames = teams.map(t => t.team.displayName);
  
    // 5. Extrae los valores de cada stat para graficar
    const values = statsList.map(label =>
      teams.map(team => {
        const stat = team.statistics.find(s => s.label === label);
        // Algunos stats pueden venir como texto o "-"
        return stat ? parseInt((stat.displayValue || "0").replace(/,/g, '')) || 0 : 0;
      })
    );
  
    // 6. Inserta el canvas y leyenda
    overlay.querySelector('.tab-stats').innerHTML = `
      <canvas id="statsChart" width="320" height="170"></canvas>
      <div style="text-align:center;margin-top:8px;font-size:.96em;">
        <span style="color:#2196F3;">${teamNames[0]}</span> vs <span style="color:#EF7C08;">${teamNames[1]}</span>
      </div>
    `;
  
    // 7. Dibuja la gráfica
    setTimeout(() => {
      const ctx = document.getElementById('statsChart').getContext('2d');
      if (window.statsChartInstance) window.statsChartInstance.destroy();
      window.statsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: statsList,
          datasets: [
            {
              label: teamNames[0],
              data: values.map(v => v[0]),
              backgroundColor: '#2196F3'
            },
            {
              label: teamNames[1],
              data: values.map(v => v[1]),
              backgroundColor: '#EF7C08'
            }
          ]
        },
        options: {
          responsive: false,
          plugins: { legend: { display: true, position: 'top' } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }, 60);
  
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