import { createHash } from "node:crypto";

/** The one-way key a deleted account leaves behind (D-074): SHA-256 of the canonical email. */
export function deletedAccountKey(canonicalEmail: string): string {
  return createHash("sha256").update(`deleted-account:${canonicalEmail}`).digest("hex");
}
