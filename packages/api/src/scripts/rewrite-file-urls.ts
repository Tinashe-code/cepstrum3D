import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Images uploaded in development are saved with addresses like
 * http://localhost:9000/static/catalog/filament-black.png. After moving to the
 * live server, point them at the live address:
 *
 *   OLD_URL=http://localhost:9000 NEW_URL=https://api.cepstrum3d.cepstrumtechnologies.com \
 *     bunx medusa exec ./src/scripts/rewrite-file-urls.ts
 *
 * Add DRY_RUN=true to only count. Searches every text/JSON column in the database.
 */
export default async function rewriteFileUrls({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER);
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const from = (process.env.OLD_URL ?? "").replace(/\/$/, "");
  const to = (process.env.NEW_URL ?? "").replace(/\/$/, "");
  const dry = process.env.DRY_RUN === "true";
  if (!from || !to) {
    log.error("Set OLD_URL and NEW_URL");
    return;
  }

  const { rows: cols } = await db.raw(
    `select table_name, column_name, data_type from information_schema.columns
     where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json')`
  );

  let total = 0;
  for (const c of cols as { table_name: string; column_name: string; data_type: string }[]) {
    const t = `"${c.table_name}"`;
    const col = `"${c.column_name}"`;
    const isJson = c.data_type === "jsonb" || c.data_type === "json";
    const where = `${col}::text like ?`;
    const { rows } = await db.raw(`select count(*)::int as n from ${t} where ${where}`, [`%${from}%`]);
    const n = rows[0].n as number;
    if (!n) continue;
    total += n;
    log.info(`${c.table_name}.${c.column_name}: ${n}`);
    if (dry) continue;
    const set = isJson
      ? `${col} = replace(${col}::text, ?, ?)::${c.data_type}`
      : `${col} = replace(${col}, ?, ?)`;
    await db.raw(`update ${t} set ${set} where ${where}`, [from, to, `%${from}%`]);
  }
  log.info(`${dry ? "Would update" : "Updated"} ${total} values: ${from} → ${to}`);
}
