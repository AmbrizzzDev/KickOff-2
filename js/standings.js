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

  // Responsive helpers for team label
  const isDesktop = () => window.matchMedia('(min-width: 1400px)').matches;
  const teamLabel = (team) => {
    const full = team.displayName || team.shortDisplayName || team.abbreviation || '';
    const abbr = team.abbreviation || team.shortDisplayName || full;
    if ((currentView === 'division' || currentView === 'league') && isDesktop()) {
      return { text: full, cls: 'team-name' };
    }
    return { text: abbr, cls: 'team-abbr' };
  };

  // Grid template for all columns (Team | W | L | T | PCT | HOME | AWAY | DIV | CONF | PF | PA | DIFF | STRK)
  const GRID_FULL = '1.6fr 36px 36px 36px 64px 86px 86px 72px 72px 64px 64px 64px 64px';

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
    const apply = () => {
      card.style.setProperty('--gridCols', GRID_FULL);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(card);
    apply();
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

  async function renderStandings() {
    updateControlsUI();
    standingsGrid.innerHTML = '<div class="loading">Loading standings...</div>';
    const conferences = await fetchStandings();
    standingsGrid.innerHTML = '';

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
            <span>Team</span>
            <span>W</span>
            <span>L</span>
            <span>T</span>
            <span>PCT</span>
            <span>HOME</span>
            <span>AWAY</span>
            <span>DIV</span>
            <span>CONF</span>
            <span>PF</span>
            <span>PA</span>
            <span>DIFF</span>
            <span>STRK</span>
          </div>
          <div class="standings-teams"></div>
        </div>
      `;

      const teamsContainer = container.querySelector(".standings-teams");
      allEntries.forEach(tr => {
        const team = tr.team || tr;
        const stats = tr.stats || [];
        const w = getNum('wins', stats);
        const l = getNum('losses', stats);
        const t = getNum('ties', stats);
        const label = teamLabel(team);
        teamsContainer.innerHTML += `
          <div class="team-row" style="${rowStyle}">
            <span class="team-sticky">
              <img src="${team.logos?.[0]?.href || team.logo || ''}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
              <span class="${label.cls}">${label.text}</span>
            </span>
            <span class="num">${fmtInt(w)}</span>
            <span class="num">${fmtInt(l)}</span>
            <span class="num">${fmtInt(t)}</span>
            <span class="num">${pctText(w, l, t, stats)}</span>
            <span class="num">${recordText('home', stats)}</span>
            <span class="num">${recordText('away', stats)}</span>
            <span class="num">${recordText('division', stats)}</span>
            <span class="num">${recordText('conference', stats)}</span>
            <span class="num">${fmtNum(getNum('pointsFor', stats))}</span>
            <span class="num">${fmtNum(getNum('pointsAgainst', stats))}</span>
            <span class="num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
            <span class="num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
          </div>
        `;
      });

      attachResponsiveColumns(container);
      attachHorizontalSlider(container);
      container.scrollLeft = 0;
      standingsGrid.appendChild(container);
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
              <span>Team</span>
              <span>W</span>
              <span>L</span>
              <span>T</span>
              <span>PCT</span>
              <span>HOME</span>
              <span>AWAY</span>
              <span>DIV</span>
              <span>CONF</span>
              <span>PF</span>
              <span>PA</span>
              <span>DIFF</span>
              <span>STRK</span>
            </div>
            <div class="standings-teams"></div>
          </div>
        `;

        const teamsContainer = container.querySelector(".standings-teams");
        confEntries.forEach(tr => {
          const team = tr.team || tr;
          const stats = tr.stats || [];
          const w = getNum('wins', stats);
          const l = getNum('losses', stats);
          const t = getNum('ties', stats);
          teamsContainer.innerHTML += `
            <div class="team-row" style="${rowStyle}">
              <span class="team-sticky">
                <img src="${team.logos?.[0]?.href || team.logo || ''}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
                <span class="team-abbr">${team.abbreviation || team.shortDisplayName || ''}</span>
              </span>
              <span class="num">${fmtInt(w)}</span>
              <span class="num">${fmtInt(l)}</span>
              <span class="num">${fmtInt(t)}</span>
              <span class="num">${pctText(w, l, t, stats)}</span>
              <span class="num">${recordText('home', stats)}</span>
              <span class="num">${recordText('away', stats)}</span>
              <span class="num">${recordText('division', stats)}</span>
              <span class="num">${recordText('conference', stats)}</span>
              <span class="num">${fmtNum(getNum('pointsFor', stats))}</span>
              <span class="num">${fmtNum(getNum('pointsAgainst', stats))}</span>
              <span class="num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
              <span class="num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
            </div>
          `;
        });

        attachResponsiveColumns(container);
        attachHorizontalSlider(container);
        container.scrollLeft = 0;
        standingsGrid.appendChild(container);
      });
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
            <span>Team</span>
            <span>W</span>
            <span>L</span>
            <span>T</span>
            <span>PCT</span>
            <span>HOME</span>
            <span>AWAY</span>
            <span>DIV</span>
            <span>CONF</span>
            <span>PF</span>
            <span>PA</span>
            <span>DIFF</span>
            <span>STRK</span>
          </div>
          <div class="standings-teams"></div>
        </div>
      `;

      const teamsContainer = container.querySelector('.standings-teams');
      const entries = div.standings?.entries || div.teamRecords || [];

      // Sort by wins desc, then point differential desc
      entries.sort((a, b) => {
        const as = a.stats || []; const bs = b.stats || [];
        const gv = (arr, n) => Number(statObj(arr, n)?.value ?? 0);
        const aw = gv(as,'wins'); const bw = gv(bs,'wins');
        if (bw !== aw) return bw - aw;
        const apd = gv(as,'pointsFor') - gv(as,'pointsAgainst');
        const bpd = gv(bs,'pointsFor') - gv(bs,'pointsAgainst');
        return bpd - apd;
      });

      entries.forEach(tr => {
        const team = tr.team || tr;
        const stats = tr.stats || [];
        const w = getNum('wins', stats);
        const l = getNum('losses', stats);
        const t = getNum('ties', stats);
        const label = teamLabel(team);
        teamsContainer.innerHTML += `
          <div class="team-row" style="${rowStyle}">
            <span class="team-sticky">
              <img src="${team.logos?.[0]?.href || team.logo || ''}" alt="${team.abbreviation || team.shortDisplayName || ''}" class="team-logo-sm">
              <span class="${label.cls}">${label.text}</span>
            </span>
            <span class="num">${fmtInt(w)}</span>
            <span class="num">${fmtInt(l)}</span>
            <span class="num">${fmtInt(t)}</span>
            <span class="num">${pctText(w, l, t, stats)}</span>
            <span class="num">${recordText('home', stats)}</span>
            <span class="num">${recordText('away', stats)}</span>
            <span class="num">${recordText('division', stats)}</span>
            <span class="num">${recordText('conference', stats)}</span>
            <span class="num">${fmtNum(getNum('pointsFor', stats))}</span>
            <span class="num">${fmtNum(getNum('pointsAgainst', stats))}</span>
            <span class="num">${fmtNum(getNum('pointsFor', stats) - getNum('pointsAgainst', stats))}</span>
            <span class="num">${getStr('streak', stats) || ((getStr('streakType', stats) || '') + (getStr('streakLength', stats) || '')) || '-'}</span>
          </div>
        `;
      });

      attachResponsiveColumns(container);
      attachHorizontalSlider(container);
      container.scrollLeft = 0;
      standingsGrid.appendChild(container);
    });
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

  // Re-render on viewport changes so desktop shows full names and mobile shows abbreviations
  window.addEventListener('resize', () => {
    if (currentView === 'division' || currentView === 'league') {
      renderStandings();
    }
  });

  updateControlsUI();
  renderStandings();
});