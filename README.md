# PinPointe Pay

The page a guest lands on after scanning the QR code on a PinPointe Social
board. It shows what the venue is charging, and then takes a member of staff's
own password to unlock the board once they have been paid at the bar.

Public repository on purpose: it holds a static page and a publishable Supabase
key, and nothing else. There is no secret here to leak.

## How a session gets unlocked

1. The suite quotes a price, signs it with the venue's key, and puts
   `https://pay.pinpointe.uk/?c=<signed payload>` in a QR code on screen.
2. A guest scans it and walks to the bar with their phone.
3. This page calls the `unlock-session` Edge Function with `action: "describe"`.
   The function checks the signature **before** returning any figure, so the
   amount on screen is the venue's own price and not whatever the URL claimed.
4. The server takes the money, taps **Paid — unlock**, and types their own
   password. The phone is handed over the bar for this, and the field is masked.
5. The function checks the password against `staff_credentials`, records the
   activation against that member of staff by name, and returns a six-digit
   fallback token.
6. The board hears the activation over Supabase Realtime and starts on its own.
   The six digits appear on the phone only if it has not done so within twelve
   seconds — a paid session must never be stuck behind a network problem the
   guest cannot see or fix.

## Why the amount is not read from the URL

An earlier draft displayed `amt` straight out of the payload. That is exploitable:
a guest can craft a link claiming £2.00, show it to a server who takes £2 and
types their password, and only then does the function reject it. The venue has
already taken the wrong money. Hence `describe` — signature first, figures
second.

## Files

| File | |
| --- | --- |
| `index.html` | the whole page: five screens, no framework, no build step |
| `config.js` | which Supabase project to talk to, chosen by hostname |
| `mock.js` | a fake endpoint for walking the screens on a laptop |
| `.nojekyll` | stops GitHub Pages running the files through Jekyll |

## Running it locally

```sh
python -m http.server 8080
```

Then open a scenario — the mock only loads from localhost, and only with `?mock`:

| URL | |
| --- | --- |
| `localhost:8080/?mock&c=x` | a £70 session; the password is `pub` |
| `localhost:8080/?mock&c=x&case=ext` | buying more time mid-session |
| `localhost:8080/?mock&c=x&case=paid` | a code already redeemed |
| `localhost:8080/?mock&c=x&case=expired` | past its half hour |
| `localhost:8080/?mock&c=x&case=altered` | a forged payload |
| `localhost:8080/?mock&c=x&case=nostaff` | nobody set up to unlock |
| `localhost:8080/?mock&c=x&case=offline` | no network |

Typing the wrong password five times reaches the lockout screen.

## Deploying

GitHub Pages, from `main` at the repository root. There is no build step, so a
push is a deploy. Live at https://hawktivity.github.io/pinpointe-pay/ with HTTPS
enforced.

Pages has no meaningful availability guarantee, and this page now sits on the
payment path: if it is down, a group cannot pay. The board's typed six-digit
token is the way through that, which is the same fallback that covers the board
losing its own network. Cloudflare Pages and Netlify are the same amount of work
if that trade stops being acceptable.

The live domain is `pay.pinpointe.uk`, pointed at Pages with a `CNAME` record.
`config.js` keys off that hostname to pick the production Supabase project, so
until the record and `PROJECTS.prod` are both filled in, every copy of the page
talks to `pinpointe-dev-uk`.
