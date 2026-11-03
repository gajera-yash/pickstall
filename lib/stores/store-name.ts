import { STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";

/**
 * The store name a new store starts with: the username the creator picked at signup, made readable
 * ("maya-books" -> "Maya Books"). The creator can change it later in store setup (D-044).
 */
export function storeNameFromUsername(username: string): string {
  const words = username
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ").slice(0, STORE_NAME_MAX_LENGTH).trim() || username;
}
