import assert from "node:assert/strict";
import test from "node:test";
import { TenantLifecycle, type TenantControlApi } from "../src/tenant_lifecycle.js";

test("offboarding does not delete the user when key revocation is rejected", async () => {
  const calls: string[] = [];
  const api: TenantControlApi = {
    async createUser() { return { id: "user_1" }; },
    async createKey() { return { id: "key_1", key: "returned-once" }; },
    async revokeKey() {
      calls.push("revoke:key_1");
      throw new Error("revocation rejected");
    },
    async deleteUser() { calls.push("delete:user_1"); },
  };

  const lifecycle = new TenantLifecycle(api, () => "operation_1");
  await assert.rejects(() => lifecycle.offboard({ tenantId: "acme", keyId: "key_1", userId: "user_1" }));
  assert.deepEqual(calls, ["revoke:key_1"]);
});

test("onboarding returns the tenant credential and uses stable retry identifiers", async () => {
  const keys: string[] = [];
  const api: TenantControlApi = {
    async createUser(_input, key) { keys.push(key); return { id: "user_1" }; },
    async createKey(_input, key) { keys.push(key); return { id: "key_1", key: "returned-once" }; },
    async revokeKey() {},
    async deleteUser() {},
  };

  const result = await new TenantLifecycle(api, () => "operation_1").onboard({
    tenantId: "acme",
    ownerEmail: "owner@example.com",
    ownerName: "Owner",
    scopes: ["account.balance"],
  });

  assert.deepEqual(keys, ["operation_1:user", "operation_1:key"]);
  assert.equal(result.state, "active");
  assert.equal(result.apiKey, "returned-once");
});
