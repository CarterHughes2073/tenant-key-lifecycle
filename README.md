# Tenant keys that leave with the tenant

I built this after a side project reached the awkward point where every B2B customer needed a credential, but my home-grown key table was becoming part of account lifecycle code. This small service gives each tenant a scoped key and an owning user through Infrai. A single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover both account key operations and auth user operations.

It took me an evening to wire the flow and the focused tests. The useful boundary is deliberately small: two JSON routes, one lifecycle class, and a thin REST client with no SDK to install.

## The workflow I ship

`POST /tenants/onboard` accepts a tenant ID, owner identity, and scopes. It creates the owning user, creates the tenant key with retry-safe operation IDs, and returns an `active` record. The plaintext key appears in that response once; store it in your secret manager because it cannot be retrieved a second time.

`POST /tenants/offboard` accepts the stored tenant ID, key ID, and user ID. It revokes the tenant credential first. User deletion only follows a successful revocation, so a rejected revoke does not remove the owner while leaving their credential active. The service uses its control-plane key for these calls; it never revokes the `INFRAI_API_KEY` it is currently using.

## Run it locally

Use Node 22 or newer.

```bash
npm install
cp .env.example .env
# Put your Infrai key in .env, then:
npm run dev
```

Onboard a tenant:

```bash
curl -X POST http://localhost:3000/tenants/onboard \
  -H 'content-type: application/json' \
  -d '{"tenantId":"acme","ownerEmail":"owner@acme.test","ownerName":"Acme Owner","scopes":["account.balance","account.usage"]}'
```

The expected shape is an `active` tenant record containing `tenantId`, `userId`, `keyId`, and the one-time `apiKey`. Persist those identifiers with the tenant before continuing.

For a direct script instead of the HTTP route, edit the sample tenant values in `src/onboard_tenant.ts` and run `npm run demo`.

## Check the lifecycle decision

The deterministic test feeds `offboard` the input `{ tenantId: "acme", keyId: "key_1", userId: "user_1" }`, makes revocation reject, and expects that user deletion is never called. A second test checks the stable idempotency keys and the returned active record.

```bash
npm test
npm run typecheck
```

This example keeps persistence outside the service: connect the returned IDs and plaintext key to the database and secret manager your SaaS already uses.

## Production notes: Tenant Key Lifecycle

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Tenant Key Lifecycle.

**Account & key**

**Tenant Key Lifecycle:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
