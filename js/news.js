document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('newsContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const NEWS_LIMIT = 12;
  const LOAD_INCREMENT = 12;

  let currentIndex = 0;
  let nflNews = [];

  // Obtén los artículos desde la nueva API de ESPN News NFL
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=52');
  const data = await res.json();
  // Los artículos están en data.articles (array)
  nflNews = data.articles || [];

  if (!nflNews.length) {
    container.innerHTML = '<p>No NFL news available.</p>';
    return;
  }

  function renderNews(from, to) {
    nflNews.slice(from, to).forEach(item => {
      const img = item.images?.[0]?.url || 'img/placeholder.jpg';
      const title = item.headline || 'Untitled';
      const shortDesc = item.description || '';
      const link = item.links?.web?.href || item.links?.api?.web?.href || '#';

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

      card.querySelector('.read-more-btn').addEventListener('click', e => {
        e.stopPropagation();
        window.open(link, '_blank');
      });

      container.appendChild(card);
    });
  }

  // Render inicial
  renderNews(currentIndex, currentIndex + NEWS_LIMIT);
  currentIndex += NEWS_LIMIT;

  // Botón Load More
  loadMoreBtn.addEventListener('click', () => {
    renderNews(currentIndex, currentIndex + LOAD_INCREMENT);
    currentIndex += LOAD_INCREMENT;

    if (currentIndex >= nflNews.length) {
      loadMoreBtn.style.display = 'none';
    }
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
    link: "https://youtu.be/0GOnzL-UeDI?si=9xu_5W7MbI-ZWdst",
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
    link: "https://youtu.be/lAEBRihGTps?si=ra9e_3WTphJs6Rpc",
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
