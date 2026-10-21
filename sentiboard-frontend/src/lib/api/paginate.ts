/* Reads a whole list endpoint. The backend's lists take ?offset=&limit= (limit at most 1000) and
   answer a bare array with no total count, so the only end-of-list signal is a short page.
   Ported from the prototype's src/api/paginate.ts. */

import "server-only";
import { apiGet, type GetPath, type GetQuery, type GetResponse } from "./client";

/** The largest page the backend accepts. */
export const MAX_PAGE_SIZE = 1000;

/** Guards against a backend that ignores `offset` and answers the same full page forever. */
const MAX_PAGES = 100;

/** GET paths whose query takes offset/limit and whose 200 body is an array. */
export type ListPath = {
  [P in GetPath]: GetQuery<P> extends { offset?: number; limit?: number }
    ? GetResponse<P> extends unknown[]
      ? P
      : never
    : never;
}[GetPath];

export type ListItem<P extends ListPath> = GetResponse<P> extends (infer T)[] ? T : never;

/** Every item of a list endpoint, fetched page by page until a page comes back short. */
export async function fetchAll<P extends ListPath>(path: P): Promise<ListItem<P>[]> {
  const all: ListItem<P>[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    // ListPath guarantees the query takes offset/limit; TS can't see that through the generic.
    const query = { offset: page * MAX_PAGE_SIZE, limit: MAX_PAGE_SIZE } as unknown as GetQuery<P>;
    const items = (await apiGet(path, query)) as ListItem<P>[];
    all.push(...items);
    if (items.length < MAX_PAGE_SIZE) return all;
  }
  throw new Error(`fetchAll(${path}): more than ${MAX_PAGES} pages — is offset being ignored?`);
}
