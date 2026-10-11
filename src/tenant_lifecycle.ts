import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const onboardTenantSchema = z.object({
  tenantId: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1),
  scopes: z.array(z.string().min(1)).min(1),
});

export const offboardTenantSchema = z.object({
  tenantId: z.string().min(1),
  keyId: z.string().min(1),
  userId: z.string().min(1),
});

export type OnboardTenant = z.infer<typeof onboardTenantSchema>;
export type OffboardTenant = z.infer<typeof offboardTenantSchema>;

type CreatedUser = { id: string };
type CreatedKey = { id: string; key: string };

export interface TenantControlApi {
  createUser(input: OnboardTenant, idempotencyKey: string): Promise<CreatedUser>;
  createKey(input: OnboardTenant, idempotencyKey: string): Promise<CreatedKey>;
  revokeKey(keyId: string): Promise<unknown>;
  deleteUser(userId: string): Promise<unknown>;
}

export class InfraiTenantControlApi implements TenantControlApi {
  private readonly infrai: InfraiClient;

  constructor(infrai: InfraiClient) {
    this.infrai = infrai;
  }

  createUser(input: OnboardTenant, idempotencyKey: string): Promise<CreatedUser> {
    return this.infrai.request("POST", "/v1/auth/user/create", {
      email: input.ownerEmail,
      name: input.ownerName,
      metadata: { tenant_id: input.tenantId },
      idempotency_key: idempotencyKey,
    });
  }

  createKey(input: OnboardTenant, idempotencyKey: string): Promise<CreatedKey> {
    return this.infrai.request("POST", "/v1/account/keys/create", {
      project_id: input.tenantId,
      name: `${input.tenantId} tenant key`,
      scopes: input.scopes,
      idempotency_key: idempotencyKey,
    });
  }

  revokeKey(keyId: string): Promise<unknown> {
    return this.infrai.request("DELETE", `/v1/account/keys/revoke/${encodeURIComponent(keyId)}`);
  }

  deleteUser(userId: string): Promise<unknown> {
    return this.infrai.request("DELETE", `/v1/auth/user/delete/${encodeURIComponent(userId)}`);
  }
}

export class TenantLifecycle {
  private readonly api: TenantControlApi;
  private readonly makeId: () => string;

  constructor(
    api: TenantControlApi,
    makeId: () => string = randomUUID,
  ) {
    this.api = api;
    this.makeId = makeId;
  }

  async onboard(input: OnboardTenant) {
    const operationId = this.makeId();
    const user = await this.api.createUser(input, `${operationId}:user`);
    const credential = await this.api.createKey(input, `${operationId}:key`);
    return {
      tenantId: input.tenantId,
      userId: user.id,
      keyId: credential.id,
      apiKey: credential.key,
      state: "active" as const,
    };
  }

  async offboard(input: OffboardTenant) {
    await this.api.revokeKey(input.keyId);
    await this.api.deleteUser(input.userId);
    return { tenantId: input.tenantId, state: "offboarded" as const };
  }
}
