// Why a new store was refused, and what the creator sees (D-071). Pure text, so pages and tests can
// import it without the database code in lib/stores/new-store-guard.ts.

import { DISPOSABLE_EMAIL_MESSAGE } from "@/lib/auth/email-rules";
import { SUPPORT_EMAIL } from "@/lib/config";

export type NewStoreBlock = "disposable" | "email_used" | "limit";

export const NEW_STORE_MESSAGES: Record<NewStoreBlock, string> = {
  disposable: DISPOSABLE_EMAIL_MESSAGE,
  email_used: "This email already has a store. Log in with it instead.",
  limit: `This browser has opened the most stores allowed for now. Email ${SUPPORT_EMAIL} if you need another one.`,
};
