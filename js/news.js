document.addEventListener('DOMContentLoaded', () => {
    const newsContainer = document.getElementById('newsContainer');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Datos de ejemplo
    const newsData = [
        {
            title: "Quarterback Trade Shock",
            category: "transfers",
            date: "2024-03-15",
            excerpt: "Breaking news about a major quarterback trade that's shaking the league...",
            image: 'img/news/trade_russel.jpeg'
        },
        {
            title: "Star Player Out for Season",
            category: "injuries",
            date: "2024-03-14",
            excerpt: "Devastating injury news hits championship contenders...",
            image: "img/news/injury.jpg"
        },
        {
            title: "The Edge With Micah Parsons",
            category: "interviews",
            date: "2024-03-13",
            excerpt: "S2 E25 is now available on 'Bleacher Report' Youtube Channel. Please watch!",
            image: "img/news/theedge.jpg"
        }
    ];

    function renderNews(category = 'all') {
        newsContainer.innerHTML = '';
        
        const filteredNews = newsData.filter(item => 
            category === 'all' || item.category === category
        );

        filteredNews.forEach(item => {
            const newsCard = document.createElement('article');
            newsCard.className = 'news-card';
            newsCard.innerHTML = `
                <img src="${item.image}" alt="${item.title}" class="news-image">
                <div class="news-content">
                    <span class="news-category">${item.category.toUpperCase()}</span>
                    <h3 class="news-title">${item.title}</h3>
                    <p class="news-date">${new Date(item.date).toLocaleDateString()}</p>
                    <p class="news-excerpt">${item.excerpt}</p>
                </div>
            `;
            newsContainer.appendChild(newsCard);
        });
    }

    // Event listeners para filtros
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNews(btn.dataset.category);
        });
    });

    // Render inicial
    renderNews();
});