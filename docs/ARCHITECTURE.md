# Architecture

## Current state
The React storefront is a responsive, Persian RTL demonstration using a deliberately isolated `src/lib/products.ts` catalog. Cart and wishlist are in-memory state and reset on reload. Product images are remote Unsplash examples. They are not an approved production catalog. No payment is performed.

## Target boundaries
- `src/components` (next stage): presentational UI only.
- `src/features/catalog`: typed query hooks and catalog services.
- `src/features/cart`: guest cart persistence and authenticated cart merge.
- `src/features/checkout`: validated checkout request, no client-trusted prices.
- `src/features/admin`: protected admin routes and server-verified roles.
- `src/lib`: shared types, formatting, Supabase client, pure business rules.
- `supabase/migrations`: schema, RLS, and transactional functions.
- `supabase/functions`: privileged workflows with auth/role checks.

## Security decisions
- Browser uses only Supabase URL and publishable/anon key.
- RLS protects private customer records. `user_roles` has no client write policy.
- Orders, payments, role changes, inventory reservations, and price publication must be server-side operations.
- Do not deploy checkout until an atomic order-creation routine validates products, stock, coupon and shipping prices from database rows and snapshots all line items.
- Payment status may only change after verified provider callback/server-to-server confirmation.
- Admin bootstrap is an out-of-band SQL/operations task; never allow public self-assignment of roles.

## Rendering and SEO
Vite currently renders client-side. For an indexed production catalog, evaluate prerendering or SSR (e.g. a compatible React framework) or generate static category/product pages from a trusted catalog. Add canonical URLs, unique metadata, sitemap, robots rules, Open Graph and Schema.org Product/BreadcrumbList after real product data and canonical domain are configured.
