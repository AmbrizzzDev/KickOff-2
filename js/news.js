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
    reveal: "Minecraft",
    link: "https://x.com/chargers/status/1922804518250582232",
  },
  {
    team: "Falcons",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/atl.png",
    reveal: "ATL Kart 25",
    link: "https://x.com/AtlantaFalcons/status/1922804130956910886",
  },
  {
    team: "Rams",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lar.png",
    reveal: "BRENDA. KNOWS. BALL.",
    link: "https://x.com/RamsNFL/status/1922804137617436776",
  },
  {
    team: "Jaguars",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/jax.png",
    reveal: "Schedule Release Routine",
    link: "https://x.com/Jaguars/status/1922807022606602280",
  },
  {
    team: "Cardinals",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ari.png",
    reveal: "18 BARS",
    link: "https://x.com/AZCardinals/status/1922804169309638687",
  },
  {
    team: "49ers",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sf.png",
    reveal: "8-bit Game",
    link: "https://x.com/49ers/status/1922804129870615001",
  },
  {
    team: "Seahawks",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/sea.png",
    reveal: "Unbox the Action",
    link: "https://x.com/Seahawks/status/1922804559044542836",
  },
  {
    team: "Commanders",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/wsh.png",
    reveal: "Tycoon",
    link: "https://x.com/Commanders/status/1922804118491726175",
  },
  {
    team: "Colts",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ind.png",
    reveal: "Schedule Art",
    link: "https://x.com/Colts/status/1922807524270473477",
  },
  {
    team: "Patriots",
    logo: "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ne.png",
    reveal: "Emergency Press Conference",
    link: "https://x.com/Patriots/status/1922804125319954841",
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
