document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');

    // Hamburger Menu Toggle
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // League Switch Functionality
    const nflBtn = document.querySelector('.nfl-btn');
    const ncaaBtn = document.querySelector('.ncaa-btn');
    
    nflBtn.addEventListener('click', () => {
        nflBtn.classList.add('active');
        ncaaBtn.classList.remove('active');
        // Add NFL content loading logic
    });

    ncaaBtn.addEventListener('click', () => {
        ncaaBtn.classList.add('active');
        nflBtn.classList.remove('active');
        // Add NCAA content loading logic
    });

    // Update favicon
function updateFavicon() {
    const favicon = document.querySelector("link[rel='icon']");
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        favicon.href = "img/favicon-dark.ico";
    } else {
        favicon.href = "img/favicon-light.ico";
    }
}

// Update favicon on page load
updateFavicon();

// Update favicon when user changes system theme
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateFavicon);
});