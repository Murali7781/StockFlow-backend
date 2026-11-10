# StockFlow MVP API

The backend implements the Phase 1 six-hour MVP: email/password signup and
login, one organization per owner, organization-scoped product CRUD, a basic
inventory dashboard, and the organization's default low-stock threshold.
Multi-warehouse, categories, movements, suppliers, customers, orders, reports,
and integrations are intentionally not part of this application phase.

## Run locally

1. Create a MySQL database.
2. Copy `.env.example` to `.env`; set the MySQL credentials and a private
   `JWT_SECRET` of at least 32 characters.
3. Run `npm install`.
4. Check the connection with `npm run db:test`.
5. Start with `npm run dev` or `npm start`.

The API listens on port `3000` by default. `GET /api/health` checks both the
API and its database connection. Set `CORS_ORIGINS` to the frontend origin.
Authentication routes have IP-based rate limits, and Helmet sets standard
HTTP security headers. If deployed behind a trusted reverse proxy, set
`TRUST_PROXY_HOPS` to the exact number of proxy hops configured by the host;
leave it at `0` for direct connections.
On startup, Sequelize creates missing tables for the core MVP models without
using `force` or `alter`.

Previously created out-of-scope tables and columns are left untouched to
preserve existing data. The MVP API and UI do not read or expose them.

## API

Successful responses use a `data` property. Errors use
`{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create an organization, owner, and default threshold. Requires `email`, `password`, `confirmPassword`, and `organizationName`. |
| POST | `/api/auth/login` | No | Sign in with email and password; returns a bearer token. |
| GET/POST | `/api/products` | Yes | List or create products. Listing supports name/SKU `search`, `page`, `limit`, `sortBy`, and `sortOrder`. |
| GET/PUT/PATCH/DELETE | `/api/products/:id` | Yes | Read, update, or delete an organization-owned product. |
| GET | `/api/dashboard` | Yes | Organization-scoped product count, total quantity, and low-stock products. |
| GET/PATCH | `/api/settings` | Yes | Read or update `defaultLowStockThreshold`. |

Product creation requires `name` and `sku`; optional fields are `description`,
`quantityOnHand`, `costPrice`, `sellingPrice`, and `lowStockThreshold`. SKU is
unique within an organization. Quantity is a non-negative integer, prices are
non-negative numeric values, and an omitted product threshold uses the
organization default.

Low stock uses `quantityOnHand <= lowStockThreshold`; when a product threshold
is empty, the organization setting is used. New organizations default to a
threshold of `5`. Passwords must contain at least eight characters and are
stored as bcrypt hashes. All product queries derive the organization from the
authenticated user.
