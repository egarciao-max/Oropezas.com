document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');

    if (header) {
        fetch('navbar.html')
            .then(res => res.text())
            .then(html => { header.innerHTML = html; })
            .catch(err => console.error('Error loading navbar:', err));
    }

    if (footer) {
        fetch('footer.html')
            .then(res => res.text())
            .then(html => { footer.innerHTML = html; })
            .catch(err => console.error('Error loading footer:', err));
    }
});
