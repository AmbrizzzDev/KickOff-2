document.addEventListener('DOMContentLoaded', () => {
    const standingsGrid = document.getElementById('standingsTable');

    // Manual standings data
    const standingsData = {
        nfl: {
            "AFC North": [
                { name: "Baltimore Ravens", logo: "img/teams/nfl/bal.png", w: 13, l: 4, t: 0, pf: 483 },
                { name: "Cleveland Browns", logo: "img/teams/nfl/cle.png", w: 11, l: 6, t: 0, pf: 396 },
                { name: "Pittsburgh Steelers", logo: "img/teams/nfl/pit.png", w: 10, l: 7, t: 0, pf: 324 },
                { name: "Cincinnati Bengals", logo: "img/teams/nfl/cin.png", w: 9, l: 8, t: 0, pf: 366 }
            ],
            "AFC East": [
                { name: "Buffalo Bills", logo: "img/teams/nfl/buf.png", w: 11, l: 6, t: 0, pf: 451 },
                { name: "Miami Dolphins", logo: "img/teams/nfl/mia.png", w: 11, l: 6, t: 0, pf: 496 },
                { name: "New York Jets", logo: "img/teams/nfl/nyj.png", w: 7, l: 10, t: 0, pf: 268 },
                { name: "New England Patriots", logo: "img/teams/nfl/ne.png", w: 4, l: 13, t: 0, pf: 236 }
            ]
        },
        ncaa: {
            "Big Ten East": [
                { name: "Michigan", logo: "img/teams/ncaa/mich.png", w: 15, l: 0, t: 0, pf: 572 },
                { name: "Ohio State", logo: "img/teams/ncaa/osu.png", w: 11, l: 2, t: 0, pf: 430 },
                { name: "Penn State", logo: "img/teams/ncaa/psu.png", w: 10, l: 3, t: 0, pf: 421 },
                { name: "Maryland", logo: "img/teams/ncaa/mary.png", w: 8, l: 5, t: 0, pf: 367 }
            ]
        }
    };

    function calculatePct(wins, losses, ties) {
        if (wins + losses + ties === 0) return .000;
        return ((wins + (ties * 0.5)) / (wins + losses + ties)).toFixed(3);
    }

    function renderStandings(league = 'nfl') {
        standingsGrid.innerHTML = '';
        const data = standingsData[league];
        
        if (!data || Object.keys(data).length === 0) {
            standingsGrid.innerHTML = `
                <div class="no-standings-message">
                    <p>No standings are available at this time ${league === 'nfl' ? 'for NFL' : 'for NCAA'}.</p>
                    <p>Check back later for updated standings!</p>
                </div>
            `;
            return;
        }

        Object.entries(data).forEach(([division, teams]) => {
            const divisionCard = document.createElement('div');
            divisionCard.className = 'standings-card';
            
            divisionCard.innerHTML = `
                <h3 class="conference-title">${division}</h3>
                <div class="division-badge">${league.toUpperCase()}</div>
                <div class="stats-header">
                    <div class="team-info">Team</div>
                    <div class="team-stats">
                        <span>W</span>
                        <span>L</span>
                        <span>T</span>
                        <span>PCT</span>
                        <span>PF</span>
                    </div>
                </div>
                ${teams.map(team => `
                    <div class="team-row">
                        <div class="team-info">
                            <img src="${team.logo}" alt="${team.name}" class="team-logo-sm">
                            <span>${team.name}</span>
                        </div>
                        <div class="team-stats">
                            <span>${team.w}</span>
                            <span>${team.l}</span>
                            <span>${team.t}</span>
                            <span>${calculatePct(team.w, team.l, team.t)}</span>
                            <span>${team.pf}</span>
                        </div>
                    </div>
                `).join('')}
            `;
            standingsGrid.appendChild(divisionCard);
        });
    }

    // Switch between NFL/NCAA
    document.querySelectorAll('.league-switch button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.league-switch button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderStandings(btn.classList.contains('nfl-btn') ? 'nfl' : 'ncaa');
        });
    });

    // Initial render
    renderStandings();
});