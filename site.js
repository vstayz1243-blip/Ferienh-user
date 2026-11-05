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
const BOOKING_URLS = {
    'Ferienhaus 141': 'https://etlink.hptouristik.de/?id=1828ce058f3e46a6b617ef0608db5af8',
    'Ferienhaus 136': 'https://etlink.hptouristik.de/?id=62e926f3435840d9977847435863ebc0'
};
const getBookingUrl = () => BOOKING_URLS[houseSelect?.value] || 'https://www.hptouristik.de/schwarzwald/bad-duerrheim/feriendorf-oefingen/';
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

// Five-second image carousels for the homepage and both house detail pages.
document.querySelectorAll('.house-gallery, .photo-gallery').forEach((gallery) => {
    const slides = [...gallery.querySelectorAll('[data-gallery-image]')];
    if (slides.length < 2) return;

    gallery.classList.add('gallery-carousel');
    let activeIndex = 0;
    let autoplayId;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'gallery-arrow gallery-arrow-prev';
    previous.setAttribute('aria-label', 'Vorheriges Bild');
    previous.innerHTML = '<span aria-hidden="true">‹</span>';

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'gallery-arrow gallery-arrow-next';
    next.setAttribute('aria-label', 'Nächstes Bild');
    next.innerHTML = '<span aria-hidden="true">›</span>';

    const counter = document.createElement('span');
    counter.className = 'gallery-slide-counter';
    counter.setAttribute('aria-live', 'polite');

    gallery.append(previous, next, counter);

    const showSlide = (index) => {
        activeIndex = (index + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => {
            const active = slideIndex === activeIndex;
            slide.classList.toggle('is-active', active);
            slide.setAttribute('aria-hidden', String(!active));
            slide.tabIndex = active ? 0 : -1;
        });
        counter.textContent = String(activeIndex + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    };

    const stopAutoplay = () => {
        if (autoplayId) window.clearInterval(autoplayId);
        autoplayId = undefined;
    };
    const startAutoplay = () => {
        stopAutoplay();
        if (!prefersReducedMotion) autoplayId = window.setInterval(() => showSlide(activeIndex + 1), 5000);
    };

    previous.addEventListener('click', (event) => {
        event.stopPropagation();
        showSlide(activeIndex - 1);
        startAutoplay();
    });
    next.addEventListener('click', (event) => {
        event.stopPropagation();
        showSlide(activeIndex + 1);
        startAutoplay();
    });

    gallery.addEventListener('pointermove', (event) => {
        const bounds = gallery.getBoundingClientRect();
        const relativeX = (event.clientX - bounds.left) / bounds.width;
        gallery.classList.toggle('show-prev-arrow', relativeX <= 0.1);
        gallery.classList.toggle('show-next-arrow', relativeX >= 0.9);
    });
    gallery.addEventListener('pointerleave', () => {
        gallery.classList.remove('show-prev-arrow', 'show-next-arrow');
    });
    gallery.addEventListener('mouseenter', stopAutoplay);
    gallery.addEventListener('mouseleave', startAutoplay);
    gallery.addEventListener('focusin', stopAutoplay);
    gallery.addEventListener('focusout', (event) => {
        if (!gallery.contains(event.relatedTarget)) startAutoplay();
    });

    slides.forEach((slide) => {
        slide.addEventListener('click', () => {
            const dialog = document.querySelector('#galleryLightbox');
            const image = dialog?.querySelector('img');
            if (!dialog || !image) return;
            const source = slide.dataset.galleryImage;
            image.src = source;
            image.alt = slide.querySelector('img')?.alt || 'Ferienhaus – vergrößertes Bild';
            dialog.showModal();
        });
    });

    showSlide(0);
    startAutoplay();
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


// Live availability calendars. iCal URLs stay server-side; the browser only calls our own API.
(() => {
    const now = new Date();
    const availabilityCache = new Map();

    const loadAvailability = async (house) => {
        if (availabilityCache.has(house)) return availabilityCache.get(house);
        const request = fetch(`/api/availability?house=${encodeURIComponent(house)}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        }).then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Verfügbarkeitsdaten konnten nicht geladen werden.');
            return payload;
        });
        availabilityCache.set(house, request);
        try {
            return await request;
        } catch (error) {
            availabilityCache.delete(house);
            throw error;
        }
    };

    document.querySelectorAll('[data-calendar-house]').forEach((card) => {
        const house = card.dataset.calendarHouse;
        let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        let bookedDates = new Set();
        let dataLoaded = false;
        const monthLabel = card.querySelector('[data-calendar-month]');
        const daysContainer = card.querySelector('[data-calendar-days]');
        const status = card.querySelector('[data-calendar-status]');

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
                const date = new Date(year, month, day);
                const key = [year, String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
                const cell = document.createElement('span');
                const isBooked = bookedDates.has(key);
                const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                cell.className = 'calendar-day ' + (!dataLoaded ? 'is-unknown' : isBooked ? 'is-booked' : isPast ? 'is-past' : 'is-free');
                cell.textContent = String(day);
                const state = !dataLoaded ? 'Daten nicht verfügbar' : isBooked ? 'Belegt' : isPast ? 'Vergangenheit' : 'Laut H&P iCal frei';
                cell.setAttribute('aria-label', `${day}. ${monthLabel.textContent}: ${state}`);
                if (year === now.getFullYear() && month === now.getMonth() && day === now.getDate()) cell.classList.add('is-today');
                daysContainer.append(cell);
            }
        };

        const setStatus = (message, state = '') => {
            if (!status) return;
            status.textContent = message;
            status.dataset.state = state;
        };

        card.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
            displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
            render();
        });
        card.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
            displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
            render();
        });

        render();
        loadAvailability(house).then((payload) => {
            bookedDates = new Set(payload.bookedDates || []);
            dataLoaded = true;
            render();
            const fetchedAt = payload.fetchedAt ? new Date(payload.fetchedAt) : null;
            const time = fetchedAt && !Number.isNaN(fetchedAt.getTime())
                ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(fetchedAt)
                : '';
            setStatus(`Live-Daten von H&P geladen${time ? ' · Stand: ' + time : ''}. Freie Tage sind unverbindlich; maßgeblich ist die Buchungsbestätigung von H&P.`, 'success');
        }).catch((error) => {
            dataLoaded = false;
            render();
            setStatus('Live-Daten aktuell nicht erreichbar. Bitte Verfügbarkeit direkt bei H&P prüfen. (' + error.message + ')', 'error');
        });
    });
})();
