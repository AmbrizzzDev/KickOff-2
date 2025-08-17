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


  // Grid template for all columns (Team | W | L | T | PCT | HOME | AWAY | DIV | CONF | PF | PA | DIFF | STRK)
// ancho cómodo para que no se pisen; el contenedor hará scroll-x
// Grid (desktop) — TEAM menos ancho
const GRID_FULL =
  '56px minmax(140px,1.2fr) 48px 48px 48px 64px 84px 84px 84px 84px 64px 64px 68px 68px';

// Grid (mobile/tablet) — TEAM aún más compacto
const GRID_MOBILE =
  '36px minmax(72px,0.9fr) 42px 42px 42px 56px 64px 64px 64px 64px 56px 56px 60px 60px';

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
    const statObj = (arr, n) => arr.find(x => x.name === n || x.abbrev === n);
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
    const getStr = (n, arr) => (statObj(arr, n)?.displayValue) ?? (statObj(arr, n)?.value);
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
        home:      { w: ['homeWins', 'homewins', 'homeRecordWins'],         l: ['homeLosses', 'homelosses', 'homeRecordLosses'],         t: ['homeTies', 'hometies', 'homeRecordTies'] },
        away:      { w: ['awayWins', 'awaywins', 'awayRecordWins'],         l: ['awayLosses', 'awaylosses', 'awayRecordLosses'],         t: ['awayTies', 'awayties', 'awayRecordTies'] },
        division:  { w: ['divisionWins', 'divWins'],                        l: ['divisionLosses', 'divLosses'],                          t: ['divisionTies', 'divTies'] },
        conference:{ w: ['conferenceWins', 'confWins'],                     l: ['conferenceLosses', 'confLosses'],                       t: ['conferenceTies', 'confTies'] }
      };

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
  <span class="col-home">HOME</span>
  <span class="col-away">AWAY</span>
  <span class="col-div">DIV</span>
  <span class="col-conf">CONF</span>
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
            ${teamLabelsHTML(team)}
          </span>
          <span class="col-w num">${fmtInt(w)}</span>
          <span class="col-l num">${fmtInt(l)}</span>
          <span class="col-t num">${fmtInt(t)}</span>
          <span class="col-pct num">${pctText(w, l, t, stats)}</span>
          <span class="col-home num">${recordText('home', stats)}</span>
          <span class="col-away num">${recordText('away', stats)}</span>
          <span class="col-div num">${recordText('division', stats)}</span>
          <span class="col-conf num">${recordText('conference', stats)}</span>
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
  <span class="col-home">HOME</span>
  <span class="col-away">AWAY</span>
  <span class="col-div">DIV</span>
  <span class="col-conf">CONF</span>
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
              ${teamLabelsHTML(team)}
            </span>
            <span class="col-w num">${fmtInt(w)}</span>
            <span class="col-l num">${fmtInt(l)}</span>
            <span class="col-t num">${fmtInt(t)}</span>
            <span class="col-pct num">${pctText(w, l, t, stats)}</span>
            <span class="col-home num">${recordText('home', stats)}</span>
            <span class="col-away num">${recordText('away', stats)}</span>
            <span class="col-div num">${recordText('division', stats)}</span>
            <span class="col-conf num">${recordText('conference', stats)}</span>
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
  <span class="col-home">HOME</span>
  <span class="col-away">AWAY</span>
  <span class="col-div">DIV</span>
  <span class="col-conf">CONF</span>
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
            ${teamLabelsHTML(team)}
          </span>
          <span class="col-w num">${fmtInt(w)}</span>
          <span class="col-l num">${fmtInt(l)}</span>
          <span class="col-t num">${fmtInt(t)}</span>
          <span class="col-pct num">${pctText(w, l, t, stats)}</span>
          <span class="col-home num">${recordText('home', stats)}</span>
          <span class="col-away num">${recordText('away', stats)}</span>
          <span class="col-div num">${recordText('division', stats)}</span>
          <span class="col-conf num">${recordText('conference', stats)}</span>
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