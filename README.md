# OrlandoTrackr

OrlandoTrackr helps Orlando theme park visitors compare live waits, choose a
park, and plan their day around the rides they most want to try. The web,
Android, and iOS apps will sync saved plans, with offline itinerary access
on mobile.

## Local development

The first local feature shows sample park and attraction waits. Install
Node 26.13.1, pnpm 12.18.0, and Rust 1.97.1. Run from the repository root.

```text
pnpm install --frozen-lockfile
pnpm data:local
pnpm dev
```

Open [the local dashboard](http://127.0.0.1:4173/). Native Windows uses a
loopback-only preview backed by local D1. Run in Linux or WSL with Docker
integration for the Worker and Axum container path.

Install Chromium with `pnpm exec playwright install chromium` and run
`pnpm verify` for format, lint, types, builds, and tests.

The live dashboard uses ThemeParks.wiki. Its Worker polls every five minutes
when configured with `WAIT_DATA_SOURCE=themeparks-wiki`. The dashboard shows
the latest available update and labels cached data during outages.

## Stack and environments

React Router and TypeScript 7+ power the web app. Rust and Axum provide the API
and planner. Kotlin and Compose Multiplatform power Android and iOS. Cloudflare
hosts the web app, API, database, scheduled jobs, and audit log storage.

| Environment | Git branch   | Where it runs                                                |
| ----------- | ------------ | ------------------------------------------------------------ |
| Test        | `test`       | Local Wrangler and Docker, or an isolated GitHub Actions job |
| Staging     | `staging`    | Dedicated staging Worker and resources in Cloudflare Main    |
| Production  | `production` | Dedicated production Worker and resources in Cloudflare Main |

Promote by pull request from `test` through `staging` to `production`.
The owner authorizes each production release.

Use `/health/live` for uptime monitoring. `/health` starts Axum if necessary
and reports the running container's release revision.
