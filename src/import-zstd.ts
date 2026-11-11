import { promisify } from 'node:util';
import { constants, zstdDecompress } from 'node:zlib';

const decompress = promisify(zstdDecompress);

function frameEnd(raw: Buffer, start: number) {
  if (start + 5 > raw.length) throw new Error('压缩帧头不完整。');
  const descriptor = raw[start + 4]!;
  if (descriptor & 0x18) throw new Error('压缩帧头包含无效标记。');
  const singleSegment = (descriptor & 0x20) !== 0;
  const dictionary = descriptor & 3;
  const contentSize = descriptor >>> 6;
  let offset = start + 5 + Number(!singleSegment) + (dictionary === 3 ? 4 : dictionary)
    + (contentSize === 0 ? Number(singleSegment) : 1 << contentSize);
  // Node 24 can return partial output for a truncated frame.
  for (;;) {
    if (offset + 3 > raw.length) throw new Error('压缩帧不完整。');
    const header = raw.readUIntLE(offset, 3);
    const kind = (header >>> 1) & 3;
    if (kind === 3) throw new Error('压缩块类型无效。');
    offset += 3 + (kind === 1 ? 1 : header >>> 3);
    if (header & 1) break;
  }
  offset += (descriptor & 4) ? 4 : 0;
  if (offset > raw.length) throw new Error('压缩帧不完整。');
  return offset;
}

export async function* decodeImportFrames(raw: Buffer, limit: number) {
  let offset = 0;
  let remaining = limit;
  while (offset < raw.length) {
    if (offset + 4 > raw.length) throw new Error('压缩帧头不完整。');
    const magic = raw.readUInt32LE(offset);
    if ((magic & 0xfffffff0) === 0x184d2a50) {
      if (offset + 8 > raw.length) throw new Error('压缩帧头不完整。');
      offset += 8 + raw.readUInt32LE(offset + 4);
      if (offset > raw.length) throw new Error('压缩帧不完整。');
      continue;
    }
    if (magic !== 0xfd2fb528) throw new Error('文件不是有效的 Zstandard 会话记录。');
    const end = frameEnd(raw, offset);
    let data: Buffer;
    try {
      data = await decompress(raw.subarray(offset, end), {
        maxOutputLength: Math.max(1, remaining),
        params: { [constants.ZSTD_d_windowLogMax]: Math.log2(limit) },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE')
        throw new Error('解压后的会话记录超过 64 MiB。');
      throw new Error('压缩会话记录无法解码。', { cause: error });
    }
    remaining -= data.length;
    if (remaining < 0) throw new Error('解压后的会话记录超过 64 MiB。');
    offset = end;
    yield data;
  }
}
