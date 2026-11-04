import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The course editor is one <form>; the curriculum builder renders inside it. A <form> in the builder
// would be nested, which browsers drop: its button then submits the editor instead (the "Add module
// does nothing" bug, fixed 2026-11-04). Keep the builder free of form elements.
const source = (file: string) => readFileSync(path.join(process.cwd(), "components", "dashboard", file), "utf8");

describe("course editor forms", () => {
  it("has exactly one form, around the whole editor", () => {
    expect(source("course-editor.tsx").match(/<form\b/g)).toHaveLength(1);
  });

  it("keeps the curriculum builder free of nested forms and submit buttons", () => {
    const builder = source("curriculum-builder.tsx");
    expect(builder).not.toMatch(/<form\b/);
    expect(builder).not.toMatch(/type="submit"/);
  });
});
