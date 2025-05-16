// matches.js actualizado con número de semana en la card
document.addEventListener('DOMContentLoaded', () => {
  const matchesContainer = document.getElementById('matchesContainer');
  const toggleButtons = document.querySelectorAll('.toggle-btn');
  const searchInput = document.getElementById('searchInput');
  const weekFilter = document.getElementById('weekFilter');

  let currentLeague = 'nfl';

  function getScheduleUrl(week) {
    return `https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2025&week=${week}`;
  }

  async function fetchPlays(gameId) {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${gameId}/competitions/${gameId}/plays?limit=300`;
    const res = await fetch(url);
    return res.json();
  }

  async function fetchWeekData(week) {
    const url = getScheduleUrl(week);
    const res = await fetch(url);
    const data = await res.json();

    const dates = Object.keys(data.content.schedule || {});
    let games = [];
    for (const date of dates) {
      const dayGames = data.content.schedule[date].games || [];
      games = games.concat(dayGames);
    }
    return games;
  }

  async function renderMatches() {
    matchesContainer.innerHTML = '';
    const selectedWeek = weekFilter.value;
    let allGames = [];

    try {
      if (selectedWeek === 'all') {
        const weekPromises = [];
        for (let i = 1; i <= 17; i++) {
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
            <img src="${away.team.logo}" class="team-logo">
            <span class="team-name">${away.team.displayName}</span>
            ${live ? `<span class="score">${away.score || '0'}</span>` : ''}
          </div>
          <span class="vs-text">VS</span>
          <div class="team">
            <img src="${home.team.logo}" class="team-logo">
            <span class="team-name">${home.team.displayName}</span>
            ${live ? `<span class="score">${home.score || '0'}</span>` : ''}
          </div>
        </div>
        <div class="match-details">
          <p class="match-week">Week ${weekNumber}</p>
          <p class="match-stadium">@ ${comp.venue?.fullName || 'TBD'}</p>
        </div>`;

      matchCard.addEventListener('click', async () => {
        const existingOverlay = document.querySelector('.pbp-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.className = 'pbp-overlay';
        overlay.innerHTML = `<div class="pbp-card"><h3>${evt.name}</h3><button class="close-pbp">✖</button><p>Cargando jugadas...</p></div>`;
        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('.close-pbp');
        closeBtn.addEventListener('click', () => overlay.remove());

        try {
          const playsData = await fetchPlays(evt.id);
          const items = playsData.items || [];
          const list = items.map(p => `<li><strong>${p.clock.displayValue}</strong> - ${p.text}</li>`).join('');
          overlay.querySelector('.pbp-card').innerHTML = `<h3>${evt.name}</h3><button class="close-pbp">✖</button><ul class="pbp-list">${list}</ul>`;
          overlay.querySelector('.close-pbp').addEventListener('click', () => overlay.remove());
        } catch {
          overlay.querySelector('.pbp-card').innerHTML += `<p>Error loading play-by-play.</p>`;
        }
      });

      matchesContainer.appendChild(matchCard);
    });
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

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll('.match-card').forEach(card => {
      const names = Array.from(card.querySelectorAll('.team-name')).map(n => n.textContent.toLowerCase());
      card.style.display = names.some(n => n.includes(term)) ? '' : 'none';
    });
  });

  renderMatches();
  setInterval(renderMatches, 60000);
});