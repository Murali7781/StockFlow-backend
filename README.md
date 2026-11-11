# StockFlow MVP API

The active MVP API provides email/password signup and login,
organization-scoped products, dashboard statistics, and organization settings.
Supplier, customer, warehouse, purchase-order, sales-order, and inventory
movement files remain in the repository but their routes are not mounted.
Categories and integrations are present in the database but are not exposed by
the MVP API.

## Run locally

1. Copy `.env.example` to `.env`; set local MySQL credentials and a private
   `JWT_SECRET` of at least 32 characters. To use TiDB, also set its fields
   and CA certificate path.
2. Run `npm install`.
3. Check the selected connection and read-only schema metadata with
   `npm run db:test`.
4. Start with `npm run dev` or `npm start`.

Set `DB_PROVIDER=local` to select local MySQL, configured by
`LOCAL_DB_HOST=localhost`, `LOCAL_DB_PORT=3306`, `LOCAL_DB_USER`,
`LOCAL_DB_PASSWORD`, and `LOCAL_DB_NAME`. Set `DB_PROVIDER=tidb` to select
TiDB Cloud, configured by `TIDB_HOST`, `TIDB_PORT=4000`, `TIDB_USER`,
`TIDB_PASSWORD`, `TIDB_NAME`, and `TIDB_CA_CERT_PATH`. The TiDB CA must be a
readable file containing valid PEM-encoded X.509 certificate(s). Alternatively,
the PEM content can be supplied as `TIDB_CA_CERT` if using a file is not
available. TiDB TLS always verifies the server certificate.
Database credentials and CA files must remain server-side.

The backend keeps one Sequelize instance and its managed MySQL connection
pool, using the installed `mysql2` driver. Existing controllers and models
continue using that same interface regardless of the selected provider.

To test either configured server (both commands only connect and inspect
schema metadata; they do not modify tables or records), run from `backend`:

```powershell
npm run db:test:local
npm run db:test:tidb
```

The API listens on port `3000` by default. `GET /api/health` checks both the
API and its database connection. Set `CORS_ORIGINS` to the frontend origin.
Authentication routes have IP-based rate limits, and Helmet sets standard
HTTP security headers. If deployed behind a trusted reverse proxy, set
`TRUST_PROXY_HOPS` to the exact number of proxy hops configured by the host;
leave it at `0` for direct connections.
The active API is intentionally limited to authentication, products,
dashboard, and settings. Requests to the retained non-MVP supplier, customer,
warehouse, order, and inventory-movement routes return `404`.
Startup verifies a database connection but does not create or alter tables.
The existing schema must already be migrated. `npm run db:test` only reads
`information_schema` and verifies the model tables, columns, and expected
relationships; it does not modify database records or schema.

## Render deployment

Create a Render Web Service for this backend, set its root directory to
`backend`, and use `npm install` as the build command and `npm start` as the
start command. Set `NODE_ENV=production` so the backend uses only Render
environment values and does not load a local `.env` file. Add
`DB_PROVIDER=tidb`, `TIDB_HOST`, `TIDB_PORT=4000`, `TIDB_USER`,
`TIDB_PASSWORD`, and `TIDB_NAME` in Render's **Environment** settings. Add the
TiDB CA certificate as a Render **Secret File**, then set
`TIDB_CA_CERT_PATH` to its absolute path (for example
`/etc/secrets/tidb-ca.pem`). Render startup diagnostics report the provider,
whether the certificate path/file is configured, exists and is readable, and
whether the certificate and database configuration validate; they never log
certificate contents or credentials. Do not put credentials or certificates in
frontend variables or commit them.

- `JWT_SECRET`: a randomly generated secret with at least 32 characters.
- `CORS_ORIGINS`: the deployed frontend origin, such as `https://example.com`.
- `TRUST_PROXY_HOPS`: the exact number of trusted proxy hops; set to `1` for a
  typical Render service.

Render supplies `PORT` automatically; the backend also defaults to `3000` for
local development. To validate a Render-equivalent setup locally, provide the
same environment variables and run `npm run db:test:tidb`. No deployment is
performed by this project change.

## API

Successful responses use a `data` property. Errors use
`{ "error": { "code": "...", "message": "..." } }`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create an organization, owner, and default threshold. Requires `email`, `password`, `confirmPassword`, and `organizationName`. |
| POST | `/api/auth/login` | No | Sign in with email and password; returns a bearer token. |
| GET/POST | `/api/products` | Yes | List or create products. Listing supports name/SKU `search`, `page`, `limit`, `sortBy`, and `sortOrder`. |
| GET/PUT/PATCH/DELETE | `/api/products/:id` | Yes | Read or update an organization-owned product; deletion is blocked while inventory or order records reference it. |
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
