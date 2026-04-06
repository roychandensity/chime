# Chime

Self-service workspace analytics dashboard for meeting room saturation, availability heatmaps, group size distribution, and desk classification — with PPTX export. Originally built on Stripe OWP data for Chime.

## Features

- Meeting room saturation analysis (hourly line charts, Mon–Fri)
- Meeting room availability heatmaps (floor × day-of-week)
- Group size distribution (stacked bar charts)
- Desk usage classification: Not Used, Pit Stop, In and Out, Deep Focus
- PowerPoint (PPTX) export via pptxgenjs
- JWT-based authentication
- Buildings and spaces discovered dynamically via API key

## Tech Stack

| Package | Version |
|---------|---------|
| Next.js | 16.1.6 |
| React | 19.2.4 |
| TypeScript | 5.9.3 |
| Recharts | 3.7.0 |
| pptxgenjs | 3.12.0 |
| date-fns | — |
| jose (JWT) | — |
| zod | — |
| SWR | — |

## Density API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v3/spaces?page_size=1000` | GET | Fetch building/floor/space hierarchy |
| `/v3/analytics/sessions/raw` | POST | Raw session data for desk classification |
| `/v3/analytics/metrics` | POST | Occupancy and utilization metrics |

## Environment Variables

Reference `.env.example` for the full list.

| Variable | Description |
|----------|-------------|
| `DENSITY_API_KEY` | Density API key for authenticating requests |
| `AUTH_SECRET` | Secret used to sign JWT tokens |
| `DASHBOARD_PASSWORD` | Password for dashboard login |

## Setup

```bash
cp .env.example .env.local
# Fill in the required environment variables
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
