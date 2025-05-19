document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('newsContainer');
  const NEWS_LIMIT = 50;

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
