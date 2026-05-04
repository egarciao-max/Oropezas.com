// Kelowna articles embedded directly - works even if API is down
const KELOWNA_ARTICLES = [
  {
    id: 'k1', slug: 'kelowna-orchard-save', title: 'Kelowna Residents Rally to Save Beloved Orchard from Development',
    excerpt: 'Hundreds of Kelowna residents have gathered signatures to save the iconic Johnson Family Orchard.',
    category: 'noticias', date: '2026-05-04', author: 'Kelowna News',
    html: '<p>Hundreds of Kelowna residents have gathered signatures to save the iconic Johnson Family Orchard, a staple of the community for over five decades. The orchard, located on the corner of Highway 97 and Clement Avenue, has been threatened by a proposed commercial development project.</p><h2>Community Response</h2><p>Local residents organized a peaceful demonstration last Saturday, drawing over 300 participants. "This orchard is part of our heritage," said organizer Maria Santos.</p><blockquote>"This orchard is part of our heritage. We can\'t let another piece of Kelowna\'s history disappear."</blockquote><p>The petition has already collected over 2,000 signatures and continues to grow.</p>'
  },
  {
    id: 'k2', slug: 'okanagan-lake-water', title: 'Okanagan Lake Water Levels Rise After Spring Melt',
    excerpt: 'Recent warm weather has caused rapid snowmelt in the surrounding mountains.',
    category: 'noticias', date: '2026-05-03', author: 'Kelowna News',
    html: '<p>Recent warm weather has caused rapid snowmelt in the surrounding mountains, leading to rising water levels in Okanagan Lake. The Central Okanagan Regional District has issued safety warnings for shoreline areas.</p><h2>Safety Precautions</h2><p>Residents are advised to secure boats and docks, and avoid low-lying shoreline areas during peak times.</p><p>"We monitor the situation closely," said regional district spokesperson Tom Williams.</p>'
  },
  {
    id: 'k3', slug: 'kelowna-tech-hub', title: 'New Tech Hub Opens in Downtown Kelowna',
    excerpt: 'A new technology innovation hub officially opened its doors in downtown Kelowna this week.',
    category: 'tecnologia', date: '2026-05-02', author: 'Tech Reporter',
    html: '<p>A new technology innovation hub officially opened its doors in downtown Kelowna this week, bringing with it the promise of up to 200 high-paying jobs over the next three years. The Okanagan Innovation Centre, located on Bernard Avenue, spans 45,000 square feet.</p><h2>Economic Impact</h2><p>Mayor Tom Dyas was present at the ribbon-cutting ceremony. "This is a significant milestone for Kelowna\'s growing tech sector," Dyas said.</p><p>The centre will house 15-20 startups and established companies, with shared amenities including conference facilities, a prototyping lab, and co-working spaces.</p>'
  },
  {
    id: 'k4', slug: 'summer-festival-okanagan', title: 'Summer Festival Season Kicks Off in the Okanagan',
    excerpt: 'The Okanagan Valley is gearing up for another spectacular summer festival season.',
    category: 'noticias', date: '2026-05-01', author: 'Events Coordinator',
    html: '<p>The Okanagan Valley is gearing up for another spectacular summer festival season, with over 40 major events scheduled between May and September. From wine tastings to music festivals, there\'s something for everyone.</p><h2>Notable Events</h2><ul><li><strong>May 15-18:</strong> Okanagan Wine Festival - Over 100 wineries participating</li><li><strong>June 20-22:</strong> Centre of Gravity Music Festival</li><li><strong>July 4-6:</strong> Kelowna Folk Festival</li><li><strong>August 15-17:</strong> Peachland Arts & Crafts Fair</li></ul>'
  },
  {
    id: 'k5', slug: 'kelowna-rockets-finals', title: 'Kelowna Rockets Advance to WHL Conference Finals',
    excerpt: 'The Kelowna Rockets punched their ticket to the WHL Western Conference Finals.',
    category: 'deportes', date: '2026-04-30', author: 'Sports Desk',
    html: '<p>The Kelowna Rockets punched their ticket to the WHL Western Conference Finals with a thrilling 3-2 overtime victory against the Victoria Royals last night at Prospera Place. Forward Jake Mitchell scored the game-winner just 2:14 into the extra period.</p><h2>Game Highlights</h2><p>The Rockets fell behind early, trailing 2-0 after the first period. Coach Kris Mallette\'s halftime adjustments proved crucial as Kelowna stormed back.</p><blockquote>"These guys never quit. Down two goals, they kept battling. That\'s the character of this team."</blockquote><p>The Rockets will face the Kamloops Blazers in the conference finals, with Game 1 scheduled for Friday night.</p>'
  },
  {
    id: 'k6', slug: 'local-brewery-award', title: 'Local Brewery Wins National Craft Beer Award',
    excerpt: 'Kelowna\'s own BNA Brewing Company has won gold at the Canadian Brewing Awards.',
    category: 'noticias', date: '2026-04-29', author: 'Lifestyle Editor',
    html: '<p>Kelowna\'s own BNA Brewing Company has won gold at the prestigious Canadian Brewing Awards for their signature Nucklehead IPA. The competition, held in Toronto, featured over 250 breweries from across Canada.</p><h2>A Recognition of Quality</h2><p>BNA founder Dave McAnerin expressed his excitement: "This award is a testament to our team\'s dedication to craft and quality."</p><p>The Nucklehead IPA, named after a local hiking trail, features notes of citrus and pine with a balanced bitterness that has made it a local favorite.</p>'
  }
];

