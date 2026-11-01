import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

// One throwaway MongoDB (a single-node replica set, so transactions work) for the whole run. The
// first run downloads the mongod binary into node_modules/.cache. Never touches the founder's database.
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  project.provide("mongoUri", replSet.getUri());
  return async () => {
    await replSet.stop();
  };
}
