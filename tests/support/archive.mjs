import {gunzipSync} from 'node:zlib';
const fail=code=>{throw new Error(code);};
export function archiveFiles(compressed) {
  const tar = gunzipSync(compressed), files = new Map();
  if (tar.length > 8_000_000) fail('ARCHIVE_SIZE');
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/s, '').trim();
    const size = Number.parseInt(sizeText, 8);
    const type = header[156];
    if (!Number.isSafeInteger(size) || size < 0 || !/^package\/[A-Za-z0-9._/-]+$/.test(fullName) || fullName.includes('..')) fail('ARCHIVE_ENTRY');
    const body = offset + 512;
    if (body + size > tar.length) fail('ARCHIVE_ENTRY');
    if (type === 0 || type === 48) {
      if (files.has(fullName)) fail('ARCHIVE_DUPLICATE');
      files.set(fullName, tar.subarray(body, body + size));
    }
    offset = body + Math.ceil(size / 512) * 512;
  }
  return files;
}
