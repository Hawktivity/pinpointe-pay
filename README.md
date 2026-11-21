# Pay for the board

The page a guest lands on after scanning the QR code on a dart board. It shows
what the venue is charging and takes the payment on the guest's own phone: by
card through Stripe Checkout, the whole group at once or one share each, or with
a one-time voucher code the venue handed out.

Public repository on purpose: it holds a static page and a publishable Supabase
key, and nothing else. There is no secret here to leak.

## How a board gets paid for

1. The suite quotes a price, signs it with the venue's key, and puts
   `https://pay.hawktivity.com/?c=<signed payload>` in a QR code on screen.
2. A guest scans it. This page calls the `unlock-session` Edge Function with
   `action: "describe"`. The function checks the signature **before** returning
   any figure, so the amount on screen is the venue's own price and not whatever
   the URL claimed. It also says whether the code is already paid for, whether it
   can be paid by card (`cardPayment`), and how far a split has got.
3. The guest taps **Pay by card**. The page asks `create-checkout` for a Stripe
   Checkout Session and sends the phone there. The charge is worked out on the
   server from the signed payload, never from anything the page sends.
4. Stripe sends the phone back with `?paid=1`. The board is started by Stripe's
   webhook, not by that redirect, so the page asks `describe` every couple of
   seconds until the sale appears, then shows the unlocked screen. If it never
   appears, the page says the payment went through and that the guest must not
   pay again.
5. The board hears the activation over Supabase Realtime, starts on its own, and
   records that it did. The page keeps asking `describe` whether the board has
   acknowledged the session. Only if it has not after about sixteen seconds does
   the page show a **six-digit fallback token** to type on the touchscreen, so a
   paid session is never stuck behind a network problem the guest cannot see or
   fix.

If `describe` says a code that is unpaid and in date cannot be paid by card, or
`create-checkout` refuses the venue, the page says the board can't take payment
right now and to ask a member of staff. There is no other route to offer.

Staff passwords no longer unlock a board. That route was retired on 14 Nov 2026:
`unlock-session` refuses anything but `describe` with HTTP 410 `bar_retired`, and
this page never sends it. A code paid that way before then can still be
re-scanned; the unlocked screen still shows who approved it.

## Splitting a payment

A group of two or more can pay together or each pay their own share. Every phone
scans the same code on the board. The page asks the card endpoint for a number of
*heads* (everyone, the rest, or one), the server works out the amount and holds
that share while its card form is open, and the board starts only once the shares
cover the price. Somebody who has paid their share waits on a screen that says so
and never offers to take it again; anything a group pays that does not end up as a
session is refunded automatically.

## Vouchers

A venue can hand out one-time codes. Where it has unspent ones, a quiet **Have a
voucher?** link appears under the card button for a new session. The code goes to
`redeem-voucher`, which spends it and starts the board for one session, up to the
time printed on the voucher, for any number of players. It is not offered once
part of a group has paid by card.

## Why the amount is not read from the URL

An earlier draft displayed `amt` straight out of the payload. A guest could craft
a link claiming £2.00 and the page would agree with them. Hence `describe`:
signature first, figures second.

## Files

| File | |
| --- | --- |
| `index.html` | the whole page: five screens, no framework, no build step |
| `register.html` | the separate page for adding a player to the board from a phone |
| `config.js` | which Supabase project to talk to, chosen by hostname |
| `mock.js` | fake endpoints for walking the screens on a laptop |
| `.nojekyll` | stops GitHub Pages running the files through Jekyll |
| `staff/rising-sun.html` | the Rising Sun's free 15-minute voucher codes, for bar staff, behind a password |
| `staff/seal-codes.mjs` | encrypts a batch's codes into a staff page under its password |
| `dashboard/index.html` | Hawktivity's sessions dashboard, behind Google sign-in |
| `dashboard/mock.js` | made-up sessions for walking the dashboard on a laptop (`/dashboard/?mock`) |
| `notebook.html` | Ezra's notebook for Murder at Last Orders: the case so far, private crosses on suspects, and the table's WHO / HOW / WHY vote. Polls the `mystery-notebook` Edge Function with the board's signed `note` code; no account, no typed text |
| `murder/notebook-mock.js` | a made-up Case 1 for walking the notebook on a laptop (`notebook.html?mock=1`, `&case=briefing`, `accusing`, `closed`, `waiting`, `offline`, `bad`) |
| `murder/portraits/` | the 22 suspect, victim and witness portraits the notebook shows, 270x336 greyscale |

