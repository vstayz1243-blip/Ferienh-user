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
            houseSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            try { sessionStorage.setItem('preferredHouse', house); } catch {}
        }
    });
});

const form = document.querySelector('#contactForm');
const formMessage = document.querySelector('#formMessage');
const arrival = document.querySelector('#arrival');
const departure = document.querySelector('#departure');
const guests = document.querySelector('#guests');
const houseSelect = document.querySelector('#house');
const stayDuration = document.querySelector('#stayDuration');
const stayDates = document.querySelector('#stayDates');
const stayNights = document.querySelector('#stayNights');
const checkAvailabilityLink = document.querySelector('#checkAvailabilityLink');

const formatDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .format(new Date(value + 'T12:00:00'));
};
const getNights = () => {
    if (!arrival?.value || !departure?.value) return 0;
    const startDate = new Date(arrival.value + 'T00:00:00');
    const endDate = new Date(departure.value + 'T00:00:00');
    return Math.round((endDate - startDate) / 86400000);
};
const getBookingUrl = () => {
    const housePath = houseSelect?.value === 'Ferienhaus 141' ? 'ofi-141'
        : houseSelect?.value === 'Ferienhaus 136' ? 'ofi-136' : null;
    if (!housePath) return 'https://www.hptouristik.de/schwarzwald/bad-duerrheim/feriendorf-oefingen/';
    const url = new URL('https://www.hptouristik.de/schwarzwald/bad-duerrheim/feriendorf-oefingen/' + housePath);
    if (arrival?.value) url.searchParams.set('from', arrival.value);
    if (departure?.value) url.searchParams.set('to', departure.value);
    if (guests?.value) url.searchParams.set('persons', guests.value);
    return url.toString();
};
const updateBookingSummary = () => {
    if (!arrival || !departure) return;
    const nights = getNights();
    const validDates = nights > 0;
    if (stayDuration) stayDuration.textContent = validDates ? nights + (nights === 1 ? ' Übernachtung' : ' Übernachtungen') : 'Bitte wähle An- und Abreise';
    if (stayDates) stayDates.textContent = arrival.value && departure.value && validDates
        ? formatDate(arrival.value) + ' – ' + formatDate(departure.value)
        : 'Dein Zeitraum wird hier zusammengefasst.';
    if (stayNights) stayNights.textContent = validDates ? String(nights) : '–';
    if (departure) departure.min = arrival.value || new Date().toISOString().slice(0, 10);
    if (checkAvailabilityLink) checkAvailabilityLink.href = getBookingUrl();
};
if (arrival && departure) {
    const now = new Date();
    const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    arrival.min = today;
    departure.min = today;
    arrival.addEventListener('change', () => {
        if (departure.value && departure.value <= arrival.value) departure.value = '';
        updateBookingSummary();
    });
    departure.addEventListener('change', updateBookingSummary);
}
[guests, houseSelect].forEach((field) => field?.addEventListener('change', updateBookingSummary));
updateBookingSummary();

form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const nights = getNights();
    if (nights < 1) {
        departure?.setCustomValidity('Die Abreise muss mindestens einen Tag nach der Anreise liegen.');
        departure?.reportValidity();
        departure?.setCustomValidity('');
        return;
    }
    const data = new FormData(form);
    const bookingUrl = getBookingUrl();
    const subject = encodeURIComponent('Buchungsanfrage – ' + data.get('house'));
    const body = encodeURIComponent([
        'Name: ' + data.get('name'),
        'E-Mail: ' + data.get('email'),
        'Haus: ' + data.get('house'),
        'Anreise: ' + formatDate(data.get('arrival')),
        'Abreise: ' + formatDate(data.get('departure')),
        'Aufenthaltsdauer: ' + nights + (nights === 1 ? ' Nacht' : ' Nächte'),
        'Personen: ' + data.get('guests'),
        '',
        'Verfügbarkeit bei H&P: ' + bookingUrl,
        '',
        'Nachricht: ' + (data.get('message') || 'Keine zusätzliche Nachricht')
    ].join('\n'));
    formMessage.textContent = 'Dein E-Mail-Programm wird geöffnet. Bitte ergänze den Empfänger, prüfe die Angaben und sende die Anfrage ab.';
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
        houseSelect.dispatchEvent(new Event('change', { bubbles: true }));
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


// Frontend calendar shell. Dates remain explicitly unknown until server-side iCal data is connected.
(() => {
    const now = new Date();
    document.querySelectorAll('[data-calendar-house]').forEach((card) => {
        let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthLabel = card.querySelector('[data-calendar-month]');
        const daysContainer = card.querySelector('[data-calendar-days]');
        const render = () => {
            const year = displayedMonth.getFullYear();
            const month = displayedMonth.getMonth();
            monthLabel.textContent = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(displayedMonth);
            daysContainer.replaceChildren();
            const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let i = 0; i < firstWeekday; i++) {
                const blank = document.createElement('span');
                blank.className = 'calendar-day is-empty';
                blank.setAttribute('aria-hidden', 'true');
                daysContainer.append(blank);
            }
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('span');
                cell.className = 'calendar-day is-unknown';
                cell.textContent = String(day);
                cell.setAttribute('aria-label', day + '. ' + monthLabel.textContent + ': Belegungsdaten noch nicht verfügbar');
                if (year === now.getFullYear() && month === now.getMonth() && day === now.getDate()) cell.classList.add('is-today');
                daysContainer.append(cell);
            }
        };
        card.querySelector('[data-calendar-prev]')?.addEventListener('click', () => { displayedMonth.setMonth(displayedMonth.getMonth() - 1); render(); });
        card.querySelector('[data-calendar-next]')?.addEventListener('click', () => { displayedMonth.setMonth(displayedMonth.getMonth() + 1); render(); });
        render();
    });
})();