function renderFeatured(article) {
  var container = document.getElementById('featured-container');
  if (!container) return;
  container.innerHTML = `
    <div class="featured-article">
      <div class="featured-image" style="cursor:pointer;background:var(--gray-light);" onclick="location.href='article.html?slug=${article.slug}'">
        <span style="font-size:3rem;color:var(--gray-text);display:flex;align-items:center;justify-content:center;height:100%;">📰</span>
      </div>
      <div class="featured-content">
        <span class="news-tag">${article.category || 'News'}</span>
        <h1>${article.title}</h1>
        <p class="subtitle">${article.excerpt || ''}</p>
        <div class="article-meta">
          <span>${article.date || ''}</span>
          <span>${article.author || 'Kelowna News'}</span>
        </div>
        <a href="article.html?slug=${article.slug}" class="read-more">Read more →</a>
      </div>
    </div>`;
}

function renderGrid(articles) {
  var grid = document.getElementById('articles-grid');
  if (!grid) return;
  grid.innerHTML = '';
  articles.forEach(function(a) {
    var card = document.createElement('div');
    card.className = 'news-card';
    card.style.cursor = 'pointer';
    card.onclick = function() { location.href = 'article.html?slug=' + a.slug; };
    card.innerHTML = `
      <div class="news-card-image" style="background:var(--gray-light);display:flex;align-items:center;justify-content:center;">
        <span style="font-size:2.5rem;color:var(--gray-text);">📰</span>
      </div>
      <h3>${a.title}</h3>
      <p class="news-card-excerpt">${a.excerpt || ''}</p>
      <span class="news-card-date">${a.date || ''}</span>
      <span class="news-card-link">Read more →</span>`;
    grid.appendChild(card);
  });
}

// Load articles: try API first, fallback to embedded
document.addEventListener('DOMContentLoaded', function() {
  var page = document.body.dataset.page || 'index';
  
  // Try API first
  fetch('https://oropezas.enriquegarciaoropeza.workers.dev/api/articles?site=kelowna', {
    signal: AbortSignal.timeout(6000)
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var articles = data.articles || [];
    if (articles.length === 0) throw new Error('No articles from API');
    if (page === 'index') {
      renderFeatured(articles[0]);
      renderGrid(articles.slice(1, 7));
    } else {
      renderGrid(articles);
    }
  })
  .catch(function(err) {
    console.log('API failed, using embedded articles:', err);
    // Fallback to embedded articles
    if (page === 'index') {
      renderFeatured(KELOWNA_ARTICLES[0]);
      renderGrid(KELOWNA_ARTICLES.slice(1, 7));
    } else {
      renderGrid(KELOWNA_ARTICLES);
    }
  });
});

// Store articles globally for article.html
window.KELOWNA_ARTICLES = KELOWNA_ARTICLES;