### Staff voucher pages

`pay.hawktivity.com/staff/rising-sun` lists a venue's voucher codes for its staff to hand
out. This repository is public, so the codes are in the page only as AES-GCM ciphertext
under a key derived from the staff password; the browser decrypts them once the password
is typed. Every 30 seconds the page sends the SHA-256 of each code to the
`vouchers_spent` database function and drops whichever come back used or revoked. To
reseal a page with a new batch or password, run `staff/seal-codes.mjs` (usage at its top)
with the CSV that `create_voucher_batch()` produced.

### Sessions dashboard

`pay.hawktivity.com/dashboard/` shows every session on our boards: when, where, how many
played, card or voucher, what was paid, and which games. People sign in with Google through
Supabase Auth. The page reads one database function, `dashboard_sessions(from, to)`
(pinpointe-supabase migration `20261116110000`), which answers only a verified Google account
on hawktivity.com or one listed in `dashboard_viewers`, and never a board's own login. Nothing
on the page is a security boundary. Preview deploys of this repo talk to the dev project, as
with every other page here.

To let someone outside hawktivity.com in, add their Google address (lower case) to
`public.dashboard_viewers` on the production project.

Each guest who was sent a clips email gets a **Their page** link in the session's People
list. It opens `story.html#staff=<claim id>`, the story page's staff view: the database keeps
no copy of a guest's link (only its hash), so the staff view uses this browser's dashboard
sign-in instead, and `get-story` lets it in only for a viewer who may see people. Opening it
there does not count as the guest opening their email.


## Running it locally

```sh
python -m http.server 8080
```

Then open a scenario. The mock only loads from localhost, and only with `?mock`:

| URL | |
| --- | --- |
| `localhost:8080/?mock&c=x` | a £70 session; Pay by card comes back paid |
| `localhost:8080/?mock&c=x&case=ext` | buying more time mid-session |
| `localhost:8080/?mock&c=x&case=join` | one more player joining a running session |
| `localhost:8080/?mock&c=x&case=paid` | a code already paid for |
| `localhost:8080/?mock&c=x&case=fallback` | paid, but the board never answers: the six digits |
| `localhost:8080/?mock&c=x&case=cardpending&paid=1` | back from the card page; the sale never lands |
| `localhost:8080/?mock&c=x&case=cardoff` | the card endpoint refuses the venue |
| `localhost:8080/?mock&c=x&case=nocard` | describe says this code can't be paid by card |
| `localhost:8080/?mock&c=x&case=voucher` | vouchers offered; `RS-TEST-GOOD` works once |
| `localhost:8080/?mock&c=x&case=expired` | past its half hour |
| `localhost:8080/?mock&c=x&case=altered` | a forged payload |
| `localhost:8080/?mock&c=x&case=offline` | no network |
| `localhost:8080/?mock&c=x&logo` | a venue logo at the top (add `&logo` to any case; a placeholder, not a real venue's) |
| `localhost:8080/?mock&c=x&logo=broken` | a logo that fails to load: the page must look as it does with none |
| `localhost:8080/?mock&c=x&case=split` | 4 players, £20: pay for everyone or just my share |
| `localhost:8080/?mock&c=x&case=splitpartial` | £5 of £20 paid: my share, or the rest |
| `localhost:8080/?mock&c=x&case=splitheld` | the rest is mid-payment on another phone |
| `localhost:8080/?mock&c=x&case=sharepaid&paid=1&s=x` | my share is in, the group's never is |
| `localhost:8080/?mock&c=x&case=splitdone&paid=1&s=x` | my share is in, then the group finishes |
| `localhost:8080/?mock&c=x&case=splitcovered` | already covered after CHANGE lowered the price |
| `localhost:8080/?mock&c=x&case=splitexpired` | part paid, this phone's code has run out |

The full list of cases, including the refund ones, is at the top of `mock.js`.

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

If the page is down a group cannot pay at all, by card or by voucher, and
nothing on the board gets round that. The six-digit token is no help here: it
exists only once a payment has gone through, and it covers the other failure,
a paid session the board never hears about.
