import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { serverEnv } from "@/lib/env.server";

// File storage for uploaded images (D-032). One small interface so the disk driver used now can be
// replaced by object storage (S3) without touching the routes. Keys are server-made
// (`<uuid>.<ext>`), never taken from a client file name, and are checked again before any path is built.

export type FileStorage = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
};

const KEY = /^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/;

function uploadDir(): string {
  return path.resolve(serverEnv.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads"));
}

function pathFor(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid storage key.");
  return path.join(uploadDir(), key);
}

/** Files on this server's disk. Fine for development and a single server; use object storage when running several. */
export const diskStorage: FileStorage = {
  async put(key, bytes) {
    const target = pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  },
  async get(key) {
    try {
      return await readFile(pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async remove(key) {
    await rm(pathFor(key), { force: true });
  },
};

export const storage: FileStorage = diskStorage;
