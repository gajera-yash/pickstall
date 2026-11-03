import { describe, expect, it } from "vitest";

import { attachmentHeader, cleanFileName, detectFileType, extensionOf, formatBytes } from "@/lib/files/types";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0x20)].slice(0, 16));
const ascii = (text: string) => bytes(...[...text].map((ch) => ch.charCodeAt(0)));

describe("product file types (D-050)", () => {
  it("accepts a file when the name and the first bytes agree", () => {
    expect(detectFileType("Guide.PDF", ascii("%PDF-1.7"))).toEqual({ ext: "pdf", mime: "application/pdf" });
    expect(detectFileType("pack.zip", bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ ext: "zip" });
    expect(detectFileType("book.epub", bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ mime: "application/epub+zip" });
    expect(detectFileType("sheet.xlsx", bytes(0x50, 0x4b, 0x03, 0x04))).toMatchObject({ ext: "xlsx" });
    expect(detectFileType("cover.png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toMatchObject({ ext: "png" });
    expect(detectFileType("photo.jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toMatchObject({ mime: "image/jpeg" });
    expect(detectFileType("song.mp3", ascii("ID3"))).toMatchObject({ ext: "mp3" });
    expect(detectFileType("song.mp3", bytes(0xff, 0xfb))).toMatchObject({ ext: "mp3" });
    expect(detectFileType("clip.mp4", bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70))).toMatchObject({ ext: "mp4" });
    expect(detectFileType("list.csv", ascii("name,email"))).toMatchObject({ mime: "text/csv" });
  });

  it.each([
    ["an executable renamed to pdf", "guide.pdf", bytes(0x4d, 0x5a, 0x90)],
    ["html renamed to pdf", "guide.pdf", ascii("<html><script>")],
    ["a pdf named .exe", "guide.exe", ascii("%PDF-1.7")],
    ["an html file", "page.html", ascii("<html>")],
    ["a binary csv", "list.csv", bytes(0x00, 0x01, 0x02)],
    ["no extension", "guide", ascii("%PDF-1.7")],
    ["an empty file", "guide.pdf", new Uint8Array()],
  ])("refuses %s", (_label, name, head) => {
    expect(detectFileType(name, head)).toBeNull();
  });

  it("makes a safe download name with the detected extension", () => {
    expect(cleanFileName("C:\\Users\\maya\\Tax Guide 2026.PDF", "pdf")).toBe("Tax Guide 2026.pdf");
    expect(cleanFileName("../../etc/passwd", "pdf")).toBe("passwd.pdf");
    expect(cleanFileName('a<b>c:"d|e?.pdf', "pdf")).toBe("abcde.pdf");
    expect(cleanFileName("   ", "zip")).toBe("download.zip");
    expect(cleanFileName("x".repeat(300), "pdf")).toHaveLength(114);
    expect(extensionOf("archive.tar.gz")).toBe("gz");
  });

  it("writes a download header that cannot be broken by quotes, with the UTF-8 name too", () => {
    expect(attachmentHeader('Guide "final".pdf')).toBe(`attachment; filename="Guide _final_.pdf"; filename*=UTF-8''Guide%20%22final%22.pdf`);
    expect(attachmentHeader("ગાઇડ.pdf")).toContain("filename*=UTF-8''%E0%AA");
  });

  it("formats sizes for the editor", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(12.4 * 1024 * 1024)).toBe("12.4 MB");
  });
});
