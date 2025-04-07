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

// En tu archivo JS (scripts.js)
function updateFavicon() {
    const favicon = document.querySelector("link[rel='icon']");
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        favicon.href = "img/favicon-dark.ico";
    } else {
        favicon.href = "img/favicon-light.ico";
    }
}

// Cambiar favicon al cargar la página
updateFavicon();

// Cambiar favicon si el usuario cambia el modo del sistema
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateFavicon);
});