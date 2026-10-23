import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { hash } from "../domain.mjs";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
export async function inspectPdf(
  bytes,
  { render = false, maxPages = 10 } = {},
) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 5 ||
    bytes.length > 2 * 1024 * 1024 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw Error("Choose a PDF up to 2 MB");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: false,
  });
  let doc;
  try {
    doc = await task.promise;
    if (doc.numPages > maxPages)
      throw Error(`PDF exceeds ${maxPages} page inspection limit`);
    const meta = await doc.getMetadata(),
      items = [],
      images = [];
    let qr = null;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const text = await page.getTextContent();
      for (const item of text.items)
        if (item.str?.trim())
          items.push({
            page: n,
            x: item.transform[4],
            y: item.transform[5],
            text: item.str.trim(),
          });
      if (render) {
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(
            2.5,
            1800 / Math.max(original.width, original.height),
          ),
        });
        const canvas = createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          ),
          context = canvas.getContext("2d");
        await page.render({
          canvasContext: context,
          viewport,
          canvasFactory: {
            create(w, h) {
              const canvas = createCanvas(w, h);
              return { canvas, context: canvas.getContext("2d") };
            },
            reset(target, w, h) {
              target.canvas.width = w;
              target.canvas.height = h;
            },
            destroy(target) {
              target.canvas.width = 0;
              target.canvas.height = 0;
              target.canvas = null;
              target.context = null;
            },
          },
        }).promise;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(
          new Uint8ClampedArray(pixels.data),
          canvas.width,
          canvas.height,
          { inversionAttempts: "attemptBoth" },
        );
        if (decoded?.data) qr = decoded.data;
        images.push({
          width: canvas.width,
          height: canvas.height,
          hash: hash(Buffer.from(pixels.data)),
        });
      }
      page.cleanup();
    }
    items.sort(
      (a, b) =>
        a.page - b.page || Math.round(b.y) - Math.round(a.y) || a.x - b.x,
    );
    const lines = [];
    for (const item of items) {
      const previous = lines.at(-1);
      if (
        previous &&
        previous.page === item.page &&
        Math.abs(previous.y - item.y) < 3
      )
        previous.text += " " + item.text;
      else lines.push({ ...item });
    }
    return {
      pageCount: doc.numPages,
      info: meta.info || {},
      lines: lines.map((i) => i.text),
      qr,
      images,
      javascript: !!(await doc.getJSActions()),
      attachments: !!(await doc.getAttachments()),
    };
  } finally {
    await task.destroy();
  }
}
export function extractFields(lines) {
  const f = {
    candidate_name: null,
    course_title: null,
    duration: null,
    credits: null,
    assignment_score: null,
    exam_score: null,
    total_score: null,
    certificate_id: null,
  };
  const bare = /^\d+(?:\.\d+)?$/,
    duration = /^[A-Za-z]{3}-[A-Za-z]{3}\s+\d{4}$/;
  const ignore =
    /verify|roll no|online certification|funded by|government|govt|nptel|national programme|indian institute|successfully|certif|conducted|professor|coordinator|ministry|education/i;
  const prose = lines.filter(
    (l) =>
      /^[A-Za-z][A-Za-z .&'’\-]*$/.test(l) &&
      !ignore.test(l) &&
      !duration.test(l),
  );
  f.candidate_name = prose[0] || null;
  f.course_title = prose[1] || null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (duration.test(l)) f.duration = l;
    const credits = l.match(/credits\s*recommended\s*:?\s*(\d+)/i);
    if (credits) f.credits = credits[1];
    const assign = l.match(/(\d+(?:\.\d+)?\s*\/\s*25)/);
    if (assign) {
      f.assignment_score = assign[1];
      for (let j = i - 1; j >= 0; j--)
        if (bare.test(lines[j])) {
          f.total_score = lines[j];
          break;
        }
    }
    const exam = l.match(/(\d+(?:\.\d+)?\s*\/\s*75)/);
    if (exam) f.exam_score = exam[1];
    const id = l.match(/\b(?:NPTEL|NOC)[A-Z0-9]{8,}\b/i);
    if (id) f.certificate_id = id[0].toUpperCase();
  }
  return f;
}
export async function analyzePdf(bytes, name = "document.pdf") {
  const indicators = [],
    report = {
      file_name: name,
      file_size_bytes: bytes.length,
      mime_type: "application/pdf",
      sha256: hash(bytes),
      page_count: null,
      author: null,
      creator: null,
      producer: null,
      creation_date: null,
      modification_date: null,
    };
  let parsed;
  try {
    parsed = await inspectPdf(bytes);
    Object.assign(report, {
      page_count: parsed.pageCount,
      author: parsed.info.Author || null,
      creator: parsed.info.Creator || null,
      producer: parsed.info.Producer || null,
      creation_date: parsed.info.CreationDate || null,
      modification_date: parsed.info.ModDate || null,
    });
    if (parsed.javascript) indicators.push("Embedded JavaScript actions");
    if (parsed.attachments) indicators.push("Embedded file attachments");
    if (!parsed.lines.length)
      indicators.push("No extractable text; scanned or image-only PDF");
    if (!report.author) indicators.push("Author metadata missing");
    if (!report.creator) indicators.push("Creator metadata missing");
  } catch (e) {
    indicators.push("PDF inspection failed: " + e.message);
  }
  const date = (v) => {
    const m = v?.match(/(?:D:)?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
    return m
      ? Date.UTC(
          +m[1],
          +m[2] - 1,
          +m[3],
          +(m[4] || 0),
          +(m[5] || 0),
          +(m[6] || 0),
        )
      : NaN;
  };
  if (date(report.creation_date) > Date.now() + 86400000)
    indicators.push("Creation date is in the future");
  if (date(report.modification_date) < date(report.creation_date))
    indicators.push("Modification date precedes creation date");
  const raw = bytes.toString("latin1");
  if ((raw.match(/%%EOF/g) || []).length > 1)
    indicators.push("Incremental PDF revisions present");
  return {
    ...report,
    risk_level:
      !parsed || parsed.javascript
        ? "HIGH"
        : indicators.length >= 3
          ? "HIGH"
          : indicators.length
            ? "MEDIUM"
            : "LOW",
    tamper_indicators: indicators,
    metadata_summary: {
      metadata_present: !!parsed && Object.keys(parsed.info).length > 0,
      author_present: !!report.author,
      creator_present: !!report.creator,
      producer_present: !!report.producer,
      timestamps_present: !!(report.creation_date || report.modification_date),
    },
    analyzed_at: new Date().toISOString(),
    scope:
      "Structural and metadata indicators only. Missing metadata and edits do not establish forgery; this is not malware scanning or signature validation.",
  };
}
