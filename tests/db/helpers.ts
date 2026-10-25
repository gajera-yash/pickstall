import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";

import { assertDevProject } from "./guard";

// Re-check here so no client can ever be built for a non-dev project, even if the setup
// file is removed from the config by mistake.
assertDevProject(process.env);

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing`);
  return value;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function adminClient(): SupabaseClient {
  return createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), options);
}

export function anonClient(): SupabaseClient {
  return createClient(url, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), options);
}

/** Unique per test run so parallel or leftover data never collides. */
export const runId = randomBytes(4).toString("hex");

export function testEmail(label: string): string {
  return `rls-${runId}-${label}@example.test`;
}

export type TestUser = { id: string; email: string; client: SupabaseClient };

/**
 * Creates a confirmed user and a signed-in client for them, without sending any email
 * and without passwords: the admin API makes a magic-link token, the client verifies it.
 */
export async function createTestUser(
  admin: SupabaseClient,
  label: string,
  metadata?: Record<string, unknown>,
): Promise<TestUser> {
  const email = testEmail(label);

  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
  if (created.error || !created.data.user) {
    throw new Error(`createUser(${label}) failed: ${created.error?.message ?? "no user"}`);
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`generateLink(${label}) failed: ${link.error.message}`);

  const client = anonClient();
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.session) {
    throw new Error(`verifyOtp(${label}) failed: ${verified.error?.message ?? "no session"}`);
  }

  return { id: created.data.user.id, email, client };
}

/**
 * Deletes auth users (cascading to profiles, stores, products, orders and enrollments).
 * Tries every user before failing, so one error never leaves the others behind.
 */
export async function deleteUsersById(admin: SupabaseClient, userIds: string[]): Promise<void> {
  const failures: string[] = [];
  for (const id of userIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && error.status !== 404) failures.push(`${id}: ${error.message}`);
  }
  if (failures.length > 0) throw new Error(`deleteUser failed for ${failures.join("; ")}`);
}

const TEST_EMAIL_PATTERN = /^rls-[0-9a-f]{8}-[a-z0-9-]+@example\.test$/;

/**
 * Removes data left behind by earlier runs that crashed before cleanup.
 * Matches only the generated test emails and ids, never real users.
 */
export async function sweepLeftoverTestData(admin: SupabaseClient): Promise<void> {
  const perPage = 200;
  const staleIds: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const user of data.users) {
      if (user.email && TEST_EMAIL_PATTERN.test(user.email)) staleIds.push(user.id);
    }
    if (data.users.length < perPage) break;
  }
  await deleteUsersById(admin, staleIds);

  await admin.from("webhook_events").delete().like("id", "evt_rls_%");
  await admin.from("email_log").delete().like("to_email", "rls-%@example.test");
}

type QueryResult = { data: unknown; error: { code?: string; message: string } | null };

/** Postgres "insufficient privilege": no grant for this table, column or row (RLS check). */
export function expectDenied(result: QueryResult): void {
  expect(result.error, "expected the request to be denied").not.toBeNull();
  expect(result.error?.code).toBe("42501");
}

/** The request succeeded but RLS filtered every row out. */
export function expectNoRows(result: QueryResult): void {
  expect(result.error).toBeNull();
  expect(result.data).toEqual([]);
}

/** Throws with the PostgREST message if a setup query failed. */
export function must<T>(result: { data: T | null; error: { message: string } | null }, step: string): T {
  if (result.error || result.data === null) {
    throw new Error(`${step} failed: ${result.error?.message ?? "no data"}`);
  }
  return result.data;
}
