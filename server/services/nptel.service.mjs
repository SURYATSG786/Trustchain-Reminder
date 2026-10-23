import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { inspectPdf, extractFields } from "../services/pdf.service.mjs";
import { hash } from "../domain.mjs";
export function officialUrl(value, base) {
  const u = new URL(value, base);
  if (u.protocol === "http:") u.protocol = "https:";
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    !(u.hostname === "nptel.ac.in" || u.hostname.endsWith(".nptel.ac.in"))
  )
    throw Error(
      "Certificate URL must use an official nptel.ac.in HTTPS domain",
    );
  return u;
}
export function publicAddress(ip) {
  if (isIP(ip) === 4) {
    const a = ip.split(".").map(Number);
    return !(
      a[0] === 0 ||
      a[0] === 10 ||
      a[0] === 127 ||
      a[0] >= 224 ||
      (a[0] === 169 && a[1] === 254) ||
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
      (a[0] === 192 && (a[1] === 168 || a[1] === 0)) ||
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
      (a[0] === 198 && (a[1] === 18 || a[1] === 19))
    );
  }
  return isIP(ip) === 6 && /^2[0-9a-f]{3}:/i.test(ip);
}
export async function fetchOfficial(
  value,
  { referer, redirects = 0, delegated = false } = {},
) {
  let u;
  if (delegated) {
    u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "storage.googleapis.com" ||
      u.username ||
      u.password ||
      (u.port && u.port !== "443") ||
      !u.searchParams
        .get("X-Goog-Credential")
        ?.includes("@nptel-exam.iam.gserviceaccount.com/") ||
      !/^([a-f0-9]{512})$/i.test(u.searchParams.get("X-Goog-Signature") || "")
    )
      throw Error("Invalid NPTEL delegated storage URL");
  } else u = officialUrl(value);
  const addresses = await lookup(u.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Error("Official hostname resolved to a blocked address");
  const a = addresses.find((a) => a.family === 4) || addresses[0];
  const response = await new Promise((resolve, reject) => {
    const req = https.get(
      u,
      {
        agent: false,
        lookup: (host, options, callback) =>
          options.all
            ? callback(null, [a])
            : callback(null, a.address, a.family),
        headers: {
          "User-Agent": "TrustChain certificate verification",
          Accept: "application/pdf,text/html",
          ...(referer ? { Referer: referer } : {}),
        },
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on("data", (b) => {
          size += b.length;
          if (size > 2 * 1024 * 1024) {
            res.destroy(Error("Official response exceeds 2 MB"));
            return;
          }
          chunks.push(b);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            bytes: Buffer.concat(chunks),
            url: u.href,
          }),
        );
      },
    );
    req.setTimeout(8000, () => req.destroy(Error("Official server timed out")));
    req.on("error", reject);
  });
  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.location
  ) {
    if (redirects >= 3) throw Error("Too many official redirects");
    const next = new URL(response.headers.location, u);
    const storage = next.hostname === "storage.googleapis.com";
    if (storage && delegated) throw Error("Unexpected storage redirect");
    return fetchOfficial(storage ? next.href : officialUrl(next.href).href, {
      referer,
      redirects: redirects + 1,
      delegated: storage,
    });
  }
  return response;
}
function nestedLink(html, base) {
  const matches = [
    ...html.matchAll(
      /<(?:iframe|embed|object|a)\b[^>]*\b(?:src|data|href)\s*=\s*["']([^"']+)["']/gi,
    ),
  ];
  for (const m of matches) {
    const v = m[1].replaceAll("&amp;", "&");
    if (/\.pdf(?:\?|$)/i.test(v) || /^<(iframe|embed|object)/i.test(m[0]))
      return officialUrl(v, base).href;
  }
  return null;
}
const normalized = (v) =>
  String(v || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
export async function verifyNptel(
  bytes,
  { inspect = inspectPdf, fetcher = fetchOfficial } = {},
) {
  const result = (verified, status, reason, extra = {}) => ({
    verified,
    status,
    reason,
    issuer: "NPTEL",
    checked_at: new Date().toISOString(),
    ...extra,
  });
  let uploaded;
  try {
    uploaded = await inspect(bytes, { render: true, maxPages: 1 });
  } catch (e) {
    return result(
      null,
      "UNVERIFIABLE",
      "Could not inspect certificate: " + e.message,
    );
  }
  if (!uploaded.qr)
    return result(
      null,
      "UNVERIFIABLE",
      "No readable QR code was found. Upload the original single-page certificate PDF.",
    );
  let url;
  try {
    url = officialUrl(uploaded.qr).href;
  } catch (e) {
    return result(
      false,
      "FAKE",
      "The embedded QR code does not link to an official NPTEL domain.",
    );
  }
  try {
    let response = await fetcher(url);
    if (response.status !== 200)
      return result(
        null,
        "UNVERIFIABLE",
        `Official server returned HTTP ${response.status}`,
        { qr_url: url },
      );
    let certUrl = response.url || url;
    for (
      let hop = 0;
      hop < 3 && response.bytes.subarray(0, 5).toString() !== "%PDF-";
      hop++
    ) {
      const next = nestedLink(response.bytes.toString("utf8"), certUrl);
      if (!next)
        return result(
          null,
          "UNVERIFIABLE",
          "Official page did not provide a certificate PDF; the record could not be confirmed.",
          { qr_url: url },
        );
      response = await fetcher(next, { referer: certUrl });
      certUrl = response.url || next;
      if (response.status !== 200)
        return result(
          null,
          "UNVERIFIABLE",
          `Certificate server returned HTTP ${response.status}`,
          { qr_url: url },
        );
    }
    if (response.bytes.subarray(0, 5).toString() !== "%PDF-")
      return result(
        null,
        "UNVERIFIABLE",
        "Official viewer did not return a readable PDF.",
        { qr_url: url },
      );
    const official = await inspect(response.bytes, {
        render: true,
        maxPages: 1,
      }),
      uf = extractFields(uploaded.lines),
      of = extractFields(official.lines);
    const mismatches = Object.keys(of)
      .filter((k) => normalized(uf[k]) !== normalized(of[k]))
      .map((field) => ({ field, uploaded: uf[field], official: of[field] }));
    const visualMatch =
        JSON.stringify(uploaded.images) === JSON.stringify(official.images),
      byteMatch = hash(bytes) === hash(response.bytes);
    const extra = {
      qr_url: url,
      certificate_url: certUrl.split("?")[0],
      uploaded_fields: uf,
      official_fields: of,
      mismatches,
      checks: {
        bytes_match: byteMatch,
        rendered_pages_match: visualMatch,
        fields_match: !mismatches.length,
      },
    };
    if (mismatches.length)
      return result(
        false,
        "FAKE",
        "Uploaded certificate fields differ from the official NPTEL certificate.",
        extra,
      );
    if (!byteMatch && !visualMatch)
      return result(
        null,
        "UNVERIFIABLE",
        "The rendered certificate differs from the official original. It cannot be confirmed; upload the original NPTEL PDF if your copy was converted or edited.",
        extra,
      );
    if (
      !byteMatch &&
      (!of.candidate_name || !of.course_title || !of.certificate_id)
    )
      return result(
        null,
        "UNVERIFIABLE",
        "Template fields could not be extracted reliably. Only an exact official PDF can be verified for this layout.",
        extra,
      );
    return result(
      true,
      "GENUINE",
      "Certificate matches the PDF retrieved directly from NPTEL.",
      { ...extra, fields: of },
    );
  } catch (e) {
    return result(
      null,
      "UNVERIFIABLE",
      "Official verification could not complete: " + e.message,
      { qr_url: url },
    );
  }
}
