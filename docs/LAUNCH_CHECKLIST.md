# Launch checklist (PayPal, D-118)

Everything still needed before real money, in order. Boxes marked **(founder)** need your accounts, keys or decisions; the rest is code that is already in place.

## A. Set up PayPal sandbox (founder)

- [ ] PayPal **Business** account; sign in at developer.paypal.com with it.
- [ ] Your own sandbox REST app (Apps & Credentials > Sandbox > Create App). Put its Client ID and Secret in Vercel as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, with `PAYPAL_MODE=sandbox`.
- [ ] On that app, add the webhook `https://<domain>/api/webhooks/paypal` with the events in docs/DEPLOY_VERCEL.md step 6; put its id in `PAYPAL_WEBHOOK_ID`.
- [ ] Generate `PAYMENT_CREDENTIALS_KEY` (32 random bytes, base64) and add it to Vercel. Never change it later.
- [ ] Inngest is connected (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`), so the PayPal pending sweep runs.
- [ ] Two sandbox test accounts under Testing Tools > Sandbox Accounts: one **business** (acts as a creator) and one **personal** (acts as a buyer).
- [ ] Redeploy.

## B. Smoke test on the deployed site (founder, about 30 minutes)

Use a private window for the buyer. Tick each line; if one fails, note what you saw and send it to Claude.

1. [ ] Sign up as Creator A. The setup wizard opens with 4 steps.
2. [ ] Finish Store details. `pickstall.store/@<username>` is a 404 while the store is a draft.
3. [ ] Create a digital product with a link (or file), custom button text and two checkout questions. "Add your first product" turns done only after you name it.
4. [ ] Connect payments: paste the sandbox **business** account's app Client ID and Secret (create an app while signed in as that sandbox business account, or use your own second sandbox app). It says "PayPal is connected".
5. [ ] Publish the product, then publish the store.
6. [ ] As the buyer: open the product, fill the form and the questions, Pay now. PayPal's page shows the **store name** (not "Pickstall"). Pay with the sandbox **personal** account.
7. [ ] Back on the thank-you page it turns "Thank you!" within a minute. The receipt email arrives **once**. The library shows the product and the download link works and expires after about a minute.
8. [ ] Creator dashboard: the order, the customer, the answers and the income are there. Access email shows "Sent".
9. [ ] developer.paypal.com > the creator app > Webhooks: deliveries answered with `200`. Resend one: still one order.
10. [ ] Refund from the order drawer: the order turns "Refunded" and the buyer loses access.
11. [ ] Start a checkout and close the PayPal tab without paying. About 3 hours later the order shows as failed (the sweep), and a coupon or call time it held is free again.
12. [ ] Settings > Plan: choose Starter, approve with the sandbox personal account. The plan shows active; Admin > Billing shows the payment. Switch to Pro (approve in PayPal), then Cancel plan: it stays active until the paid month ends.
13. [ ] Creator B (another account) cannot open Creator A's product, order, customer or file by its link.
14. [ ] Check on a 360 px phone screen, with the keyboard only, and with reduced motion on.

## C. Fix what is open

- [ ] **Access email not delivered (QA bug 1):** after the test order in B.7, if the email shows "Not delivered", copy the `email.send_failed` and `order_email.failed` lines from Vercel logs or Sentry and send them to Claude. The cause is almost always the Resend domain or `EMAIL_FROM`.
- [ ] Anything that failed in section B.

## D. Go live with real money (founder)

- [ ] PayPal live approval for your Business account.
- [ ] A **live** PayPal app: set `PAYPAL_MODE=live`, its Client ID, Secret and a new live webhook id. Creators must connect a Live app again.
- [ ] One real $5 purchase and its refund, end to end.
- [ ] Terms, Privacy and Refund pages read and approved by you (they now name PayPal).
- [ ] An independent review of the sign-in and payment code.
- [ ] Monitoring (Sentry) and a support email or channel that you answer.
- [ ] Ask your CA about export-of-services income (PayPal India receives international payments only).
- [ ] Optional: apply to the PayPal partner program (Commerce Platform) so creators can connect with one click instead of pasting keys.

## Known limits to tell alpha creators

- It is a test version until PayPal live mode is approved.
- Creators need a PayPal Business account and must create a PayPal app (help is on the Payments page).
- A PayPal business account in India cannot receive payments from buyers in India.
- Store currencies are limited to the ones PayPal takes (no INR, HUF or TWD).
