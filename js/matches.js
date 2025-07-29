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

      const matchCard = document.createElement('div');
      matchCard.className = `match-card ${live ? 'live' : ''}`;
      matchCard.innerHTML = `
        <div class="match-header">
          ${live ? '<div class="live-badge">LIVE</div>' : ''}
          <span class="league-tag">NFL</span>
          <span class="match-time">${date} | ${time}</span>
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

      if (comp?.playByPlayAvailable) {
        matchCard.addEventListener('click', async () => {
          const existingOverlay = document.querySelector('.pbp-overlay');
          if (existingOverlay) existingOverlay.remove();

          const overlay = document.createElement('div');
          overlay.className = 'pbp-overlay';
          overlay.innerHTML = `<div class="pbp-card"><h3>${evt.name}</h3><button class="close-pbp">✖</button><p>Cargando jugadas...</p></div>`;
          document.body.appendChild(overlay);

          overlay.querySelector('.close-pbp').addEventListener('click', () => overlay.remove());

          try {
            const playsData = await fetch(`https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${evt.id}/competitions/${evt.id}/plays?limit=300`).then(r => r.json());
            const list = (playsData.items || []).map(p => `<li><strong>${p.clock.displayValue}</strong> - ${p.text}</li>`).join('');
            overlay.querySelector('.pbp-card').innerHTML = `<h3>${evt.name}</h3><button class="close-pbp">✖</button><ul class="pbp-list">${list}</ul>`;
          } catch {
            overlay.querySelector('.pbp-card').innerHTML += `<p>Error loading play-by-play.</p>`;
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
    } else {
      weekFilter.innerHTML = `
        <option value="all" selected>All Weeks</option>
        ${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">Week ${i + 1}</option>`).join('')}
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