# Pay at the bar

The page a guest lands on after scanning the QR code on a dart board. It shows
what the venue is charging, and then takes a member of staff's own password to unlock the board once they have been paid at the bar.

Public repository on purpose: it holds a static page and a publishable Supabase
key, and nothing else. There is no secret here to leak.

## How a session gets unlocked

1. The suite quotes a price, signs it with the venue's key, and puts
   `https://pay.hawktivity.com/?c=<signed payload>` in a QR code on screen.
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
| `localhost:8080/?mock&c=x&case=split` | 4 players, £20: pay for everyone or just my share |
| `localhost:8080/?mock&c=x&case=splitpartial` | £5 of £20 paid: my share, or the rest |
| `localhost:8080/?mock&c=x&case=splitheld` | the rest is mid-payment on another phone |
| `localhost:8080/?mock&c=x&case=sharepaid&paid=1&s=x` | my share is in, the group's never is |
| `localhost:8080/?mock&c=x&case=splitdone&paid=1&s=x` | my share is in, then the group finishes |
| `localhost:8080/?mock&c=x&case=splitcovered` | already covered after CHANGE lowered the price |
| `localhost:8080/?mock&c=x&case=splitexpired` | part paid, this phone's code has run out |

Typing the wrong password five times reaches the lockout screen. The full list of
cases, including the card and voucher ones, is at the top of `mock.js`.

## Splitting a payment

At a venue that takes cards, a group of two or more can pay together or each pay their
own share. Every phone scans the same code on the board. The page asks the card endpoint
for a number of *heads* (everyone, the rest, or one), the server works out the amount and
holds that share while its card form is open, and the board starts only once the shares
cover the price. Somebody who has paid their share waits on a screen that says so and
never offers to take it again; anything a group pays that does not end up as a session
is refunded automatically.

## Deploying

There is no build step, so a push to `main` is a deploy, to two places:

- **Production: `pay.hawktivity.com`**, served by the Cloudflare Pages project
  `hawktivity-pay`. `config.js` keys off that hostname to pick the production
  Supabase project.
- **Dev: this repository's GitHub Pages site**, which is what the dev boards'
  QR codes point at. Every host other than `pay.hawktivity.com` talks to the dev
  project.

Do **not** give this repository's GitHub Pages site a custom domain. Pages then
redirects the github.io address to it, and every dev board would land on the
production page and be refused.

Everything in the repository root is served publicly, this file included, so
nothing here may carry a product brand: the payment flow is unbranded on
purpose. Keep it that way in new files too.

If the page is down a group cannot pay through it; the board's typed six-digit
token is the way through that, the same fallback that covers the board losing
its own network.
