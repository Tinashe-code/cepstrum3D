import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows";

/** POST /store/customers/me/notifications/read — mark all in-store messages as read. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({ entity: "customer", fields: ["metadata"], filters: { id: customerId } });
  const metadata = ((data[0] as { metadata?: Record<string, unknown> | null } | undefined)?.metadata ?? {}) as Record<
    string,
    unknown
  >;

  const inbox_read_at = new Date().toISOString();
  await updateCustomersWorkflow(req.scope).run({
    input: { selector: { id: customerId }, update: { metadata: { ...metadata, inbox_read_at } } },
  });
  res.json({ inbox_read_at });
}
