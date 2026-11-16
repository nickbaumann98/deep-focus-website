# Deep Focus funnel

Owner: the growth role (see AGENTS.md in the HQ repo once it exists). Growth sends a weekly funnel report and runs A/B tests on the landing headline and main CTA.

Analytics: PostHog Cloud (US), project 739315, free plan. Cookieless: `persistence: "memory"`, no autocapture, no session recording, Do Not Track respected. No cookie banner needed. Disclosed in `public/privacy.html` ("This website"). The project key in `public/analytics.js` is a public write-only key by design; it is not a secret.

## Stages

| # | Stage | Event | Where it fires | How it is measured | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Visit | `$pageview` | every page that loads `analytics.js` | PostHog pageviews, by page and referrer/UTM | live |
| 2 | Intent | `cta_click` (`where`: `nav_cta`, `price_cta`, ...) | any element with `data-track` (`public/landing.js`) | clicks / visits | live |
| 3 | Lead | `email_signup` (`where`: `hero` / `footer`) | Kit form accepted the address (`public/landing.js`) | signups / visits | live |
| 4 | Confirmed lead | none on the site | subscriber confirms Kit double opt-in | Kit: confirmed subscribers on form 10195361 | measured in Kit |
| 5 | Download | `download` | download button (when the build is public) | downloads / visits | planned |
| 6 | Trial start | `trial_start` | app first launch (7-day trial, no card) | trial starts / downloads | planned |
| 7 | Paid | `paid` | Stripe checkout completed ($9.99/month) | paid / trial starts | planned |

Notes
- Without cookies each page load is its own anonymous visitor, so "unique visitors" are approximate; use ratios per session/pageview, not long-term retention, for the site.
- Stages 5 to 7 need the signed build and Stripe live mode. App events must stay anonymous and must never include journal content; update the privacy page before shipping them.
- An email address is never sent to PostHog.

## Weekly report (growth)
Each Monday: visits, CTA rate, signup rate, confirmed leads (Kit), top referrers, and the result of any running headline/CTA test. Post as a GitHub issue labelled `growth`.
