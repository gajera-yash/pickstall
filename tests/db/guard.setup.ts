import { assertDevProject } from "./guard";

// Runs before every DB test file. Throws (and stops the file) unless env points at the dev project.
assertDevProject(process.env);
