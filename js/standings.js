document.addEventListener('DOMContentLoaded', async () => {
    const standingsGrid = document.getElementById('standingsGrid');
    
    async function fetchStandings() {
        try {
            const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings');
            const data = await response.json();
            
            console.log("API Response:", data); // ← Verifica esto en consola
            
            if (!data.children || data.children.length === 0) {
                return { 
                    status: 'PRE_SEASON',
                    message: 'La temporada no ha comenzado' 
                };
            }
            return data.children[0].standings.entries;
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }

    async function renderStandings() {
        standingsGrid.innerHTML = '<div class="loading">Loading standings...</div>';
        
        try {
            const standings = await fetchStandings();
            
            standingsGrid.innerHTML = '';
            
            standings.forEach(team => {
                const teamCard = document.createElement('div');
                teamCard.className = 'team-card';
                teamCard.innerHTML = `
                    <div class="team-info">
                        <img src="${team.team.logos[0].href}" 
                             alt="${team.team.displayName}" 
                             class="team-logo-sm">
                        <span>${team.team.displayName}</span>
                    </div>
                    <div class="team-stats">
                        <span>${team.stats[3].value}</span> <!-- Wins -->
                        <span>${team.stats[4].value}</span> <!-- Losses -->
                        <span>${team.stats[7].value}</span> <!-- Points For -->
                        <span>${team.stats[8].value}</span> <!-- Points Against -->
                    </div>
                `;
                standingsGrid.appendChild(teamCard);
            });

        } catch (error) {
            standingsGrid.innerHTML = `
                <div class="no-standings-message">
                    <p>No standings are available at this time.</p>
                    <p>Check back later for updated standings!</p>
                </div>
            `;
        }
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