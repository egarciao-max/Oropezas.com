document.addEventListener("DOMContentLoaded", function() {
    // 1. Encontrar la ruta de la carpeta raíz basándonos en este script
    // Esto evita usar "/" o "../" manualmente
    const scriptTag = document.querySelector('script[src*="main.js"]');
    const scriptPath = scriptTag.getAttribute('src');
    const rootPath = scriptPath.replace('main.js', ''); // Esto nos da "./" o "../" automáticamente

    // 2. Función para limpiar y arreglar el HTML inyectado
    const fixLinks = (html, base) => {
        let div = document.createElement('div');
        div.innerHTML = html;
        
        // Corregir todos los href que empiezan con "/"
        div.querySelectorAll('a[href^="/"]').forEach(link => {
            const actualPage = link.getAttribute('href').substring(1); // quita la /
            link.setAttribute('href', base + actualPage);
        });

        // Corregir el logo (img src)
        div.querySelectorAll('img[src^="/"]').forEach(img => {
            const actualSrc = img.getAttribute('src').substring(1); // quita la /
            img.setAttribute('src', base + actualSrc);
        });

        return div.innerHTML;
    };

    // 3. Cargar Navbar
    fetch(rootPath + 'navbar.html')
        .then(response => response.text())
        .then(data => {
            document.querySelector('header').innerHTML = fixLinks(data, rootPath);
        })
        .catch(err => console.error("Error en Navbar:", err));

    // 4. Cargar Footer
    fetch(rootPath + 'footer.html')
        .then(response => response.text())
        .then(data => {
            document.querySelector('footer').innerHTML = fixLinks(data, rootPath);
        })
        .catch(err => console.error("Error en Footer:", err));

    // 5. Iconos
    if (!document.getElementById('bootstrap-icons')) {
        const link = document.createElement('link');
        link.id = 'bootstrap-icons';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
        document.head.appendChild(link);
    }
});
