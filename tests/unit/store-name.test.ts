import { describe, expect, it } from "vitest";

import { STORE_NAME_MAX_LENGTH } from "@/lib/stores/schemas";
import { storeNameFromUsername } from "@/lib/stores/store-name";

describe("storeNameFromUsername", () => {
  it("turns the signup username into a readable store name", () => {
    expect(storeNameFromUsername("maya-books")).toBe("Maya Books");
    expect(storeNameFromUsername("mayastudio")).toBe("Mayastudio");
    expect(storeNameFromUsername("ava-lens-2")).toBe("Ava Lens 2");
  });

  it("ignores stray hyphens and stays within the store name limit", () => {
    expect(storeNameFromUsername("-maya--books-")).toBe("Maya Books");
    expect(storeNameFromUsername("a".repeat(80)).length).toBeLessThanOrEqual(STORE_NAME_MAX_LENGTH);
  });
});
