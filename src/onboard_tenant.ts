import { InfraiClient } from "./infrai_client.js";
import { InfraiTenantControlApi, TenantLifecycle } from "./tenant_lifecycle.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the onboarding script");

const lifecycle = new TenantLifecycle(new InfraiTenantControlApi(new InfraiClient(apiKey)));
const result = await lifecycle.onboard({
  tenantId: "acme-demo",
  ownerEmail: "founder@example.com",
  ownerName: "Demo Founder",
  scopes: ["account.balance", "account.usage"],
});

console.log(JSON.stringify(result, null, 2));
