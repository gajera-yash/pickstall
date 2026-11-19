import type { ProductFileInfo } from "@/lib/files/types";

// The browser side of a file upload (D-093): ask our server where to send the file, send it there
// (straight to the private R2 bucket on the live site) with progress, then ask the server to check
// it. `startUrl` is the product's or the lesson's upload route.

export type UploadOutcome = { ok: true; file: ProductFileInfo } | { ok: false; error: string };

const GENERIC = "Couldn't upload that file. Check your connection and try again.";

async function errorOf(response: Response): Promise<string | null> {
  try {
    return ((await response.json()) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}

/** PUTs the file with progress; XMLHttpRequest because fetch cannot report upload progress. */
function put(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void): Promise<number> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => resolve(request.status);
    request.onerror = () => resolve(0);
    request.onabort = () => resolve(0);
    request.send(file);
  });
}

export async function uploadFile(startUrl: string, file: File, onProgress: (percent: number) => void): Promise<UploadOutcome> {
  try {
    const started = await fetch(startUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size }) });
    if (!started.ok) return { ok: false, error: (await errorOf(started)) ?? GENERIC };
    const { upload } = (await started.json()) as { upload: { fileId: string; url: string; headers: Record<string, string> } };

    onProgress(0);
    const status = await put(upload.url, upload.headers, file, onProgress);
    if (status < 200 || status >= 300) return { ok: false, error: GENERIC };

    const finished = await fetch(`/api/files/${upload.fileId}/complete`, { method: "POST" });
    if (!finished.ok) return { ok: false, error: (await errorOf(finished)) ?? "Couldn't check that file. Try again." };
    const { file: info } = (await finished.json()) as { file: ProductFileInfo };
    return { ok: true, file: info };
  } catch {
    return { ok: false, error: GENERIC };
  }
}
