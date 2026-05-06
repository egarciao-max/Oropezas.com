document.addEventListener("DOMContentLoaded", function() {
    // Inject i18n script early
    if (!window.i18n) {
        const s = document.createElement('script');
        s.src = (document.querySelector('script[src*="main.js"]')?.getAttribute('src') || 'main.js').replace('main.js', '') + 'js/i18n.js';
        document.head.appendChild(s);
    }
    // 1. Encontrar la ruta de la carpeta raíz basándonos en este script
    const scriptTag = document.querySelector('script[src*="main.js"]');
    const scriptPath = scriptTag.getAttribute('src');
    const rootPath = scriptPath.replace('main.js', '');

    // 2. Función para limpiar y arreglar el HTML inyectado
    const fixLinks = (html, base) => {
        let div = document.createElement('div');
        div.innerHTML = html;
        
        div.querySelectorAll('a[href^="/"]').forEach(link => {
            const actualPage = link.getAttribute('href').substring(1);
            link.setAttribute('href', base + actualPage);
        });

        div.querySelectorAll('img[src^="/"]').forEach(img => {
            const actualSrc = img.getAttribute('src').substring(1);
            img.setAttribute('src', base + actualSrc);
        });

        return div.innerHTML;
    };

    // 3. Cargar Navbar
    fetch(rootPath + 'navbar.html')
    .then(response => response.text())
    .then(data => {
        const headerEl = document.querySelector('header');
        headerEl.innerHTML = fixLinks(data, rootPath);
        headerEl.classList.add('loaded');
        // Apply current lang to toggle button
        setTimeout(() => {
            const lang = localStorage.getItem('oropezas_lang') || 'es';
            document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
                btn.textContent = lang === 'es' ? 'EN' : 'ES';
            });
        }, 50);
    })
    .catch(err => console.error("Error en Navbar:", err));

    // 4. Cargar Footer
    fetch(rootPath + 'footer.html')
        .then(response => response.text())
        .then(data => {
            document.querySelector('footer').innerHTML = fixLinks(data, rootPath);
        })
        .catch(err => console.error("Error en Footer:", err));

    // 5. Iconos Bootstrap
    if (!document.getElementById('bootstrap-icons')) {
        const link = document.createElement('link');
        link.id = 'bootstrap-icons';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
        document.head.appendChild(link);
    }

    // ========== SCROLL ANIMATIONS ==========
    
    // Intersection Observer para animaciones en scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = `fadeInUp 0.8s ease-out forwards`;
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar elementos con clase "scroll-reveal"
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });

    // ========== HEADER SCROLL EFFECT ==========
    
    let lastScrollTop = 0;
    const header = document.querySelector('header');

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Agregar sombra al scroll
        if (scrollTop > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, false);

    // ========== PARALLAX EFFECT ==========
    
    const parallaxElements = document.querySelectorAll('.featured-image img, .featured-image video');
    
    window.addEventListener('scroll', () => {
        parallaxElements.forEach(element => {
            const rect = element.getBoundingClientRect();
            const scrollPos = window.pageYOffset;
            const elementOffset = element.offsetTop;
            
            // Parallax leve (3%)
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const yPos = (scrollPos - elementOffset) * 0.03;
                element.style.transform = `translateY(${yPos}px)`;
            }
        });
    });

    // ========== STAGGER ANIMATIONS ==========
    
    // Para cards en grids
    const cards = document.querySelectorAll('.news-card, .article-card, .contact-card');
    cards.forEach((card, index) => {
        card.style.setProperty('--delay', `${0.1 * index}s`);
    });

    // ========== BUTTON RIPPLE EFFECT ==========
    
    const buttons = document.querySelectorAll('.read-more, .contact-card a');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // ========== SMOOTH SCROLL FOR NAVIGATION ==========
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // ========== PAGE LOAD COMPLETE ANIMATION ==========
    
    window.addEventListener('DOMContentLoaded', () => {
        document.body.style.opacity = '1';
    });

});
