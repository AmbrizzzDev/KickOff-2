document.addEventListener('DOMContentLoaded', () => {
    const matchesContainer = document.getElementById('matchesContainer');
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const searchInput = document.getElementById('searchInput');
    const weekFilter = document.getElementById('weekFilter');

    let matchesData = {};

    fetch('data/matches.json')
      .then(res => res.json())
      .then(data => {
        matchesData = data;
        renderMatches(); // solo después de cargar datos
      })
      .catch(err => console.error('Error al cargar el JSON:', err));    

    function renderMatches(league = 'nfl', searchTerm = '', week = 'all') {
        matchesContainer.innerHTML = '';
        
        const filteredMatches = matchesData[league].filter(match => {
            const matchesSearch = match.teams.some(team => 
                team.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesWeek = week === 'all' || match.week.toString() === week;
            return matchesSearch && matchesWeek;
        });

        if (filteredMatches.length === 0) {
            const noMatchesMessage = document.createElement('div');
            noMatchesMessage.className = 'no-matches-message';
            noMatchesMessage.innerHTML = `
                <p>No matches are scheduled at this time ${league === 'nfl' ? 'for NFL' : 'for NCAA'}.</p>
                <p>Check back later for upcoming meetings!</p>
            `;
            matchesContainer.appendChild(noMatchesMessage);
            return;
        }

        filteredMatches.forEach(match => {
            const team1Code = getTeamCode(match.teams[0]);
            const team2Code = getTeamCode(match.teams[1]);

            // Seleccionar logos según la liga
            const team1Logo = league === 'nfl'
                ? `img/teams/nfl/${team1Code}.png`
                : `img/teams/ncaa/${team1Code}.png`;

            const team2Logo = league === 'nfl'
                ? `img/teams/nfl/${team2Code}.png`
                : `img/teams/ncaa/${team2Code}.png`;

            const matchCard = document.createElement('div');
            matchCard.className = `match-card ${match.live ? 'live' : ''}`;
            matchCard.innerHTML = `
                <div class="match-header">
                    ${match.live ? '<div class="live-badge">LIVE</div>' : ''}
                    <span class="league-tag">${league.toUpperCase()}</span>
                    <span class="match-time">${match.live ? `${match.quarter} | ${match.timeLeft}` : `${match.date} | ${match.time}`}</span>
                </div>
                <div class="teams-container">
                    <div class="team ${match.possession === team1Code ? 'possessing' : ''}">
                        <img src="${team1Logo}" alt="${match.teams[0]}" class="team-logo">
                        <span class="team-name">${match.teams[0]}</span>
                        ${match.live ? `<span class="score">${match.score[0]}</span>` : ''}
                    </div>
                    <span class="vs-text">VS</span>
                    <div class="team ${match.possession === team2Code ? 'possessing' : ''}">
                        <img src="${team2Logo}" alt="${match.teams[1]}" class="team-logo">
                        <span class="team-name">${match.teams[1]}</span>
                        ${match.live ? `<span class="score">${match.score[1]}</span>` : ''}
                    </div>
                </div>
                ${match.live ? `
                <div class="live-stats">
                    <div class="drive-meter">
                        <span style="width: ${(match.drives[team1Code] / (match.drives[team1Code] + match.drives[team2Code])) * 100}%"></span>
                    </div>
                    <div class="game-info">
                        <span>${match.quarter}</span>
                        <span>${match.timeLeft}</span>
                    </div>
                </div>` : ''}
                <div class="match-details">
                    <p class="match-stadium">@ ${match.stadium}</p>
                </div>
            `;
            matchesContainer.appendChild(matchCard);
        });
    }

    function getTeamCode(teamName) {
        const teamCodes = {
            "Arizona Cardinals": "ari",
            "Atlanta Falcons": "atl",
            "Baltimore Ravens": "bal",
            "Buffalo Bills": "buf",
            "Carolina Panthers": "car",
            "Chicago Bears": "chi",
            "Cincinnati Bengals": "cin",
            "Cleveland Browns": "cle",
            "Dallas Cowboys": "dal",
            "Denver Broncos": "den",
            "Detroit Lions": "det",
            "Green Bay Packers": "gb",
            "Houston Texans": "hou",
            "Indianapolis Colts": "ind",
            "Jacksonville Jaguars": "jax",
            "Kansas City Chiefs": "kc",
            "Las Vegas Raiders": "lv",
            "Los Angeles Chargers": "lac",
            "Los Angeles Rams": "lar",
            "Miami Dolphins": "mia",
            "Minnesota Vikings": "min",
            "New England Patriots": "ne",
            "New Orleans Saints": "no",
            "New York Giants": "nyg",
            "New York Jets": "nyj",
            "Philadelphia Eagles": "phi",
            "Pittsburgh Steelers": "pit",
            "San Francisco 49ers": "sf",
            "Seattle Seahawks": "sea",
            "Tampa Bay Buccaneers": "tb",
            "Tennessee Titans": "ten",
            "Washington Commanders": "wsh",

            // NCAA (puedes agregar más)
            "Hawai'i": "hawaii",
            "Stephen F. Austin": "stephenf.austin",
            "San José State": "sanjoséstate",
            "St. Francis (PA)": "st.francis(pa)",
            "Miami (OH)": "miami(oh)",
            "Alabama A&M": "alabamaa&m",
            "East Texas A&M": "easttexasa&m",
            "Texas A&M": "texasa&m",
            "William & Mary": "william&mary",
            "Florida A&M": "floridaa&m",
            "Prairie View A&M": "prairieviewa&m",
            "North Carolina A&T": "northcarolinaa&t"
        };
        return teamCodes[teamName] || teamName.toLowerCase().replace(/[^a-z]/gi, '');
    }

    // Event Listeners
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMatches(btn.dataset.league, searchInput.value, weekFilter.value);
        });
    });

    searchInput.addEventListener('input', () => {
        renderMatches(
            document.querySelector('.toggle-btn.active').dataset.league,
            searchInput.value,
            weekFilter.value
        );
    });

    weekFilter.addEventListener('change', () => {
        renderMatches(
            document.querySelector('.toggle-btn.active').dataset.league,
            searchInput.value,
            weekFilter.value
        );
    });
});
