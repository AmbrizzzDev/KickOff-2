document.addEventListener('DOMContentLoaded', () => {
    // League Switch Functionality
    const nflBtn = document.querySelector('.nfl-btn');
    const ncaaBtn = document.querySelector('.ncaa-btn');
    
    if (nflBtn && ncaaBtn) {
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
    }

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

document.addEventListener('DOMContentLoaded', () => {
    const DATE_TARGET = new Date('2025-09-04T00:20:00');
    const SPAN_DAYS = document.querySelector('span#days');
    const SPAN_HOURS = document.querySelector('span#hours');
    const SPAN_MINUTES = document.querySelector('span#minutes');
    const SPAN_SECONDS = document.querySelector('span#seconds');
  
    const CARDS = {
      days: SPAN_DAYS.parentElement,
      hours: SPAN_HOURS.parentElement,
      minutes: SPAN_MINUTES.parentElement,
      seconds: SPAN_SECONDS.parentElement
    };
  
    let last = {
      days: null, hours: null, minutes: null, seconds: null
    };
  
    function animate(card) {
      card.classList.remove('small-anim');
      // Reinicia animación
      void card.offsetWidth;
      card.classList.add('small-anim');
    }
  
    function updateCountdown() {
      const now = new Date();
      const diff = DATE_TARGET - now;
  
      const days = Math.max(Math.floor(diff / 8.64e7), 0);
      const hours = Math.max(Math.floor((diff % 8.64e7) / 3.6e6), 0);
      const minutes = Math.max(Math.floor((diff % 3.6e6) / 6e4), 0);
      const seconds = Math.max(Math.floor((diff % 6e4) / 1e3), 0);
  
      if (last.days !== days)   { SPAN_DAYS.textContent = days.toString().padStart(2,'0'); animate(CARDS.days);}
      if (last.hours !== hours) { SPAN_HOURS.textContent = hours.toString().padStart(2,'0'); animate(CARDS.hours);}
      if (last.minutes !== minutes) { SPAN_MINUTES.textContent = minutes.toString().padStart(2,'0'); animate(CARDS.minutes);}
      if (last.seconds !== seconds) { SPAN_SECONDS.textContent = seconds.toString().padStart(2,'0'); animate(CARDS.seconds);}
  
      last = {days, hours, minutes, seconds};
    }
  
    updateCountdown();
    setInterval(updateCountdown, 1000);
  });
  
  
  

    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };