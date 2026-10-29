/** First word of a full name for the dashboard greeting ("Welcome, Maya"), or null if there is none. */
export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}
