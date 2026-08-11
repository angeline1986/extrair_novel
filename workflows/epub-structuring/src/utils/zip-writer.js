import fs from 'fs';
import zlib from 'zlib';

const CRC_TABLE = makeCrcTable();

export function writeZipFile(outputPath, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const store = Boolean(entry.store);
    const compressed = store ? data : zlib.deflateRawSync(data);
    const method = store ? 0 : 8;
    const crc = crc32(data);
    const local = localHeader({ name, data, compressed, method, crc });
    localParts.push(local, compressed);
    centralParts.push(centralHeader({ name, data, compressed, method, crc, offset }));
    offset += local.length + compressed.length;
  }

  const centralStart = offset;
  const central = Buffer.concat(centralParts);
  const end = endOfCentralDirectory(entries.length, central.length, centralStart);
  fs.writeFileSync(outputPath, Buffer.concat([...localParts, central, end]));
}

export function auditZipMimetype(epubPath) {
  const data = fs.readFileSync(epubPath);
  const firstNameLength = data.readUInt16LE(26);
  const firstExtraLength = data.readUInt16LE(28);
  const firstName = data.subarray(30, 30 + firstNameLength).toString('utf8');
  const firstMethod = data.readUInt16LE(8);
  return {
    firstEntry: firstName,
    compressionMethod: firstMethod,
    zipMimetypeOk: firstName === 'mimetype' && firstMethod === 0,
    firstDataOffset: 30 + firstNameLength + firstExtraLength
  };
}

function localHeader({ name, data, compressed, method, crc }) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, name]);
}

function centralHeader({ name, data, compressed, method, crc, offset }) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(method, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, name]);
}

function endOfCentralDirectory(count, centralSize, centralOffset) {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return end;
}

function crc32(buffer) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makeCrcTable() {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}
