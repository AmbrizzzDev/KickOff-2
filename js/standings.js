document.addEventListener('DOMContentLoaded', async () => {
    const standingsGrid = document.getElementById('standingsGrid');
    const API_KEY = 'ic01o41XelUxRoLTIHM0ZPtOIfEiBJVIsjO1skVt';
    
    async function fetchStandings(leagueId) {
        try {
            const response = await fetch(
                `https://api-football-v1.p.rapidapi.com/v3/standings?league=${leagueId}&season=2023`,
                {
                    headers: {
                        'X-RapidAPI-Key': API_KEY,
                        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
                    }
                }
            );
            const data = await response.json();
            return data.response[0].league.standings;
        } catch (error) {
            console.error('Error fetching standings:', error);
            return [];
        }
    }

    async function renderStandings(league = 'nfl') {
        standingsGrid.innerHTML = '<div class="loading">Cargando clasificaciones...</div>';
        
        try {
            const leagueId = league === 'nfl' ? 1 : 2; // Verificar IDs reales
            const standings = await fetchStandings(leagueId);
            
            standingsGrid.innerHTML = '';
            
            standings.forEach(conference => {
                const conferenceCard = document.createElement('div');
                conferenceCard.className = 'conference-card';
                conferenceCard.innerHTML = `
                    <h3 class="conference-title">${conference[0].group}</h3>
                    ${conference.map(team => `
                        <div class="team-row">
                            <div class="team-info">
                                <img src="${team.team.logo}" 
                                     alt="${team.team.name}" 
                                     class="team-logo-sm">
                                <span>${team.team.name}</span>
                            </div>
                            <div class="team-stats">
                                <span>${team.points}</span>
                                <span>${team.all.win}</span>
                                <span>${team.all.lose}</span>
                                <span>${team.goalsDiff}</span>
                            </div>
                        </div>
                    `).join('')}
                `;
                standingsGrid.appendChild(conferenceCard);
            });

        } catch (error) {
            standingsGrid.innerHTML = `
                <div class="error-message">
                    <h3>⚠️ Datos no disponibles</h3>
                    <p>La clasificación se actualizará pronto</p>
                </div>
            `;
        }
    }

    // Cambiar entre NFL/NCAA
    document.querySelectorAll('.league-switch button').forEach(btn => {
        btn.addEventListener('click', () => {
            renderStandings(btn.classList.contains('nfl-btn') ? 'nfl' : 'ncaa');
        });
    });

    // Carga inicial
    renderStandings();
});