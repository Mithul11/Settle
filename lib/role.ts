import "server-only";
import { cookies } from "next/headers";
import { parseRole, ROLE_COOKIE, type Role } from "./types";

/**
 * Read the "view as" role from the settle_role cookie. Server components and
 * route handlers only. Defaults to CLIENT.
 */
export async function getRole(): Promise<Role> {
  const store = await cookies();
  return parseRole(store.get(ROLE_COOKIE)?.value);
}
