document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('#hamburger');
    const navLinks = document.querySelector('#navLinks');

    if (!hamburger || !navLinks) {
        console.error('Navigation elements not found');
        return;
    }

    // Toggle menu
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to document
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        // Only close if menu is active and click is outside menu and hamburger
        if (navLinks.classList.contains('active') && 
            !hamburger.contains(e.target) && 
            !navLinks.contains(e.target)) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });

    // Prevent clicks inside menu from closing it
    navLinks.addEventListener('click', (e) => {
        // Only stop propagation if not clicking a link
        if (!e.target.matches('a')) {
            e.stopPropagation();
        }
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close menu on window resize if it's open and screen becomes larger than mobile breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
});
