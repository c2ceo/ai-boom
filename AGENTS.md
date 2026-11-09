# Architecture
- Web credit purchases use the existing Stripe Checkout integration and the generation API's `fal_credits` balance; do not create a second balance.
- Fulfill Stripe credit purchases through a service-role-only atomic ledger function keyed by Checkout session ID, preventing duplicate credits on retries.
- Subscription status and free-generation allowances are writable only by service_role; clients may read only their own records through RLS.