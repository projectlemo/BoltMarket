import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { encodeQr, qrPath } from '../../src/lib/qr';

const OTPAUTH = 'otpauth://totp/Bolt%20Markets%3Asara%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Bolt%20Markets&algorithm=SHA1&digits=6&period=30';

function finder(m: boolean[][], x: number, y: number): boolean {
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (m[y + dy][x + dx] !== (ring !== 2)) return false;
    }
  return true;
}

test('version is chosen from the data length', () => {
  assert.equal(encodeQr('hi').size, 21); // version 1
  assert.equal(encodeQr('x'.repeat(100)).size, 4 * 6 + 17); // version 6 holds 106 bytes at level M
});

test('finder patterns sit in three corners', () => {
  const { size, modules } = encodeQr(OTPAUTH);
  assert.ok(finder(modules, 0, 0) && finder(modules, size - 7, 0) && finder(modules, 0, size - 7));
});

test('matches the output verified with an independent decoder (OpenCV)', () => {
  // The bit pattern below decoded back to OTPAUTH with cv2.QRCodeDetector when it was recorded.
  const { size, modules } = encodeQr(OTPAUTH);
  const bits = modules.map((r) => r.map((b) => (b ? '1' : '0')).join('')).join('\n');
  assert.equal(size, 49);
  assert.equal(createHash('sha256').update(bits).digest('hex'), '35cff2464fdc2cfa46ec1260874b53274ead93db3bbbb07ee73368ab7c7c3c6c');
});

test('svg path includes a 4-module quiet zone', () => {
  const { viewBox, path } = qrPath('hi');
  assert.equal(viewBox, 29);
  assert.ok(path.startsWith('M4 4h1v1h-1z'));
});
