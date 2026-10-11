import { createServer } from "node:http";
import { z } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import {
  InfraiTenantControlApi,
  TenantLifecycle,
  offboardTenantSchema,
  onboardTenantSchema,
} from "./tenant_lifecycle.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const lifecycle = new TenantLifecycle(new InfraiTenantControlApi(new InfraiClient(apiKey)));

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/tenants/onboard") {
      const input = onboardTenantSchema.parse(await readJson(request));
      return send(response, 201, await lifecycle.onboard(input));
    }
    if (request.method === "POST" && request.url === "/tenants/offboard") {
      const input = offboardTenantSchema.parse(await readJson(request));
      return send(response, 200, await lifecycle.offboard(input));
    }
    return send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) return send(response, 400, { error: "Invalid request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.message, detail: error.detail });
    }
    return send(response, 500, { error: "Request could not be completed" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Tenant control plane listening on http://localhost:${process.env.PORT ?? 3000}`);
});
