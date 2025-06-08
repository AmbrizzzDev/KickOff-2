document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('newsContainer');
  const NEWS_LIMIT = 28;

  // Listado de deportes que NO queremos
  const blacklist = [
    'NHL', 'MLB', 'NBA', 'NCAAM', 'NCAAF', 'NASCAR', 'Soccer', 'F1', 'Golf', 'Tennis', 'Boxing'
  ];

  const res = await fetch('https://now.core.api.espn.com/v1/sports/news?limit=1000&sport=football');
  const data = await res.json();
  const headlines = data.headlines || [];

  // Filtro más estricto: SOLO noticias NFL, sin mezclas
  const nflHeadlines = headlines.filter(item => {
    if (!item.categories) return false;
    // Si alguna categoría está en la blacklist, descartamos la noticia
    const hasBlacklisted = item.categories.some(cat => 
      cat.description && blacklist.includes(cat.description.trim().toUpperCase())
    );
    // Solo mostramos si NO hay ninguna de la blacklist y SÍ tiene NFL
    const hasNFL = item.categories.some(cat =>
      cat.description && cat.description.trim().toUpperCase() === 'NFL'
    );
    return hasNFL && !hasBlacklisted;
  });

  if (!nflHeadlines.length) {
    container.innerHTML = '<p>No NFL news available.</p>';
    return;
  }

  nflHeadlines.slice(0, NEWS_LIMIT).forEach(item => {
    const img = item.images?.[0]?.url || item.video?.[0]?.posterImages?.default?.href || 'img/placeholder.jpg';
    const title = item.title || item.headline || 'Untitled';
    const shortDesc = item.description || '';
    const link = item.links?.web?.href || '#';

    // News Card
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `
      <img src="${img}" alt="News image" class="news-img">
      <div class="news-content">
        <h3 class="news-title">${title}</h3>
        <p class="news-description">${shortDesc}</p>
        <button class="read-more-btn">Read More</button>
      </div>
    `;

    const btn = card.querySelector('.read-more-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.open(link, '_blank');
    });

    container.appendChild(card);
  });
});

const bestReveals = [
  {
    team: "Chargers",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lac.png",
    reveal: "Minecraft Schedule",
    link: "https://youtu.be/R6qi8BELUA0?si=R5ZBlPXvXt-GoV7D",
  },
  {
    team: "Colts",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ind.png",
    reveal: "Minecraft Schedule (Deleted)",
    link: "https://youtu.be/zSsxBM30tmE?si=HL0SLP2weh7dMFoX",
  },
  {
    team: "Falcons",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/atl.png",
    reveal: "Welcome to ATL Kart",
    link: "https://youtu.be/x7PJLS9NBm0?si=lvNsPf3WXrXghzgU",
  },
  {
    team: "Texans",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/hou.png",
    reveal: "WAZZUPPPPPP",
    link: "https://youtu.be/ifvSa50l1hQ?si=v3Pd09feZoOS6zdl",
  },
  {
    team: "Commanders",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/wsh.png",
    reveal: "Time to Ride 🎢",
    link: "https://youtu.be/b5bP0HiqsVI?si=3yJhKcgdUeNjAMCX",
  },
  {
    team: "Rams",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lar.png",
    reveal: "Brenda Song's",
    link: "https://youtu.be/Pf-53HvSnN8?si=SrPuoyX4m92JK8bI",
  },
  {
    team: "Jaguars",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/jax.png",
    reveal: "Morning Routine",
    link: "https://youtu.be/CLREhVAV2Cw?si=yK-gAb9vSYI2j_Tc",
  },
  {
    team: "49ers",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sf.png",
    reveal: "Golden Trail",
    link: "https://youtu.be/7bF1VPmBgFo?si=ULmugB57upLJd7a0",
  },
  {
    team: "Seahawks",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sea.png",
    reveal: "Unbox the Action",
    link: "https://youtu.be/ifvSa50l1hQ?si=v3Pd09feZoOS6zdl",
  },
  {
    team: "Cardinals",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ari.png",
    reveal: "18 BARS",
    link: "https://x.com/AZCardinals/status/1922804169309638687",
  }
];

function renderReveals() {
  const grid = document.getElementById('revealGrid');
  grid.innerHTML = bestReveals.map(reveal => `
    <div class="reveal-card">
      <img src="${reveal.logo}" alt="${reveal.team} logo">
      <div class="reveal-team">${reveal.team}</div>
      <button class="reveal-link" data-link="${reveal.link}">Watch Reveal</button>
      <div style="font-size: 0.72rem; color: #bbb; margin-top: 0.15rem;">${reveal.reveal}</div>
    </div>
  `).join('');

  // Agrega los listeners para que funcionen como links
  grid.querySelectorAll('.reveal-link').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const link = btn.getAttribute('data-link');
      if (link) window.open(link, '_blank', 'noopener');
    });
  });
}
renderReveals();
