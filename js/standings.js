document.addEventListener('DOMContentLoaded', async () => {
  // Drag-to-scroll for horizontal containers
  document.querySelectorAll('.standings-group, .standings-card').forEach(el => {
    let isDown = false, startX = 0, scrollLeft = 0;
    el.addEventListener('pointerdown', e => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX);
    });
    ['pointerup','pointerleave'].forEach(t =>
      el.addEventListener(t, () => { isDown = false; el.style.cursor = 'default'; })
    );
  });

  const standingsGrid = document.getElementById('standingsGrid');

  // --- Local team assets (logos/names) map
  let TEAM_MAP = null;
  async function loadTeamMap() {
    if (TEAM_MAP) return TEAM_MAP;
    try {
      const res = await fetch('/data/teams/nfl_teams.json', { cache: 'force-cache' });
      if (!res.ok) throw new Error('nfl_teams.json not found');
      TEAM_MAP = await res.json();
    } catch (e) {
      console.warn('TEAM_MAP not available:', e.message);
      TEAM_MAP = {};
    }
    return TEAM_MAP;
  }
  function teamKeyFrom(team) {
    return String(team?.abbreviation || team?.shortDisplayName || team?.displayName || '').toUpperCase();
  }
  function getTeamLogo(team) {
    const key = teamKeyFrom(team);
    const local = TEAM_MAP && TEAM_MAP[key];
    return (local && local.logo) || team?.logos?.[0]?.href || team?.logo || '';
  }

  // --- Performance helpers
const raf = (fn) => requestAnimationFrame(fn);

// Drag vertical/horizontal solo en el contenedor scrolleable
function attachDragScroll(scrollHost) {
  if (!scrollHost || scrollHost.__dragBound) return;
  let isDown = false, startX = 0, scrollLeft = 0;
  scrollHost.addEventListener('pointerdown', e => {
    isDown = true;
    startX = e.pageX - scrollHost.offsetLeft;
    scrollLeft = scrollHost.scrollLeft;
    scrollHost.style.cursor = 'grabbing';
    scrollHost.setPointerCapture(e.pointerId);
  });
  scrollHost.addEventListener('pointermove', e => {
    if (!isDown) return;
    const x = e.pageX - scrollHost.offsetLeft;
    scrollHost.scrollLeft = scrollLeft - (x - startX);
  });
  ['pointerup','pointerleave'].forEach(t =>
    scrollHost.addEventListener(t, () => { isDown = false; scrollHost.style.cursor = 'default'; })
  );
  scrollHost.__dragBound = true;
}

// Dos etiquetas (full + abbr) envueltas en un chip responsivo
function teamLabelsHTML(team) {
  const key = teamKeyFrom(team);
  const local = TEAM_MAP && TEAM_MAP[key];
  const full = (local?.displayName) || team.displayName || team.shortDisplayName || team.abbreviation || '';
  const abbr = (local?.abbr) || team.abbreviation || team.shortDisplayName || full;
  return `
    <span class="team-chip">
      <span class="team-name-full">${full}</span>
      <span class="team-name-abbr">${abbr}</span>
    </span>
  `;
}


  // Grid template for all columns (Team | W | L | T | PCT | PF | PA | DIFF | STRK)
// ancho cómodo para que no se pisen; el contenedor hará scroll-x
// Grid (desktop) — TEAM menos ancho
const GRID_FULL =
  '56px minmax(48px, .4fr) 48px 48px 48px 48px 64px 64px 68px 68px';

// Grid (mobile/tablet) — TEAM aún más compacto
const GRID_MOBILE =
  '36px minmax(48px, .4fr) 42px 42px 42px 56px 56px 56px 60px 60px';

// Aplica el grid según el viewport (y actualiza en resize)
function attachResponsiveColumns(card) {
  const apply = () => {
    const isMobile = window.matchMedia('(max-width: 1024px)').matches;
    card.style.setProperty('--gridCols', isMobile ? GRID_MOBILE : GRID_FULL);
  };
  apply();
  if (!card.__resizeBound) {
    window.addEventListener('resize', apply, { passive: true });
    card.__resizeBound = true;
  }
}

