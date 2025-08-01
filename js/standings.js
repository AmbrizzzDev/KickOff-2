document.addEventListener('DOMContentLoaded', async () => {
    const standingsGrid = document.getElementById('standingsGrid');
  
    // Helper para encontrar stats por name
    function getStat(stats, name) {
      const stat = stats.find(s => s.name === name);
      return stat ? stat.value ?? '-' : '-';
    }
  
    async function fetchStandings() {
        try {
          const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings');
          const data = await response.json();
          console.log(data); // Esto imprime la estructura real, revisa la consola
          return data;
        } catch (error) {
          console.error('Error:', error);
          return null;
        }
      }      
  
    async function renderStandings() {
      standingsGrid.innerHTML = '<div class="loading">Loading standings...</div>';
      const conferences = await fetchStandings();
      standingsGrid.innerHTML = '';
  
      if (!conferences.length) {
        standingsGrid.innerHTML = `<div class="no-standings-message"><p>No standings available at this time.</p></div>`;
        return;
      }
  
      conferences.forEach(group => {
        const groupTitle = group.name || group.abbreviation || '';
        const container = document.createElement('div');
        container.className = 'standings-group';
  
        container.innerHTML = `<h3 class="standings-group-title">${groupTitle}</h3>
          <div class="standings-header">
            <span>Team</span>
            <span>W</span>
            <span>L</span>
            <span>PF</span>
            <span>PA</span>
          </div>
          <div class="standings-teams"></div>
        `;
  
        const teamsContainer = container.querySelector('.standings-teams');
        (group.standings?.entries || []).forEach(team => {
          teamsContainer.innerHTML += `
            <div class="team-row">
              <span class="team-info">
                <img src="${team.team.logos?.[0]?.href || ''}" alt="${team.team.displayName}" class="team-logo-sm">
                ${team.team.displayName}
              </span>
              <span>${getStat(team.stats, 'wins')}</span>
              <span>${getStat(team.stats, 'losses')}</span>
              <span>${getStat(team.stats, 'pointsFor')}</span>
              <span>${getStat(team.stats, 'pointsAgainst')}</span>
            </div>
          `;
        });
  
        standingsGrid.appendChild(container);
      });
    }
  
    renderStandings();
  });
  