document.addEventListener('DOMContentLoaded', () => {
    const standingsGrid = document.getElementById('standingsTable');

    // Manual standings data
    const standingsData = {
        nfl: {
            
        },
        ncaa: {

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