// --- Slider under horizontal scroll (optional visual)
function attachHorizontalSlider(card) {
    if (card.querySelector('.hslider')) return;
    const scrollHost = card;
    const bar = document.createElement('div');
    bar.className = 'hslider';
    const thumb = document.createElement('div');
    thumb.className = 'hthumb';
    bar.appendChild(thumb);
    card.appendChild(bar);

    const sync = () => {
      const sw = scrollHost.scrollWidth;
      const vw = scrollHost.clientWidth;
      const sl = scrollHost.scrollLeft;
      if (sw <= vw) { bar.style.opacity = '0'; return; }
      bar.style.opacity = '1';
      const ratio = vw / sw;
      const left = (sl / sw) * 100;
      thumb.style.width = Math.max(10, ratio * 100) + '%';
      thumb.style.left = left + '%';
    };

    scrollHost.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    setTimeout(sync, 0);
  }

  // Always use full grid; rely on horizontal scroll (no auto-hiding here)
  function attachResponsiveColumns(card) {
    card.style.setProperty('--gridCols', GRID_FULL);
  }

  // Controls (view + AFC/NFC filter)
  const controls = document.createElement("div");
  controls.className = "standings-controls";
  controls.innerHTML = `
    <div class="controls-row top">
      <button data-view="division" class="view-btn active">Division</button>
      <button data-view="conference" class="view-btn">Conference</button>
      <button data-view="league" class="view-btn">League</button>
    </div>
    <div class="controls-row bottom">
      <button data-conf-filter="AFC" class="conf-btn">AFC</button>
      <button data-conf-filter="NFC" class="conf-btn">NFC</button>
    </div>
  `;
  standingsGrid.parentNode.insertBefore(controls, standingsGrid);

  let currentView = "division";
  let divisionConfFilter = 'AFC'; // default AFC active

  function updateControlsUI() {
    controls.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === currentView);
    });
    const showConf = currentView === 'division';
    const bottom = controls.querySelector('.controls-row.bottom');
    if (bottom) bottom.style.display = showConf ? 'flex' : 'none';
    controls.querySelectorAll('.conf-btn').forEach(b => {
      b.classList.toggle('active', showConf && b.dataset.confFilter === divisionConfFilter);
    });
    // Layout: Division = single column (1 card por fila). Otros = grid normal.
    if (currentView === 'division') {
      standingsGrid.classList.add('single-col');
    } else {
      standingsGrid.classList.remove('single-col');
    }

    standingsGrid.classList.remove('league-view','conference-view','division-view');
    standingsGrid.classList.add(currentView + '-view');
  }
  

  const headerStyle = `display:grid;grid-template-columns:var(--gridCols);gap:12px;align-items:center;margin:.75rem 0 .25rem;opacity:.8`;
  const rowStyle    = `display:grid;grid-template-columns:var(--gridCols);gap:12px;align-items:center;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.06)`;

  async function fetchStandings() {
    try {
      const res = await fetch("https://cdn.espn.com/core/nfl/standings?xhr=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.content.standings.groups || [];
    } catch (err) {
      console.error("Error fetching standings:", err);
      return null;
    }
  }

// --- Mobile compact for team cell (logo + gap + tipografía)
(function ensureStandingsMobileCompact() {
  if (document.getElementById('standings-mobile-compact')) return;
  const s = document.createElement('style');
  s.id = 'standings-mobile-compact';
  s.textContent = `
  @media (max-width: 768px){
    .standings-content .team-sticky{
      gap: 6px !important;
    }
    .standings-content .team-logo-sm{
      width: 18px !important;
      height: 18px !important;
    }
    /* muestra abreviación, oculta nombre largo en móvil */
    .standings-content .team-name-full{ display: none !important; }
    .standings-content .team-name-abbr{
      display: inline !important;
      font-size: .92rem !important;
      letter-spacing: .2px;
      opacity: .95;
    }
    /* reduce un poco el espacio entre columnas en mobile */
    .standings-content .standings-header,
    .standings-content .team-row{
      column-gap: 8px !important;
    }
  }`;
  document.head.appendChild(s);
})();

// --- Auto-switch to abbreviation when the chip doesn't fit
(function ensureTeamChipAutoAbbr(){
  if (document.getElementById('standings-team-chip-auto-abbr')) return;
  const s = document.createElement('style');
  s.id = 'standings-team-chip-auto-abbr';
  s.textContent = `
    .standings-content .team-chip.use-abbr .team-name-full{ display:none !important; }
    .standings-content .team-chip.use-abbr .team-name-abbr{ display:inline !important; }
  `;
  document.head.appendChild(s);
})();

function autoAbbrevChipForCard(card){
  const chips = card.querySelectorAll('.team-sticky .team-chip');
  if (!chips.length) return;
  const ro = new ResizeObserver(entries => {
    for (const entry of entries){
      const chip = entry.target;
      // If text overflows the chip box, force abbreviation
      if (chip.scrollWidth > chip.clientWidth) {
        chip.classList.add('use-abbr');
      } else {
        chip.classList.remove('use-abbr');
      }
    }
  });
  chips.forEach(ch => {
    // Measure now
    if (ch.scrollWidth > ch.clientWidth) ch.classList.add('use-abbr');
    else ch.classList.remove('use-abbr');
    // Observe future resizes
    ro.observe(ch);
  });
  // Also re-evaluate on window resize to be safe
  if (!card.__autoAbbrBound){
    const reevaluate = () => chips.forEach(ch => {
      if (ch.scrollWidth > ch.clientWidth) ch.classList.add('use-abbr');
      else ch.classList.remove('use-abbr');
    });
    window.addEventListener('resize', reevaluate, { passive: true });
    card.__autoAbbrBound = true;
  }
}

// --- Global abbreviation threshold (<= 1100px wide => use abbreviations)
(function ensureAbbrThresholdStyle(){
  if (document.getElementById('standings-abbr-threshold')) return;
  const s = document.createElement('style');
  s.id = 'standings-abbr-threshold';
  s.textContent = `
    .standings-content.abbr-1100 .team-name-full{ display:none !important; }
    .standings-content.abbr-1100 .team-name-abbr{ display:inline !important; }
  `;
  document.head.appendChild(s);
})();

function applyAbbrThreshold(card){
  const host = card.querySelector('.standings-content') || card;
  const reevaluate = () => {
    const w = host.clientWidth;
    if (w < 1100) host.classList.add('abbr-1100');
    else host.classList.remove('abbr-1100');
  };
  // Initial and observe resizes
  reevaluate();
  if (!host.__abbrObs){
    const ro = new ResizeObserver(() => reevaluate());
    ro.observe(host);
    window.addEventListener('resize', reevaluate, { passive: true });
    host.__abbrObs = ro;
  }
}

  async function renderStandings() {
    updateControlsUI();
    await loadTeamMap();
    const placeholder = document.createElement('div');
    placeholder.className = 'loading';
    placeholder.textContent = 'Loading standings...';
    standingsGrid.replaceChildren(placeholder);
    const conferences = await fetchStandings();
    
    // Cargar los datos de clasificaciones
    
    const frag = document.createDocumentFragment();

    if (!conferences || !conferences.length) {
      standingsGrid.innerHTML = `<div class="no-standings-message"><p>No standings available at this time.</p></div>`;
      return;
    }

    // Helpers
    const collectEntries = (grp) => {
      let entries = grp.standings?.entries || grp.teamRecords || [];
      if (!entries || !entries.length) {
        const kids = grp.children || grp.groups || [];
        if (kids && kids.length) {
          entries = kids.flatMap(k => k.standings?.entries || k.teamRecords || []);
        }
      }
      return entries;
    };
    const statObj = (arr, n) => arr.find(x => x.name === n || x.abbrev === n || x.abbreviation === n || x.displayName === n || x.shortDisplayName === n);
    const toNum = (v) => {
      if (v === undefined || v === null || v === '-') return 0;
      const x = typeof v === 'string' ? parseFloat(v) : Number(v);
      return Number.isFinite(x) ? x : 0;
    };
    const getNum = (n, arr) => {
      const obj = statObj(arr, n);
      if (!obj) return 0;
      const raw = obj.value ?? obj.displayValue;
      return toNum(raw);
    };
    const getStr = (n, arr) => {
      const obj = statObj(arr, n);
      if (!obj) {
        // Buscar por coincidencia parcial si no se encuentra una coincidencia exacta
        const lowerN = n.toLowerCase();
        const matchByPartial = arr.find(x => 
          (x.name && x.name.toLowerCase().includes(lowerN)) ||
          (x.displayName && x.displayName.toLowerCase().includes(lowerN)) ||
          (x.shortDisplayName && x.shortDisplayName.toLowerCase().includes(lowerN)) ||
          (x.abbreviation && x.abbreviation.toLowerCase().includes(lowerN))
        );
        if (matchByPartial) {
          return matchByPartial.displayValue ?? matchByPartial.value;
        }
      }
      return obj?.displayValue ?? obj?.value;
    };
    const recordText = (base, stats) => {
      // 0) If ESPN already gives a record string, use it
      const direct = getStr(base, stats);
      if (direct && /\d+\-\d+(?:\-\d+)?/.test(String(direct))) return String(direct);

      // Some payloads expose "homeRecord", "awayRecord", etc.
      const recCandidates = [base + 'Record', base + 'Rec', base + 'RecordText'];
      for (const k of recCandidates) {
        const s = getStr(k, stats);
        if (s && /\d+\-\d+(?:\-\d+)?/.test(String(s))) return String(s);
      }

      // 1) Build record from wins/losses/ties numbers. We must detect presence even if value is 0.
      const map = {
        home:      { w: ['homeWins', 'homewins', 'homeRecordWins', 'home', 'homeRecord'],         l: ['homeLosses', 'homelosses', 'homeRecordLosses'],         t: ['homeTies', 'hometies', 'homeRecordTies'] },
        away:      { w: ['awayWins', 'awaywins', 'awayRecordWins', 'away', 'awayRecord'],         l: ['awayLosses', 'awaylosses', 'awayRecordLosses'],         t: ['awayTies', 'awayties', 'awayRecordTies'] },
        division:  { w: ['divisionWins', 'divWins', 'divisionRecord', 'divRecord', 'div'],                        l: ['divisionLosses', 'divLosses'],                          t: ['divisionTies', 'divTies'] },
        conference:{ w: ['conferenceWins', 'confWins', 'conferenceRecord', 'confRecord', 'conf'],                     l: ['conferenceLosses', 'confLosses'],                       t: ['conferenceTies', 'confTies'] }
      };

      // Check for record format in stats (e.g. "5-2" or "3-1-0")
      const baseLower = base.toLowerCase();
      
      // Primero, buscar coincidencias exactas con el formato de registro
      for (const stat of stats) {
        const name = stat.name?.toLowerCase() || '';
        const displayName = stat.displayName?.toLowerCase() || '';
        const shortDisplayName = stat.shortDisplayName?.toLowerCase() || '';
        const abbrev = stat.abbreviation?.toLowerCase() || '';
        
        // Check if any of the stat names match our base
        if (name.includes(baseLower) || 
            displayName.includes(baseLower) || 
            shortDisplayName.includes(baseLower) || 
            abbrev.includes(baseLower)) {
          
          const value = stat.displayValue || stat.value;
          if (value && /\d+\-\d+(?:\-\d+)?/.test(String(value))) {
            return String(value);
          }
        }
      }
      
      // Buscar coincidencias parciales para casos especiales
      const specialCases = {
        'home': ['home', 'hm', 'h'],
        'away': ['away', 'aw', 'a', 'road'],
        'division': ['div', 'division', 'divisional'],
        'conference': ['conf', 'conference']
      };
      
      const keywords = specialCases[baseLower] || [baseLower];
      
      for (const keyword of keywords) {
        for (const stat of stats) {
          // Buscar en todas las propiedades del objeto stat
          for (const [key, value] of Object.entries(stat)) {
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value) && 
                key.toLowerCase().includes(keyword)) {
              return value;
            }
            
            // También buscar en el nombre de la estadística
            const statName = (stat.name || '').toLowerCase();
            if (statName.includes(keyword) && 
                (stat.displayValue && /\d+\-\d+(?:\-\d+)?/.test(String(stat.displayValue)))) {
              return String(stat.displayValue);
            }
          }
        }
      }
      
      // Buscar en el objeto completo para casos donde los datos están anidados
      const findRecordInObject = (obj, keyword) => {
        if (!obj || typeof obj !== 'object') return null;
        
        for (const [key, value] of Object.entries(obj)) {
          // Si encontramos una clave que coincide con nuestra palabra clave
          if (key.toLowerCase().includes(keyword)) {
            // Y el valor es una cadena con formato de registro
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
              return value;
            }
            // O si el valor es un objeto, buscar recursivamente
            else if (typeof value === 'object' && value !== null) {
              const result = findRecordInObject(value, keyword);
              if (result) return result;
            }
          }
          // Si el valor es un objeto, buscar recursivamente independientemente de la clave
          else if (typeof value === 'object' && value !== null) {
            const result = findRecordInObject(value, keyword);
            if (result) return result;
          }
        }
        return null;
      };
      
      // Intentar encontrar el registro en todo el objeto de estadísticas
      for (const keyword of keywords) {
        for (const stat of stats) {
          const result = findRecordInObject(stat, keyword);
          if (result) return result;
        }
      }
      
      // Caso especial: Buscar en el objeto 'stat' completo
      for (const stat of stats) {
        // Verificar si el nombre de la estadística contiene nuestra base
        const statName = (stat.name || '').toLowerCase();
        const statDisplayName = (stat.displayName || '').toLowerCase();
        const statShortName = (stat.shortDisplayName || '').toLowerCase();
        const statAbbrev = (stat.abbreviation || '').toLowerCase();
        
        // Si alguno de los nombres coincide con nuestra base
        if (keywords.some(kw => 
            statName.includes(kw) || 
            statDisplayName.includes(kw) || 
            statShortName.includes(kw) || 
            statAbbrev.includes(kw))) {
          
          // Intentar obtener el valor en diferentes formatos
          const value = stat.displayValue || stat.value;
          if (value && /\d+\-\d+(?:\-\d+)?/.test(String(value))) {
            return String(value);
          }
        }
      }
      
      // Caso especial para ESPN API: buscar en stats.splits
      for (const stat of stats) {
        if (stat.splits && Array.isArray(stat.splits)) {
          for (const split of stat.splits) {
            if (split.type && keywords.some(kw => split.type.toLowerCase().includes(kw))) {
              if (split.displayValue && /\d+\-\d+(?:\-\d+)?/.test(String(split.displayValue))) {
                return String(split.displayValue);
              }
            }
          }
        }
      }
      
      // Caso especial para ESPN API: buscar en el objeto 'team'
      if (stats.length > 0 && stats[0].team) {
        const team = stats[0].team;
        
        // Buscar en records si existe
        if (team.records) {
          for (const record of team.records) {
            if (record.type && keywords.some(kw => record.type.toLowerCase().includes(kw))) {
              if (record.summary && /\d+\-\d+(?:\-\d+)?/.test(String(record.summary))) {
                return String(record.summary);
              }
            }
          }
        }
        
        // Buscar en el objeto team directamente
        for (const [key, value] of Object.entries(team)) {
          if (keywords.some(kw => key.toLowerCase().includes(kw))) {
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
              return value;
            } else if (typeof value === 'object' && value !== null) {
              // Si es un objeto, buscar en sus propiedades
              for (const [subKey, subValue] of Object.entries(value)) {
                if (typeof subValue === 'string' && /\d+\-\d+(?:\-\d+)?/.test(subValue)) {
                  return subValue;
                }
              }
            }
          }
        }
      }
      
      // Caso especial para ESPN API: buscar en el objeto 'record' dentro de 'team'
      if (stats.length > 0 && stats[0].team && stats[0].team.record) {
        const record = stats[0].team.record;
        
        // Buscar en items si existe
        if (record.items && Array.isArray(record.items)) {
          for (const item of record.items) {
            if (item.type && keywords.some(kw => item.type.toLowerCase().includes(kw))) {
              if (item.summary && /\d+\-\d+(?:\-\d+)?/.test(String(item.summary))) {
                return String(item.summary);
              }
            }
            // También buscar en description o name
            if (item.description && keywords.some(kw => item.description.toLowerCase().includes(kw))) {
              if (item.summary && /\d+\-\d+(?:\-\d+)?/.test(String(item.summary))) {
                return String(item.summary);
              }
            }
            if (item.name && keywords.some(kw => item.name.toLowerCase().includes(kw))) {
              if (item.summary && /\d+\-\d+(?:\-\d+)?/.test(String(item.summary))) {
                return String(item.summary);
              }
            }
          }
        }
      }
      
      // Caso especial para ESPN API: buscar en el objeto 'records' dentro de 'team'
      if (stats.length > 0 && stats[0].team && stats[0].team.records) {
        const records = stats[0].team.records;
        for (const record of records) {
          // Buscar por tipo de registro
          if (record.type && keywords.some(kw => record.type.toLowerCase().includes(kw))) {
            if (record.summary && /\d+\-\d+(?:\-\d+)?/.test(String(record.summary))) {
              return String(record.summary);
            }
          }
          // Buscar por nombre o descripción
          if (record.name && keywords.some(kw => record.name.toLowerCase().includes(kw))) {
            if (record.summary && /\d+\-\d+(?:\-\d+)?/.test(String(record.summary))) {
              return String(record.summary);
            }
          }
          if (record.description && keywords.some(kw => record.description.toLowerCase().includes(kw))) {
            if (record.summary && /\d+\-\d+(?:\-\d+)?/.test(String(record.summary))) {
              return String(record.summary);
            }
          }
        }
      }
      
      // Caso especial para ESPN API: buscar en el objeto 'recordsSummary' dentro de 'team'
      if (stats.length > 0 && stats[0].team && stats[0].team.recordsSummary) {
        const recordsSummary = stats[0].team.recordsSummary;
        for (const [key, value] of Object.entries(recordsSummary)) {
          if (keywords.some(kw => key.toLowerCase().includes(kw))) {
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
              return value;
            }
          }
        }
      }
      
      // Caso especial: buscar en el objeto principal de estadísticas
      // A veces los datos están en el objeto principal y no en stats
      if (stats.length > 0) {
        const mainObj = stats[0];
        if (mainObj.record) {
          // Si hay un objeto record, buscar en él
          for (const [key, value] of Object.entries(mainObj.record)) {
            if (keywords.some(kw => key.toLowerCase().includes(kw))) {
              if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
                return value;
              }
            }
          }
        }
        
        // Buscar directamente en el objeto principal
        for (const [key, value] of Object.entries(mainObj)) {
          if (keywords.some(kw => key.toLowerCase().includes(kw))) {
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
              return value;
            } else if (typeof value === 'object' && value !== null && key !== 'stats') {
              // Si es un objeto, buscar en sus propiedades (excepto stats para evitar recursión)
              for (const [subKey, subValue] of Object.entries(value)) {
                if (typeof subValue === 'string' && /\d+\-\d+(?:\-\d+)?/.test(subValue)) {
                  return subValue;
                }
              }
            }
          }
        }
      }
      
      // Caso especial: buscar en el objeto 'standings' si existe
      if (stats.length > 0 && stats[0].standings) {
        const standings = stats[0].standings;
        
        // Buscar en el objeto standings directamente
        for (const [key, value] of Object.entries(standings)) {
          if (keywords.some(kw => key.toLowerCase().includes(kw))) {
            if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
              return value;
            }
          }
        }
        
        // Buscar en records si existe
        if (standings.records) {
          for (const record of standings.records) {
            if (record.type && keywords.some(kw => record.type.toLowerCase().includes(kw))) {
              if (record.summary && /\d+\-\d+(?:\-\d+)?/.test(String(record.summary))) {
                return String(record.summary);
              }
            }
          }
        }
      }
      
      // Caso especial: buscar en el objeto 'note' si existe
      if (stats.length > 0 && stats[0].note) {
        const note = stats[0].note;
        if (typeof note === 'string') {
          // Buscar patrones como "Home: 5-2" o "Away: 3-4"
          for (const keyword of keywords) {
            const regex = new RegExp(`${keyword}[:\s]+([0-9]+\-[0-9]+(?:\-[0-9]+)?)`, 'i');
            const match = note.match(regex);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
      }
      
      // Caso especial: buscar en el objeto 'stats' directamente
      if (stats.length > 0) {
        // Buscar en cada objeto de estadística
        for (const stat of stats) {
          // Verificar si el objeto tiene propiedades que coinciden con nuestras palabras clave
          for (const [key, value] of Object.entries(stat)) {
            if (keywords.some(kw => key.toLowerCase().includes(kw))) {
              // Si el valor es una cadena con formato de registro
              if (typeof value === 'string' && /\d+\-\d+(?:\-\d+)?/.test(value)) {
                return value;
              }
              // Si el valor es un objeto, buscar en sus propiedades
              else if (typeof value === 'object' && value !== null) {
                for (const [subKey, subValue] of Object.entries(value)) {
                  if (typeof subValue === 'string' && /\d+\-\d+(?:\-\d+)?/.test(subValue)) {
                    return subValue;
                  }
                }
              }
            }
          }
          
          // Buscar en categorías específicas si existen
          if (stat.categories && Array.isArray(stat.categories)) {
            for (const category of stat.categories) {
              if (category.name && keywords.some(kw => category.name.toLowerCase().includes(kw))) {
                if (category.value && /\d+\-\d+(?:\-\d+)?/.test(String(category.value))) {
                  return String(category.value);
                }
              }
            }
          }
        }
      }

      const pick = (cands) => {
        for (const key of cands) {
          const obj = statObj(stats, key);
          if (obj) {
            const val = toNum(obj.value ?? obj.displayValue);
            return { val: Number.isFinite(val) ? val : 0, found: true };
          }
        }
        return { val: 0, found: false };
      };

      const cfg = map[base] || { w: [base + 'Wins'], l: [base + 'Losses'], t: [base + 'Ties'] };
      const W = pick(cfg.w), L = pick(cfg.l), T = pick(cfg.t);

      // If we located any of the three stats, render a record string even if all are zero.
      if (W.found || L.found || T.found) {
        const w = W.val || 0, l = L.val || 0, t = T.val || 0;
        return `${w}-${l}${t ? '-' + t : ''}`;
      }

      // Nothing usable
      return '-';
    };
    const pctText = (wins, losses, ties, arr) => {
      let pct = getNum('winPercent', arr);
      if (!pct && (wins + losses + ties) > 0) pct = (wins + (ties * 0.5)) / (wins + losses + ties);
      const txt = (pct || 0).toFixed(3);
      return txt.replace(/^0(?=\.)/, '');
    };
    const fmtInt = (v) => String(Math.trunc(toNum(v)));
    const fmtNum = (v) => String(Math.trunc(toNum(v)));

    const sortEntries = (entries) => {
      entries.sort((a, b) => {
        const as = a.stats || []; const bs = b.stats || [];
        const gv = (arr, n) => Number(statObj(arr, n)?.value ?? 0);
        const aw = gv(as,'wins'); const bw = gv(bs,'wins');
        if (bw !== aw) return bw - aw;
        const apd = gv(as,'pointsFor') - gv(as,'pointsAgainst');
        const bpd = gv(bs,'pointsFor') - gv(bs,'pointsAgainst');
        return bpd - apd;
      });
    };

    // LEAGUE VIEW (all teams in one table)
    if (currentView === "league") {
      let allEntries = [];
      conferences.forEach(conf => {
        if (conf.children && conf.children.length) {
          conf.children.forEach(div => {
            allEntries.push(...collectEntries(div));
          });
        } else {
          allEntries.push(...collectEntries(conf));
        }
      });
      sortEntries(allEntries);

      const container = document.createElement("div");
      container.className = "standings-group";
      container.style.setProperty('--gridCols', GRID_FULL);
      container.innerHTML = `
        <h3 class="standings-group-title">NFL</h3>
        <div class="standings-content">
<div class="standings-header" style="${headerStyle}">
  <span class="col-rank">#</span>
  <span class="col-team">Team</span>
  <span class="col-w">W</span>
  <span class="col-l">L</span>
  <span class="col-t">T</span>
  <span class="col-pct">PCT</span>
  <span class="col-pf">PF</span>
  <span class="col-pa">PA</span>
  <span class="col-diff">DIFF</span>
  <span class="col-strk">STRK</span>
</div>
          <div class="standings-teams"></div>
        </div>
      `;

      const teamsContainer = container.querySelector(".standings-teams");

      let rowsHtml = '';
      allEntries.forEach((tr, idx) => {
        const team = tr.team || tr;
        const stats = tr.stats || [];
        const w = getNum('wins', stats);
        const l = getNum('losses', stats);
        const t = getNum('ties', stats);
      
        rowsHtml += `
        <div class="team-row" style="${rowStyle}">
          <span class="col-rank rank">${idx + 1}</span>
          <span class="col-team team-sticky">
            <img src="${getTeamLogo(team)}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
          </span>
          <span class="col-w num">${fmtInt(w)}</span>
          <span class="col-l num">${fmtInt(l)}</span>
          <span class="col-t num">${fmtInt(t)}</span>
          <span class="col-pct num">${pctText(w, l, t, stats)}</span>
          <span class="col-pf num">${fmtNum(getNum('pointsFor', stats))}</span>
          <span class="col-pa num">${fmtNum(getNum('pointsAgainst', stats))}</span>
          <span class="col-diff num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
          <span class="col-strk num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
        </div>
      `;
    });
      
      teamsContainer.innerHTML = rowsHtml;
      applyAbbrThreshold(container);
      autoAbbrevChipForCard(container);
      attachResponsiveColumns(container);
      attachDragScroll(container.querySelector('.standings-content'));
      frag.appendChild(container);
      standingsGrid.replaceChildren(frag);
      return;
    }

    // CONFERENCE VIEW (AFC / NFC tables)
    if (currentView === "conference") {
      conferences.forEach(conf => {
        let confEntries = [];
        if (conf.children && conf.children.length) {
          conf.children.forEach(div => {
            confEntries.push(...collectEntries(div));
          });
        } else {
          confEntries = collectEntries(conf);
        }
        sortEntries(confEntries);

        const title = conf.header || conf.name || conf.abbreviation || "";
        const container = document.createElement("div");
        container.className = "standings-group";
        container.style.setProperty('--gridCols', GRID_FULL);
        container.innerHTML = `
          <h3 class="standings-group-title">${title}</h3>
          <div class="standings-content">
<div class="standings-header" style="${headerStyle}">
  <span class="col-rank">#</span>
  <span class="col-team">Team</span>
  <span class="col-w">W</span>
  <span class="col-l">L</span>
  <span class="col-t">T</span>
  <span class="col-pct">PCT</span>
  <span class="col-pf">PF</span>
  <span class="col-pa">PA</span>
  <span class="col-diff">DIFF</span>
  <span class="col-strk">STRK</span>
</div>
            <div class="standings-teams"></div>
          </div>
        `;

        const teamsContainer = container.querySelector(".standings-teams");

        let rowsHtml = '';
        confEntries.forEach((tr, idx) => {
          const team = tr.team || tr;
          const stats = tr.stats || [];
          const w = getNum('wins', stats);
          const l = getNum('losses', stats);
          const t = getNum('ties', stats);
        
          rowsHtml += `
          <div class="team-row" style="${rowStyle}">
            <span class="col-rank rank">${idx + 1}</span>
            <span class="col-team team-sticky">
              <img src="${getTeamLogo(team)}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
            </span>
            <span class="col-w num">${fmtInt(w)}</span>
            <span class="col-l num">${fmtInt(l)}</span>
            <span class="col-t num">${fmtInt(t)}</span>
            <span class="col-pct num">${pctText(w, l, t, stats)}</span>
            <span class="col-pf num">${fmtNum(getNum('pointsFor', stats))}</span>
            <span class="col-pa num">${fmtNum(getNum('pointsAgainst', stats))}</span>
            <span class="col-diff num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
            <span class="col-strk num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
          </div>
        `;
      });
        
        teamsContainer.innerHTML = rowsHtml;
        applyAbbrThreshold(container);
        autoAbbrevChipForCard(container);
        attachResponsiveColumns(container);
        attachDragScroll(container.querySelector('.standings-content'));
        frag.appendChild(container);
      });
      standingsGrid.replaceChildren(frag);
      return;
    }

    // DIVISION VIEW — render all divisions; filter AFC/NFC if needed
    const divisionOrder = [
      'AFC EAST','AFC NORTH','AFC SOUTH','AFC WEST',
      'NFC EAST','NFC NORTH','NFC SOUTH','NFC WEST'
    ];

    const divisions = [];
    conferences.forEach(conf => {
      const confKey = (conf.abbreviation || conf.header || conf.name || '').toUpperCase();
      const kids = conf.children || conf.groups || [];
      kids.forEach(div => {
        const divKeyRaw = (div.abbreviation || div.header || div.name || '').toUpperCase();
        const divKey = divKeyRaw.replace('DIVISION', '').replace(/\s+/g, ' ').trim();
        const key = `${confKey} ${divKey}`;
        divisions.push({ conf, div, key });
      });
    });

    if (divisionConfFilter === 'AFC') {
      for (let i = divisions.length - 1; i >= 0; i--) if (!divisions[i].key.startsWith('AFC')) divisions.splice(i,1);
    } else if (divisionConfFilter === 'NFC') {
      for (let i = divisions.length - 1; i >= 0; i--) if (!divisions[i].key.startsWith('NFC')) divisions.splice(i,1);
    }

    divisions.sort((a, b) => {
      const ai = divisionOrder.indexOf(a.key);
      const bi = divisionOrder.indexOf(b.key);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.key.localeCompare(b.key);
    });

    divisions.forEach(({ div, key }) => {
      const container = document.createElement('div');
      container.className = 'standings-group';
      container.style.setProperty('--gridCols', GRID_FULL);
      container.innerHTML = `
        <h3 class="standings-group-title">${key}</h3>
        <div class="standings-content">
<div class="standings-header" style="${headerStyle}">
  <span class="col-rank">#</span>
  <span class="col-team">Team</span>
  <span class="col-w">W</span>
  <span class="col-l">L</span>
  <span class="col-t">T</span>
  <span class="col-pct">PCT</span>
  <span class="col-pf">PF</span>
  <span class="col-pa">PA</span>
  <span class="col-diff">DIFF</span>
  <span class="col-strk">STRK</span>
</div>
          <div class="standings-teams"></div>
        </div>
      `;

      const teamsContainer = container.querySelector('.standings-teams');
      const entries = div.standings?.entries || div.teamRecords || [];
      
      // Sort por wins desc y diff desc (conserva tu lógica actual)
      entries.sort((a, b) => {
        const as = a.stats || []; const bs = b.stats || [];
        const gv = (arr, n) => Number(statObj(arr, n)?.value ?? 0);
        const aw = gv(as,'wins'); const bw = gv(bs,'wins');
        if (bw !== aw) return bw - aw;
        const apd = gv(as,'pointsFor') - gv(as,'pointsAgainst');
        const bpd = gv(bs,'pointsFor') - gv(bs,'pointsAgainst');
        return bpd - apd;
      });
      
      let rowsHtml = '';
      entries.forEach((tr, idx) => {
        const team = tr.team || tr;
        const stats = tr.stats || [];
        const w = getNum('wins', stats);
        const l = getNum('losses', stats);
        const t = getNum('ties', stats);
      
        rowsHtml += `
        <div class="team-row" style="${rowStyle}">
          <span class="col-rank rank">${idx + 1}</span>
          <span class="col-team team-sticky">
            <img src="${getTeamLogo(team)}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
          </span>
          <span class="col-w num">${fmtInt(w)}</span>
          <span class="col-l num">${fmtInt(l)}</span>
          <span class="col-t num">${fmtInt(t)}</span>
          <span class="col-pct num">${pctText(w, l, t, stats)}</span>
          <span class="col-pf num">${fmtNum(getNum('pointsFor', stats))}</span>
          <span class="col-pa num">${fmtNum(getNum('pointsAgainst', stats))}</span>
          <span class="col-diff num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
          <span class="col-strk num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
        </div>
      `;
    });
      
      teamsContainer.innerHTML = rowsHtml;
      applyAbbrThreshold(container);
      autoAbbrevChipForCard(container);
      attachResponsiveColumns(container);
      attachDragScroll(container.querySelector('.standings-content'));
      frag.appendChild(container);
    });
    standingsGrid.replaceChildren(frag);
    return;
  }

  // Button handlers
  controls.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prev = currentView;
      currentView = btn.dataset.view;

      if (currentView === 'division') {
        // Always default to AFC when entering Division view
        divisionConfFilter = 'AFC';
      } else {
        // Hide/neutralize conference sub-filter outside Division
        divisionConfFilter = 'ALL';
      }

      renderStandings();
    });
  });
  controls.querySelectorAll('.conf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentView !== 'division') return;
      const val = btn.dataset.confFilter;
      divisionConfFilter = (divisionConfFilter === val) ? 'ALL' : val;
      renderStandings();
    });
  });



  updateControlsUI();
  renderStandings();
});