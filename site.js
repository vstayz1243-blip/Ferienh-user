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
        const houseSelect = document.querySelector('#house');
        if (houseSelect) {
            houseSelect.value = house;
        } else {
            try { sessionStorage.setItem('preferredHouse', house); } catch {}
        }
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


// GSAP motion system: restrained reveals and image parallax.
(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gsap = window.gsap;
    if (!gsap || reduceMotion) return;

    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    const revealSelectors = [
        '.intro-grid', '.feature-strip', '.section-heading', '.house-card',
        '.availability-card', '.location-map', '.contact-intro', '.contact-form',
        '.detail-overview', '.photo-gallery', '.detail-features-grid', '.detail-booking'
    ];
    const revealTargets = revealSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]);
    revealTargets.forEach((element) => {
        gsap.fromTo(element,
            { autoAlpha: 0, y: 34 },
            {
                autoAlpha: 1, y: 0, duration: 0.85, ease: 'power2.out',
                scrollTrigger: window.ScrollTrigger ? { trigger: element, start: 'top 88%', once: true } : undefined
            }
        );
    });

    if (window.ScrollTrigger) {
        const parallax = (selector, yPercent) => {
            const element = document.querySelector(selector);
            if (!element) return;
            gsap.to(element, {
                yPercent, ease: 'none',
                scrollTrigger: { trigger: element.parentElement, start: 'top top', end: 'bottom top', scrub: 0.6 }
            });
        };
        parallax('.hero-image', 18);
        parallax('.statement-image', 14);

        document.querySelectorAll('.detail-hero').forEach((element) => {
            gsap.to(element, {
                '--parallax-y': '9%', ease: 'none',
                scrollTrigger: { trigger: element, start: 'top top', end: 'bottom top', scrub: 0.6 }
            });
        });
    }
})();
