/**
 * Minimal browser zip reader (no dependency). Reads the central directory, so
 * sizes are right even for zips written with data descriptors (java.util.zip).
 * Supports stored (0) and deflate (8) only; no zip64, no encryption.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findEocd(view: DataView): number {
  // EOCD is 22 bytes plus a comment of up to 65535 bytes.
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('Unsupported zip: no end-of-central-directory record');
}

/** Returns file path (`/`-separated) -> contents. Directory entries are skipped. */
export async function readZip(blob: Blob): Promise<Map<string, Blob>> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  if (count === 0xffff || p === 0xffffffff) throw new Error('Unsupported zip: zip64');

  const out = new Map<string, Blob>();
  const decoder = new TextDecoder('utf-8');
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== CEN_SIG) throw new Error('Unsupported zip: bad central directory');
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (compSize === 0xffffffff) throw new Error('Unsupported zip: zip64');

    if (view.getUint32(localOffset, true) !== LOC_SIG) throw new Error('Unsupported zip: bad local header');
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const data = buf.subarray(start, start + compSize);
    if (method === 0) out.set(name, new Blob([data as BlobPart]));
    else if (method === 8) out.set(name, new Blob([(await inflateRaw(data)) as BlobPart]));
    else throw new Error(`Unsupported zip: compression method ${method}`);
  }
  return out;
}
