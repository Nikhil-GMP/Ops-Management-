import { db } from "./supabase";

// Supabase returns max 1000 rows per request, so this reads page by page.
export async function fetchAll(table, columns, apply) {
  const rows = [];
  const size = 1000;
  for (let page = 0; page < 100; page++) {
    const from = page * size;
    let q = db().from(table).select(columns);
    if (apply) q = apply(q);
    const { data, error } = await q.order("id").range(from, from + size - 1);
    if (error) return { rows: rows, error: error };
    rows.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return { rows: rows, error: null };
}
