/**
 * Fileverse ddocs integration for storing data submissions.
 *
 * Requires env vars:
 *   FILEVERSE_SERVER_URL  — your deployed ddocs server from ddocs.new
 *   FILEVERSE_API_KEY     — from Settings → Developer Mode in ddocs.new
 *
 * Falls back to a deterministic sha256 content-hash CID when Fileverse is
 * unreachable, so the demo works end-to-end regardless of API availability.
 * Sync is awaited up to 60s (20 × 3s polls) before returning.
 */

import { createHash } from "crypto";

export interface FileverseUploadResult {
  cid: string; // ddocId, or sha256-<hex> fallback
  url: string; // shareable link, or /api/pool/content/:cid fallback
}

function contentCid(body: string): string {
  return "sha256-" + createHash("sha256").update(body).digest("hex");
}

/**
 * Upload a JSON object to Fileverse as a ddoc.
 * Polls for blockchain sync (up to 60s) then returns the shareable link.
 * Falls back to a content-hash pseudo-CID if Fileverse is unavailable.
 */
export async function uploadToFileverse(
  content: object
): Promise<FileverseUploadResult> {
  const apiKey = process.env.FILEVERSE_API_KEY;
  const serverUrl = (process.env.FILEVERSE_SERVER_URL ?? "").replace(/\/$/, "");
  const body = JSON.stringify(content);

  if (apiKey && serverUrl) {
    try {
      // Step 1: Create the ddoc
      const createRes = await fetch(`${serverUrl}/api/ddocs?apiKey=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "DataDaddy Submission",
          content: body,
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        console.warn(
          `Fileverse create failed (${createRes.status}): ${text} — using fallback CID`
        );
      } else {
        const createData = await createRes.json();
        const ddocId: string = createData?.data?.ddocId;

        if (!ddocId) {
          console.warn(
            "Fileverse response missing ddocId — falling back",
            createData
          );
        } else {
          // Step 2: Poll for sync (up to 60s, 20 × 3s)
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            const docRes = await fetch(
              `${serverUrl}/api/ddocs/${ddocId}?apiKey=${encodeURIComponent(apiKey)}`
            );
            if (docRes.ok) {
              const doc = await docRes.json();
              if (doc.syncStatus === "synced" && doc.link) {
                return { cid: ddocId, url: doc.link };
              }
              if (doc.syncStatus === "failed") {
                console.warn("Fileverse sync failed for ddocId:", ddocId);
                break;
              }
            }
          }
          // Sync timed out — return ddocId so data can still be referenced
          console.warn(
            "Fileverse sync timed out for ddocId:",
            ddocId,
            "— returning without shareable link"
          );
          return {
            cid: ddocId,
            url: `${serverUrl}/api/ddocs/${ddocId}?apiKey=${encodeURIComponent(apiKey)}`,
          };
        }
      }
    } catch (err) {
      console.warn("Fileverse upload error:", err, "— using fallback CID");
    }
  }

  // Fallback: deterministic content hash
  const cid = contentCid(body);
  return { cid, url: `/api/pool/content/${cid}` };
}

/**
 * Fetch a ddoc from Fileverse by ddocId.
 * Returns null for fallback (sha256-*) CIDs — caller should read from DB instead.
 */
export async function fetchFromFileverse(cid: string): Promise<unknown> {
  if (cid.startsWith("sha256-")) return null;

  const apiKey = process.env.FILEVERSE_API_KEY;
  const serverUrl = (process.env.FILEVERSE_SERVER_URL ?? "").replace(/\/$/, "");

  if (!apiKey || !serverUrl) {
    throw new Error("Fileverse not configured (missing FILEVERSE_SERVER_URL or FILEVERSE_API_KEY)");
  }

  const res = await fetch(
    `${serverUrl}/api/ddocs/${cid}?apiKey=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`Fileverse fetch failed: ${res.status}`);
  return res.json();
}
