# Ferienhäuser 141 / 136 – Schwarzwald

Responsive website for the two holiday homes in Feriendorf Öfingen, including live occupancy calendars backed by the H&P iCal feeds.

## Requirements

- Node.js 20.6 or newer
- npm

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add the two private iCal URLs supplied by H&P to `.env`:

   ```dotenv
   HP_ICAL_141_URL=...
   HP_ICAL_136_URL=...
   PORT=3000
   ```

   Keep the real URLs private. The `.env` file is excluded from Git.

4. Start the website:

   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Availability API

- `GET /api/health` – health check
- `GET /api/availability?house=141` – booked dates for house 141
- `GET /api/availability?house=136` – booked dates for house 136

The server fetches and parses the H&P iCal feeds. The browser never receives the private feed URLs. Results are cached in memory for one minute to avoid repeatedly requesting the feeds.

The API returns ISO calendar dates in `bookedDates`. iCalendar end dates are treated as exclusive, as required by the iCalendar standard. Recurring events are expanded within the next 18 months.

## Deployment

This project now needs a Node.js-capable hosting environment. GitHub stores the source code but does not run the API; GitHub Pages alone cannot execute `server.mjs`.

On the hosting provider:

1. Deploy the repository with Node.js 20.6 or newer.
2. Set the environment variables `HP_ICAL_141_URL` and `HP_ICAL_136_URL` using the exact private URLs from H&P.
3. Set the start command to `npm start`.
4. Do not add the feed URLs to frontend files, commits, build logs, or public configuration.

The website and `/api/availability` must be served from the same origin so the browser can call the API without exposing feed credentials or requiring a public CORS proxy.

## Booking

The booking buttons link directly to the H&P booking links for the respective houses. Availability displayed on this website is indicative; H&P's booking system and its booking confirmation remain authoritative.

## Images and licensing

The website currently uses Unsplash-hosted stock photos as temporary illustrative imagery. The homepage house cards each contain a five-image gallery; the two property detail pages also contain five-image galleries. The images are not photographs of the actual holiday homes.

A public image-credit page is available at `bildnachweise.html`. The photo assets were audited across the HTML and CSS files; all externally loaded photographic assets found in the repository are served from `images.unsplash.com`. The standard Unsplash License permits free commercial and non-commercial use without mandatory attribution. It is not a public-domain dedication. Rights in recognizable people, trademarks, logos, and depicted artworks may require separate clearance. Review the current [Unsplash License](https://unsplash.com/de/lizenz) and [Terms](https://unsplash.com/terms) before publication.

Replace the stock photos with original property photos before presenting the galleries as factual representations of the houses.


## Local Python backend (FastAPI)

For local testing, an alternative FastAPI backend with Pydantic v2 validation is available in `backend/`. It reads the same private `HP_ICAL_141_URL` and `HP_ICAL_136_URL` variables from the root `.env`.

See [backend/README.md](backend/README.md) for installation and startup. Run FastAPI on `127.0.0.1:8000` and the existing static Node server on `localhost:3000`; the frontend automatically calls FastAPI while running on localhost. The Node backend remains available for the existing production deployment path.


## Automated tests

Run the existing Node.js API and static-file integration tests:

```bash
npm test
```

Run the Python FastAPI, Pydantic and iCalendar tests:

```bash
source .venv/bin/activate
python -m pytest backend/tests -v
```

Run the browser end-to-end and frontend security tests (Playwright):

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright suite starts an isolated Node web server on port 4173 and runs in desktop Chromium and a mobile Chromium profile. Calendar API responses are mocked with deterministic test data; private H&P feeds and real bookings are not contacted. The suite covers navigation, both property detail pages, calendar loading/navigation/error states, gallery controls/lightbox/autoplay, contact-form validation, booking-link selection, responsive overflow, SEO basics, frontend secret exposure, path traversal and baseline security headers.

Playwright reports are written to `playwright-report/` and failure artifacts to `test-results/`; both directories are excluded from Git.

GitHub Actions runs the Node.js, Python and Playwright suites on pushes to `main` and pull requests targeting `main`.
