document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.getElementById('navLinks');
  
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  
    // Optional: close menu when a link is clicked (for better UX)
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
      });
    });
  });