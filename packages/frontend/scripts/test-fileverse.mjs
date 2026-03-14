/**
 * Run this to discover the actual Fileverse API response shape:
 *   node scripts/test-fileverse.mjs
 *
 * Then update lib/fileverse.ts field names to match.
 */

const API_KEY = process.env.FILEVERSE_API_KEY ?? "zhsfcNCqczOr-SuzdAoh8ex_ZeHq6yGI";
const API_BASE = process.env.FILEVERSE_API_BASE ?? "https://api.fileverse.io";

const testPayload = {
  question: "Test upload from DataDaddy",
  answer: "This is a probe to discover the Fileverse API response shape.",
  attributeKeys: ["defi_user"],
  submittedAt: new Date().toISOString(),
};

console.log("Testing Fileverse upload...");
console.log("Base URL:", API_BASE);
console.log("Payload:", JSON.stringify(testPayload, null, 2));
console.log("");

async function probe(label, headers, body, method = "POST") {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(`${API_BASE}/v1/files`, { method, headers, body });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text.slice(0, 300));
  return res.status;
}

// Try 1: Bearer token (JSON body)
await probe("Bearer + JSON", {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
}, JSON.stringify(testPayload));

// Try 2: x-api-key header (JSON body)
await probe("x-api-key + JSON", {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
}, JSON.stringify(testPayload));

// Try 3: Token scheme
await probe("Token scheme + JSON", {
  Authorization: `Token ${API_KEY}`,
  "Content-Type": "application/json",
}, JSON.stringify(testPayload));

// Try 4: Bearer + multipart (Pinata-style)
const form = new FormData();
form.append("file", new Blob([JSON.stringify(testPayload)], { type: "application/json" }), "data.json");
await probe("Bearer + multipart/form-data", {
  Authorization: `Bearer ${API_KEY}`,
}, form);

// Try 5: GET the root to see what the API looks like
console.log("\n--- GET /v1 (discover routes) ---");
const root = await fetch(`${API_BASE}/v1`, { headers: { Authorization: `Bearer ${API_KEY}` } });
console.log("Status:", root.status);
console.log("Body:", (await root.text()).slice(0, 300));
