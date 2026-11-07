import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * GET /store/customers/me/notifications?limit=20&offset=0
 *
 * The signed-in customer's in-store messages (channel "inbox"), newest first,
 * with an unread flag. "Read" = created before customer.metadata.inbox_read_at,
 * which POST …/notifications/read moves to now.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const customerId = req.auth_context.actor_id;
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  const offset = Number(req.query.offset ?? 0) || 0;

  const notifications = req.scope.resolve(Modules.NOTIFICATION);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const [[rows, count], { data: customers }] = await Promise.all([
    notifications.listAndCountNotifications(
      { receiver_id: customerId, channel: "inbox" },
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    ),
    query.graph({ entity: "customer", fields: ["metadata"], filters: { id: customerId } }),
  ]);

  const readAt = (customers[0] as { metadata?: Record<string, unknown> | null } | undefined)?.metadata
    ?.inbox_read_at as string | undefined;
  const readTime = readAt ? new Date(readAt).getTime() : 0;

  const unread_count = readTime
    ? (
        await notifications.listNotifications(
          { receiver_id: customerId, channel: "inbox", created_at: { $gt: new Date(readTime) } } as never,
          { select: ["id"] }
        )
      ).length
    : count;

  res.json({
    notifications: rows.map((n) => {
      const d = (n.data ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        title: d.title ?? n.template,
        body: d.body ?? "",
        link: d.link ?? null,
        stage: d.stage ?? null,
        created_at: n.created_at,
        unread: new Date(n.created_at).getTime() > readTime,
      };
    }),
    count,
    unread_count,
    offset,
    limit,
  });
}
