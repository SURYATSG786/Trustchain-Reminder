import { hash, audit } from "./domain.mjs";
export const assetTypes = [
  "CERTIFICATE",
  "IDENTITY",
  "CONTRACT",
  "RESUME",
  "RESEARCH_PAPER",
  "FINANCIAL_REPORT",
  "IMAGE",
  "VIDEO",
  "OTHER",
];
export function claimId(claim) {
  const keys = [
    "asset_name",
    "asset_type",
    "file_hash",
    "issuer",
    "submitted_at",
    "submitted_by",
  ];
  const payload = Object.fromEntries(keys.map((k) => [k, claim[k]]));
  return hash(JSON.stringify(payload));
}
export function makeClaim({
  name,
  issuer,
  actor,
  fileHash,
  assetType = "OTHER",
  recordId = null,
  documentId,
  size,
}) {
  if (!assetTypes.includes(assetType)) throw Error("Invalid asset type");
  for (const [label, v] of [
    ["name", name],
    ["issuer", issuer],
  ])
    if (typeof v !== "string" || !v.trim() || v.length > 180)
      throw Error("Invalid " + label);
  const claim = {
    asset_type: assetType,
    asset_name: name.trim(),
    issuer: issuer.trim(),
    submitted_by: actor,
    file_hash: fileHash,
    submitted_at: new Date().toISOString(),
    metadata: { record_id: recordId, document_id: documentId, size },
  };
  claim.claim_id = claimId(claim);
  return claim;
}
export function report(state, block, trustedIssuers = []) {
  const claim = block.event.detail?.claim || null,
    { hash: stored, ...body } = block;
  const chainValid = audit(state.chain).valid,
    hashValid = hash(JSON.stringify(body)) === stored,
    claimValid = !!claim && claimId(claim) === claim.claim_id;
  const breakdown = {
    hash_integrity: hashValid ? 35 : 0,
    proof_of_work: stored.startsWith("000") ? 25 : 0,
    chain_depth:
      block.index === 0
        ? 0
        : Math.round(
            20 *
              Math.min(block.index / Math.max(state.chain.length - 1, 1), 1) **
                0.6,
          ),
    claim_integrity: claimValid ? 15 : 0,
    issuer_trust: claim && trustedIssuers.includes(claim.issuer) ? 5 : 0,
  };
  let score = Object.values(breakdown).reduce((n, v) => n + v, 0);
  if (!chainValid) score = 0;
  const tier = score >= 90 ? "LOW" : score >= 70 ? "ELEVATED" : "CRITICAL";
  return {
    report_version: "2.0.0",
    chain_id: "TRUSTCHAIN-MAIN",
    generated_at: new Date().toISOString(),
    asset: claim
      ? {
          name: claim.asset_name,
          type: claim.asset_type,
          issuer: claim.issuer,
          file_hash: claim.file_hash,
          claim_id: claim.claim_id,
          submitted_by: claim.submitted_by,
          submitted_at: claim.submitted_at,
          metadata: claim.metadata,
        }
      : {
          name: block.event.action,
          type: "AUDIT_EVENT",
          issuer: block.event.actor,
        },
    blockchain: {
      block_index: block.index,
      block_hash: stored,
      previous_hash: block.previousHash,
      nonce: block.nonce,
      difficulty: 3,
      timestamp: block.event.at,
    },
    trust: {
      score,
      risk_tier: tier,
      verdict:
        chainValid && hashValid && claimValid
          ? "INTEGRITY VERIFIED"
          : "REVIEW REQUIRED",
      breakdown,
      flags: [
        ...(!chainValid ? ["Chain integrity failed"] : []),
        ...(claim && !claimValid ? ["Claim metadata fingerprint failed"] : []),
      ],
      weights: {
        hash_integrity: 35,
        proof_of_work: 25,
        chain_depth: 20,
        claim_integrity: 15,
        issuer_trust: 5,
      },
    },
    integrity: {
      chain_valid: chainValid,
      block_valid: hashValid,
      claim_valid: claimValid,
    },
    scope:
      "Verifies registered bytes and audit integrity. Does not certify issuer authenticity or legal validity.",
  };
}
