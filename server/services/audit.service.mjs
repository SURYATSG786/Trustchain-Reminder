import { createHash, randomUUID } from "node:crypto";
export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function appendBlock(state, action, recordId, detail, actor) {
  const event = {
    id: randomUUID(),
    at: new Date().toISOString(),
    action,
    recordId,
    detail,
    actor,
  };
  const previousHash = state.chain.at(-1)?.hash || "0".repeat(64);
  const block = { index: state.chain.length, previousHash, event, nonce: 0 };
  while (!hash(JSON.stringify(block)).startsWith("000")) block.nonce++;
  block.hash = hash(JSON.stringify(block));
  state.chain.push(block);
  return block;
}
export function audit(chain) {
  for (let i = 0; i < chain.length; i++) {
    const { hash: stored, ...body } = chain[i];
    if (
      body.index !== i ||
      body.previousHash !== (i ? chain[i - 1].hash : "0".repeat(64)) ||
      hash(JSON.stringify(body)) !== stored ||
      !stored.startsWith("000")
    )
      return { valid: false, blocks: chain.length, invalidBlock: i };
  }
  return {
    valid: true,
    blocks: chain.length,
    head: chain.at(-1)?.hash || null,
  };
}
