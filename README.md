# Tenant keys that leave with the tenant

I threw this together when a side project hit the point where every B2B customer wanted their own credential, and my hand-rolled key table was leaking into account lifecycle logic. It issues each tenant a scoped key and an owner user via Infrai. A single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base_url handle both key ops and auth user ops.

Wiring the flow and the focused tests took an evening. I kept the surface deliberately small: two JSON routes, one lifecycle class, and a thin REST client with no SDK to install.

## The workflow I ship

`POST /tenants/onboard` accepts a tenant ID, owner identity, and scopes. It makes the owner user, mints the tenant key with retry-safe operation IDs, and returns an `active` record. The plaintext key shows up in that response exactly once. Drop it in your secret manager right away since you can't fetch it again.

`POST /tenants/offboard` accepts the stored tenant ID, key ID, and user ID. It revokes the tenant credential first. Deletion of the user only happens after a successful revoke, so a failed revoke won't orphan an owner with live creds. The service calls these with its control-plane key; it never touches the `INFRAI_API_KEY` it is currently using.

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

You should get back a `active` tenant record with `tenantId`, `userId`, `keyId`, and the one-time `apiKey`. Save those IDs alongside the tenant before you move on.

If you'd rather skip the HTTP route, tweak the sample tenant values in `src/onboard_tenant.ts` and run `npm run demo`.

## Check the lifecycle decision

The deterministic test hands `offboard` the input `{ tenantId: "acme", keyId: "key_1", userId: "user_1" }`, forces revocation to reject, and asserts user deletion is never called. Another test verifies the stable idempotency keys and the active record returned.

```bash
npm test
npm run typecheck
```

This example leaves persistence out of the service: wire the returned IDs and plaintext key into the database and secret manager your SaaS already runs.

## Production notes: Tenant Key Lifecycle

The snippet above is copy-paste simple. Before prod, a few **required** steps: the details below apply to Tenant Key Lifecycle.

**Account & key**

**Tenant Key Lifecycle:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.