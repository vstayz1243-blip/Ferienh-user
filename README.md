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
