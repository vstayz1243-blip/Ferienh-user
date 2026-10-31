const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-navigation');

menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Menü öffnen' : 'Menü schließen');
    navigation?.classList.toggle('is-open', !open);
    document.body.classList.toggle('menu-open', !open);
});

navigation?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
        menuButton?.setAttribute('aria-expanded', 'false');
        menuButton?.setAttribute('aria-label', 'Menü öffnen');
        navigation?.classList.remove('is-open');
        document.body.classList.remove('menu-open');
    });
});

document.querySelectorAll('[data-house-link]').forEach((link) => {
    link.addEventListener('click', () => {
        const house = link.dataset.houseLink;
        try { sessionStorage.setItem('preferredHouse', house); } catch {}
    });
});

const form = document.querySelector('#contactForm');
const formMessage = document.querySelector('#formMessage');
const arrival = document.querySelector('#arrival');
const departure = document.querySelector('#departure');
if (arrival && departure) {
    arrival.addEventListener('change', () => {
        departure.min = arrival.value || '';
        if (departure.value && departure.value <= arrival.value) departure.value = '';
    });
}

form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = encodeURIComponent('Anfrage ' + data.get('house'));
    const body = encodeURIComponent([
        'Name: ' + data.get('name'),
        'E-Mail: ' + data.get('email'),
        'Haus: ' + data.get('house'),
        'Anreise: ' + (data.get('arrival') || 'Noch offen'),
        'Abreise: ' + (data.get('departure') || 'Noch offen'),
        'Personen: ' + (data.get('guests') || 'Nicht angegeben'),
        '',
        data.get('message')
    ].join('\n'));
    formMessage.textContent = 'Dein E-Mail-Programm wird geöffnet. Bitte ergänze dort den Empfänger und sende die Nachricht ab.';
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
});

document.querySelectorAll('[data-gallery-image]').forEach((button) => {
    button.addEventListener('click', () => {
        const dialog = document.querySelector('#galleryLightbox');
        const image = dialog?.querySelector('img');
        if (!dialog || !image) return;
        image.src = button.dataset.galleryImage;
        image.alt = button.querySelector('img')?.alt || 'Ferienhaus – vergrößertes Bild';
        dialog.showModal();
    });
});
const lightbox = document.querySelector('#galleryLightbox');
lightbox?.querySelector('.lightbox-close')?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close();
});

try {
    const preferred = sessionStorage.getItem('preferredHouse');
    const houseSelect = document.querySelector('#house');
    if (preferred && houseSelect) {
        houseSelect.value = preferred;
        sessionStorage.removeItem('preferredHouse');
    }
} catch {}

const year = new Date().getFullYear();
document.querySelectorAll('#year, [data-year]').forEach((node) => node.textContent = year);
