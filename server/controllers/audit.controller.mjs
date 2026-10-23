import { audit } from "../domain.mjs";

import { report } from "../services/provenance.service.mjs";
export function createAuditController({ store, trustedIssuers }) {
  return {
    verifyAudit: async (req, res) => {
      const s = await store.read();
      res.json({
        chain_valid: audit(s.chain).valid,
        total_claims: s.claims.length,
        total_blocks: s.chain.length,
        audit: audit(s.chain),
        claims: s.claims.map((c) =>
          report(s, s.chain[c.block_index], trustedIssuers),
        ),
      });
    },
    getBlock: async (req, res) => {
      const s = await store.read(),
        n = Number(req.params.index);
      if (!Number.isInteger(n) || !s.chain[n])
        return res.status(404).json({ error: "Block not found" });
      res.json(report(s, s.chain[n], trustedIssuers));
    },
    getChain: async (req, res) => {
      const s = await store.read();
      res.json({
        total_blocks: s.chain.length,
        difficulty: 3,
        blocks: s.chain.map((b) => ({
          index: b.index,
          asset_name: b.event.detail?.claim?.asset_name || b.event.action,
          asset_type: b.event.detail?.claim?.asset_type || "AUDIT_EVENT",
          issuer: b.event.detail?.claim?.issuer || b.event.actor,
          block_hash: b.hash,
          nonce: b.nonce,
          timestamp: b.event.at,
          ...(b.event.detail?.claim
            ? { trust_score: report(s, b, trustedIssuers).trust.score }
            : {}),
        })),
      });
    },
    exportAudit: async (req, res) => {
      const s = await store.read();
      res.set(
        "Content-Disposition",
        'attachment; filename="trustchain-audit.json"',
      );
      res.json({ audit: audit(s.chain), chain: s.chain });
    },
  };
}
