document.addEventListener('DOMContentLoaded', () => {
    const matchesContainer = document.getElementById('matchesContainer');
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const searchInput = document.getElementById('searchInput');
    const weekFilter = document.getElementById('weekFilter');

    // Data example updated
    const matchesData = {
        nfl: [
            {
                teams: ["Kansas City Chiefs", "Philadelphia Eagles"],
                date: "2026-09-10",
                time: "20:30",
                stadium: "Arrowhead Stadium",
                week: 1,
                live: false,
                score: [0, 0],
                quarter: "",
                timeLeft: "",
                possession: "",
                drives: {
                    "KC": 0, // Change these values
                    "PHI": 0 // Change these values
                }
            },
            {
                teams: ["Dallas Cowboys", "San Francisco 49ers"],
                date: "2026-09-17",
                time: "18:00",
                stadium: "AT&T Stadium",
                week: 2,
                live: false,
                score: [0, 0],
                quarter: "",
                timeLeft: "",
                possession: "",
                drives: {
                    "DAL": 0, // Change these values
                    "SF": 0 // Change these values
                }
            }
        ],
        ncaa: [
            {
                teams: ["Alabama Crimson Tide", "Georgia Bulldogs"],
                date: "2026-09-09",
                time: "15:00",
                stadium: "Bryant-Denny Stadium",
                week: 1,
                live: false,
                score: [0, 0],
                quarter: "",
                timeLeft: "",
                possession: "",
                drives: {
                    "ALA": 0, // Change these values
                    "UGA": 0 // Change these values
                }
            }
        ]
    };

    function renderMatches(league = 'nfl', searchTerm = '', week = 'all') {
        matchesContainer.innerHTML = '';
        
        const filteredMatches = matchesData[league].filter(match => {
            const matchesSearch = match.teams.some(team => 
                team.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesWeek = week === 'all' || match.week.toString() === week;
            return matchesSearch && matchesWeek;
        });

        filteredMatches.forEach(match => {
            // Get team codes
            const team1Code = getTeamCode(match.teams[0]);
            const team2Code = getTeamCode(match.teams[1]);

            // Logo paths (in img/teams/nfl)
            const team1Logo = `img/teams/nfl/${team1Code}.png`;
            const team2Logo = `img/teams/nfl/${team2Code}.png`;

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
                        <img src="${team1Logo}" 
                             alt="${match.teams[0]}" class="team-logo">
                        <span class="team-name">${match.teams[0]}</span>
                        ${match.live ? `<span class="score">${match.score[0]}</span>` : ''}
                    </div>
                    <span class="vs-text">VS</span>
                    <div class="team ${match.possession === team2Code ? 'possessing' : ''}">
                        <img src="${team2Logo}" 
                             alt="${match.teams[1]}" class="team-logo">
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

    // Function to get team code
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
            "Washington Commanders": "wsh"
        };
        return teamCodes[teamName] || "default"; // Use "default" if code is not found
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

    // Initial render
    renderMatches();
});