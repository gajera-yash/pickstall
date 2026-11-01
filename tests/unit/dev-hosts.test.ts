import { describe, expect, it } from "vitest";

import { devAllowedOrigins, extraDevHosts, isLocalDevHost, resolveAppOrigin } from "@/lib/dev-hosts";

describe("isLocalDevHost", () => {
  it.each(["localhost", "app.localhost", "127.0.0.1", "::1", "[::1]", "10.0.0.5", "172.16.4.2", "172.31.255.1", "192.168.1.22", "desktop-ab12", "yash-pc.local"])(
    "accepts %s",
    (host) => {
      expect(isLocalDevHost(host)).toBe(true);
    },
  );

  it.each(["pickstall.store", "evil.com", "172.32.0.1", "8.8.8.8", "192.169.1.1", "999.1.1.1", ""])("rejects %s", (host) => {
    expect(isLocalDevHost(host)).toBe(false);
  });

  it("accepts an extra host only when listed", () => {
    expect(isLocalDevHost("my-tunnel.example.dev")).toBe(false);
    expect(isLocalDevHost("my-tunnel.example.dev", ["my-tunnel.example.dev"])).toBe(true);
  });
});

describe("resolveAppOrigin", () => {
  const configured = "http://localhost:3000";

  it("follows the local or LAN host the request came in on, in development", () => {
    expect(resolveAppOrigin({ configured, isDev: true, host: "192.168.1.22:3000", forwardedProto: null })).toBe("http://192.168.1.22:3000");
    expect(resolveAppOrigin({ configured, isDev: true, host: "127.0.0.1:3000", forwardedProto: "https" })).toBe("https://127.0.0.1:3000");
  });

  it("never trusts the Host header in production", () => {
    expect(resolveAppOrigin({ configured: "https://pickstall.store", isDev: false, host: "192.168.1.22:3000", forwardedProto: null })).toBe(
      "https://pickstall.store",
    );
  });

  it("falls back to the configured URL for public or malformed hosts", () => {
    expect(resolveAppOrigin({ configured, isDev: true, host: "evil.com", forwardedProto: null })).toBe(configured);
    expect(resolveAppOrigin({ configured, isDev: true, host: "user@192.168.1.22", forwardedProto: null })).toBe(configured);
    expect(resolveAppOrigin({ configured, isDev: true, host: "192.168.1.22/path", forwardedProto: null })).toBe(configured);
    expect(resolveAppOrigin({ configured, isDev: true, host: null, forwardedProto: null })).toBe(configured);
  });
});

describe("devAllowedOrigins", () => {
  it("adds the machine name and valid extras, and drops junk", () => {
    const origins = devAllowedOrigins("DESKTOP-AB12", "my-tunnel.example.dev, <script>, ");
    expect(origins).toContain("192.168.*.*");
    expect(origins).toContain("desktop-ab12");
    expect(origins).toContain("desktop-ab12.local");
    expect(origins).toContain("my-tunnel.example.dev");
    expect(origins).not.toContain("<script>");
  });

  it("parses extras defensively", () => {
    expect(extraDevHosts(undefined)).toEqual([]);
    expect(extraDevHosts(" A.example.com ,,")).toEqual(["a.example.com"]);
  });
});
