export interface ZipArchiveLimits {
  maxEntries: number;
  maxExpandedBytes: number;
}

export interface ZipEntryMetadata {
  compressedBytes: number;
  expandedBytes: number;
  directory: boolean;
}

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectorySignature = 0x02014b50;
const zip64Sentinel = 0xffffffff;

export function inspectZipArchive(
  bytes: ArrayBuffer,
  limits: ZipArchiveLimits,
): Map<string, ZipEntryMetadata> {
  const view = new DataView(bytes);
  const minimumEndOffset = Math.max(0, bytes.byteLength - 22 - 0xffff);
  let endOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= minimumEndOffset; offset -= 1) {
    if (view.getUint32(offset, true) === endOfCentralDirectorySignature) {
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === bytes.byteLength) {
        endOffset = offset;
        break;
      }
    }
  }
  if (endOffset < 0 || view.getUint16(endOffset + 4, true) !== 0 || view.getUint16(endOffset + 6, true) !== 0) {
    throw new Error("The ZIP archive has an invalid or unsupported directory.");
  }

  const diskEntries = view.getUint16(endOffset + 8, true);
  const entryCount = view.getUint16(endOffset + 10, true);
  const directoryBytes = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (
    diskEntries !== entryCount ||
    entryCount === 0xffff ||
    directoryBytes === zip64Sentinel ||
    directoryOffset === zip64Sentinel ||
    entryCount > limits.maxEntries ||
    directoryOffset + directoryBytes !== endOffset
  ) {
    throw new Error("The ZIP archive exceeds supported entry limits or uses an unsupported ZIP variant.");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries = new Map<string, ZipEntryMetadata>();
  let expandedTotal = 0;
  let offset = directoryOffset;
  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (offset + 46 > endOffset || view.getUint32(offset, true) !== centralDirectorySignature) {
        throw new Error("The ZIP archive contains a malformed directory entry.");
      }
      const flags = view.getUint16(offset + 8, true);
      const method = view.getUint16(offset + 10, true);
      const compressedBytes = view.getUint32(offset + 20, true);
      const expandedBytes = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const startDisk = view.getUint16(offset + 34, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
      if (entryEnd > endOffset || localHeaderOffset >= directoryOffset) {
        throw new Error("The ZIP archive contains an invalid entry boundary.");
      }
      if ((flags & (0x0001 | 0x0040 | 0x2000)) !== 0 || (method !== 0 && method !== 8) || startDisk !== 0) {
        throw new Error("The ZIP archive contains an encrypted or unsupported entry.");
      }
      if (
        compressedBytes === zip64Sentinel ||
        expandedBytes === zip64Sentinel
      ) {
        throw new Error("ZIP64 entries are not supported.");
      }
      let extraOffset = offset + 46 + nameLength;
      const extraEnd = extraOffset + extraLength;
      while (extraOffset < extraEnd) {
        if (extraOffset + 4 > extraEnd) throw new Error("The ZIP archive contains malformed extra data.");
        const extraId = view.getUint16(extraOffset, true);
        const extraSize = view.getUint16(extraOffset + 2, true);
        if (extraOffset + 4 + extraSize > extraEnd) throw new Error("The ZIP archive contains malformed extra data.");
        if (extraId === 0x0001) throw new Error("ZIP64 entries are not supported.");
        extraOffset += 4 + extraSize;
      }
      const name = decoder.decode(new Uint8Array(bytes, offset + 46, nameLength));
      const directory = name.endsWith("/");
      const path = directory ? name.slice(0, -1) : name;
      if (
        !path ||
        path.startsWith("/") ||
        path.includes("\\") ||
        path.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":")) ||
        entries.has(path)
      ) {
        throw new Error("The ZIP archive contains an unsafe or duplicate path.");
      }
      entries.set(path, { compressedBytes, expandedBytes, directory });
      expandedTotal += expandedBytes;
      if (!Number.isSafeInteger(expandedTotal) || expandedTotal > limits.maxExpandedBytes) {
        throw new Error("The ZIP archive exceeds its safe expanded-size limit.");
      }
      offset = entryEnd;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("The ZIP archive") || error.message.startsWith("ZIP64"))
    ) {
      throw error;
    }
    throw new Error("The ZIP archive contains an invalid entry name or directory.");
  }
  if (offset !== directoryOffset + directoryBytes) {
    throw new Error("The ZIP archive directory length is inconsistent.");
  }
  return entries;
}
