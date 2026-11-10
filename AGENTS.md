# Architecture
- Guest entry uses server-created random credentials and owner-scoped admission records, not anonymous auth or shared accounts; this preserves ownership without collecting guest email.
- Require authenticated age admission before app browsing; birthdays are validated server-side but not retained.
- Guest publishing requires a server-recorded safe image owned by the guest; unsafe or unchecked media and guest videos fail closed.
- Web credit purchases use the existing Stripe Checkout integration and the generation API's `fal_credits` balance; do not create a second balance.
- Image generation reserves promotion slots and credits through service-role-only atomic ledger functions; settle once and refund failed requests to prevent races and duplicate deductions.
- Share the image model catalog between the Create page and its edge function; server-side pricing remains authoritative.
- Prompt enhancement runs through the AI Gateway SDK inside the image edge function; generated model types live in its deployable shared directory.
- Fulfill Stripe credit purchases through a service-role-only atomic ledger function keyed by Checkout session ID, preventing duplicate credits on retries.
- Subscription status and free-generation allowances are writable only by service_role; clients may read only their own records through RLS.- Post verification, status and counts are set server-side (posts trigger + verified_media written by edge functions); clients must never send them, because client values are untrusted.
