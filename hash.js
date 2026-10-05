const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const INIT = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const W = new Uint32Array(64);

const compress = (state, block) => {
  for (let i = 0; i < 16; i++) W[i] = block[i];
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15];
    const b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g; g = f; f = e; e = (d + t1) | 0;
    d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  state[0] = (state[0] + a) | 0; state[1] = (state[1] + b) | 0;
  state[2] = (state[2] + c) | 0; state[3] = (state[3] + d) | 0;
  state[4] = (state[4] + e) | 0; state[5] = (state[5] + f) | 0;
  state[6] = (state[6] + g) | 0; state[7] = (state[7] + h) | 0;
};

const toWords = bytes => {
  const out = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = (bytes[i * 4] << 24) | (bytes[i * 4 + 1] << 16) | (bytes[i * 4 + 2] << 8) | bytes[i * 4 + 3];
  }
  return out;
};

const sha256 = bytes => {
  const state = Int32Array.from(INIT);
  const total = bytes.length;
  const padded = new Uint8Array(Math.ceil((total + 9) / 64) * 64);
  padded.set(bytes);
  padded[total] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((total * 8) / 4294967296));
  view.setUint32(padded.length - 4, (total * 8) >>> 0);
  for (let o = 0; o < padded.length; o += 64) compress(state, toWords(padded.subarray(o, o + 64)));
  return state;
};

const stateToBytes = state => {
  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) view.setUint32(i * 4, state[i] >>> 0);
  return out;
};

const hmacStates = keyBytes => {
  let key = keyBytes;
  if (key.length > 64) key = stateToBytes(sha256(key));
  const ipad = new Uint8Array(64).fill(0x36);
  const opad = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < key.length; i++) {
    ipad[i] ^= key[i];
    opad[i] ^= key[i];
  }
  const inner = Int32Array.from(INIT);
  const outer = Int32Array.from(INIT);
  compress(inner, toWords(ipad));
  compress(outer, toWords(opad));
  return { inner, outer };
};

const finish = (base, data) => {
  const state = Int32Array.from(base);
  const block = new Uint32Array(16);
  block.set(data);
  block[data.length] = 0x80000000;
  block[15] = (64 + data.length * 4) * 8;
  compress(state, block);
  return state;
};

export const pbkdf2Sha256 = (passwordBytes, saltBytes, iterations) => {
  const { inner, outer } = hmacStates(passwordBytes);
  const first = new Uint8Array(saltBytes.length + 4);
  first.set(saltBytes);
  first[first.length - 1] = 1;
  const innerState = Int32Array.from(inner);
  const padded = new Uint8Array(Math.ceil((first.length + 9) / 64) * 64);
  padded.set(first);
  padded[first.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = (64 + first.length) * 8;
  view.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
  view.setUint32(padded.length - 4, bits >>> 0);
  for (let o = 0; o < padded.length; o += 64) compress(innerState, toWords(padded.subarray(o, o + 64)));
  let u = finish(outer, innerState);
  const t = Int32Array.from(u);
  for (let i = 1; i < iterations; i++) {
    u = finish(outer, finish(inner, u));
    for (let j = 0; j < 8; j++) t[j] ^= u[j];
  }
  return stateToBytes(t);
};

const toHex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const subtleHash = async (passwordBytes, saltBytes, iterations) => {
  const material = await crypto.subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, material, 256);
  return new Uint8Array(bits);
};

export const derivePasswordHash = async (password, salt, iterations) => {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const saltBytes = enc.encode(salt);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      return toHex(await subtleHash(passwordBytes, saltBytes, iterations));
    } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 0));
  return toHex(pbkdf2Sha256(passwordBytes, saltBytes, iterations));
};
