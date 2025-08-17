document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('newsContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const toggleNFL = document.getElementById('toggleNFL');
  const toggleNCAA = document.getElementById('toggleNCAA');
  const NEWS_LIMIT = 12;
  const LOAD_INCREMENT = 12;

  // ---- Performance helpers (cache + skeleton + timeout) ----
  const TTL_MS = 5 * 60 * 1000; // 5 minutes
  const FETCH_TIMEOUT = 7000;

  const keyFor = (lg) => `news:${lg}`;
  const tsKeyFor = (lg) => `news:${lg}:ts`;

  function getCache(lg) {
    try {
      const raw = localStorage.getItem(keyFor(lg));
      const ts = parseInt(localStorage.getItem(tsKeyFor(lg)), 10);
      if (!raw || !ts) return null;
      if (Date.now() - ts > TTL_MS) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function setCache(lg, data) {
    try {
      localStorage.setItem(keyFor(lg), JSON.stringify(data));
      localStorage.setItem(tsKeyFor(lg), String(Date.now()));
    } catch {}
  }

  function showSkeleton(count = 8) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const sk = document.createElement('div');
      sk.className = 'news-card skel';
      sk.innerHTML = `
        <div class="news-img skel-thumb"></div>
        <div class="news-content">
          <div class="skel-line w80"></div>
          <div class="skel-line w60"></div>
          <div class="skel-line w40"></div>
        </div>
      `;
      frag.appendChild(sk);
    }
    container.appendChild(frag);
  }
  function clearSkeleton() {
    container.querySelectorAll('.skel').forEach(n => n.remove());
  }

  async function fetchWithTimeout(url, ms = FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function pickImageNFL(item) {
    const img = item?.images?.[0]?.url || item?.images?.[0]?.href || '';
    return img || 'img/placeholder.jpg';
  }
  function pickImageCFB(item) {
    const img = item?.images?.[0]?.url || item?.images?.[0]?.href || '';
    return img || 'img/placeholder.jpg';
  }

  // Guarda las noticias cargadas
  let nflHeadlines = [];
  let collegeHeadlines = [];
  let currentType = 'nfl'; // default
  let currentIndex = 0;

  async function fetchNFLNews() {
    const data = await fetchWithTimeout('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50');
    // La estructura es { articles: [...] }
    const articles = (data.articles || []).filter(a => !!a.headline);
    return articles;
  }

  async function fetchCollegeNews() {
    const data = await fetchWithTimeout('https://site.api.espn.com/apis/site/v2/sports/football/college-football/news');
    return (data.articles || []).filter(item => !!item.headline);
  }

  function renderNews(headlines, from, to) {
    headlines.slice(from, to).forEach(item => {
      const img = pickImageNFL(item); // funciona para ambos (mismo shape en Site API)
      const title = item.title || item.headline || 'Untitled';
      const shortDesc = item.description || item.subhead || '';
      const link = item.links?.web?.href || '#';

      const card = document.createElement('div');
      card.className = 'news-card';
      card.innerHTML = `
        <img src="${img}" alt="News image" class="news-img" loading="lazy" decoding="async">
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

  function resetNews() {
    container.innerHTML = '';
    currentIndex = 0;
    loadMoreBtn.style.display = 'block';
    showSkeleton(8);
  }

  // Actualiza el toggle visualmente
  function setActiveToggle(type) {
    toggleNFL.classList.toggle('active', type === 'nfl');
    toggleNCAA.classList.toggle('active', type === 'ncaa');
  }

  // Lógica para cargar las noticias según el tipo (NFL/NCAA)
  async function showNews(type, initial = false) {
    setActiveToggle(type);
    resetNews();

    if (type === 'nfl') {
      const cached = getCache('nfl');
      if (cached) {
        clearSkeleton();
        renderNews(cached, currentIndex, currentIndex + NEWS_LIMIT);
        currentIndex += NEWS_LIMIT;
        if (currentIndex >= cached.length) loadMoreBtn.style.display = 'none';
        // revalidar en background
        fetchNFLNews().then(fresh => {
          setCache('nfl', fresh);
        }).catch(()=>{});
        return;
      }
      try {
        const fresh = await fetchNFLNews();
        setCache('nfl', fresh);
        clearSkeleton();
        if (!fresh.length) {
          container.innerHTML = '<p>No NFL news available.</p>';
          loadMoreBtn.style.display = 'none';
          return;
        }
        renderNews(fresh, currentIndex, currentIndex + NEWS_LIMIT);
        currentIndex += NEWS_LIMIT;
        if (currentIndex >= fresh.length) loadMoreBtn.style.display = 'none';
      } catch (e) {
        clearSkeleton();
        container.innerHTML = `<p>Failed to load NFL news.</p>`;
        loadMoreBtn.style.display = 'none';
      }
    } else {
      const cached = getCache('cfb');
      if (cached) {
        clearSkeleton();
        renderNews(cached, currentIndex, currentIndex + NEWS_LIMIT);
        currentIndex += NEWS_LIMIT;
        if (currentIndex >= cached.length) loadMoreBtn.style.display = 'none';
        fetchCollegeNews().then(fresh => {
          setCache('cfb', fresh);
        }).catch(()=>{});
        return;
      }
      try {
        const fresh = await fetchCollegeNews();
        setCache('cfb', fresh);
        clearSkeleton();
        if (!fresh.length) {
          container.innerHTML = '<p>No college football news available.</p>';
          loadMoreBtn.style.display = 'none';
          return;
        }
        renderNews(fresh, currentIndex, currentIndex + NEWS_LIMIT);
        currentIndex += NEWS_LIMIT;
        if (currentIndex >= fresh.length) loadMoreBtn.style.display = 'none';
      } catch (e) {
        clearSkeleton();
        container.innerHTML = `<p>Failed to load college football news.</p>`;
        loadMoreBtn.style.display = 'none';
      }
    }
  }

  // Eventos del toggle
  toggleNFL.addEventListener('click', () => {
    if (currentType !== 'nfl') {
      currentType = 'nfl';
      showNews('nfl');
    }
  });
  toggleNCAA.addEventListener('click', () => {
    if (currentType !== 'ncaa') {
      currentType = 'ncaa';
      showNews('ncaa');
    }
  });

  // Botón Load More
  loadMoreBtn.addEventListener('click', () => {
    const cached = getCache(currentType === 'nfl' ? 'nfl' : 'cfb') || (currentType === 'nfl' ? nflHeadlines : collegeHeadlines);
    renderNews(cached, currentIndex, currentIndex + LOAD_INCREMENT);
    currentIndex += LOAD_INCREMENT;
    if (currentIndex >= cached.length) loadMoreBtn.style.display = 'none';
  });

  // Render inicial: NFL por default
  showNews('nfl', true);
});

(function ensureNewsSkeletonStyles(){
  const css = `
  .news-card.skel{border-radius:14px;background:var(--card-bg,#0e1320);overflow:hidden}
  .skel-thumb{height:140px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));background-size:200% 100%;animation:skel 1.2s infinite linear}
  .skel-line{height:12px;margin:8px 0;border-radius:8px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));background-size:200% 100%;animation:skel 1.2s infinite linear}
  .skel-line.w40{width:40%}.skel-line.w60{width:60%}.skel-line.w80{width:80%}
  @keyframes skel{0%{background-position:200% 0}100%{background-position:-200% 0}}
  `;
  if (!document.getElementById('news-skel-style')) {
    const s = document.createElement('style');
    s.id = 'news-skel-style';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();

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