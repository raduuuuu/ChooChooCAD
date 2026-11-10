/**
 * WHERE A PHOTO WAS TAKEN, FOUND AND REMOVED (community-pieces plan, eng D5;
 * the V3 check found GitHub keeps it): a JPEG read as its segments, no image
 * library.
 *
 *   FFD8 │ APP0 JFIF │ APP1 Exif ── TIFF ── IFD0 ─┬─ 0x0112 Orientation
 *        │           │                           └─ 0x8825 → GPS IFD
 *        │ APP1 XMP (may repeat GPS as text) │ APP13 IPTC │ ... │ SOS → image data
 *
 * Location is reported when the GPS IFD holds any entry, or XMP names a GPS
 * field. Stripping drops every APP1 (Exif and XMP) and APP13 segment, then
 * writes back a minimal Exif holding only the Orientation, so a phone photo
 * taken sideways still shows the right way up, and the 35mm-equivalent focal
 * length (Exif IFD 0xA405), which sets the scale (photo.ts, chooseScale).
 * Everything from SOS on is copied byte for byte.
 */

const SOI = 0xd8, SOS = 0xda, EOI = 0xd9, APP1 = 0xe1, APP13 = 0xed;
const TAG_ORIENTATION = 0x0112, TAG_GPS = 0x8825, TAG_EXIF = 0x8769, TAG_FOCAL_35 = 0xa405;

interface Segment {
  readonly marker: number;
  /** The whole segment, marker and length included. */
  readonly start: number;
  readonly end: number;
}

/** The segments before the image data, and where the image data starts. Throws on anything not a JPEG. */
function segments(bytes: Uint8Array): { list: Segment[]; dataStart: number } {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) throw new Error('not a JPEG (it does not start with FFD8)');
  const list: Segment[] = [];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) throw new Error(`not a JPEG: no marker at byte ${i}`);
    const marker = bytes[i + 1]!;
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === SOS || marker === EOI) return { list, dataStart: i };
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (len < 2 || i + 2 + len > bytes.length) throw new Error(`not a JPEG: segment at byte ${i} runs past the end`);
    list.push({ marker, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  throw new Error('not a JPEG: no image data');
}

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)));
const isExif = (bytes: Uint8Array, s: Segment) => s.marker === APP1 && ascii(bytes, s.start + 4, s.start + 10) === 'Exif\0\0';
const isXmp = (bytes: Uint8Array, s: Segment) => s.marker === APP1 && ascii(bytes, s.start + 4, s.start + 33) === 'http://ns.adobe.com/xap/1.0/\0';

/** A TIFF block's IFD0 entries and its byte order. */
function readTiff(t: DataView): { little: boolean; entries: Map<number, { type: number; count: number; value: number }> } | null {
  if (t.byteLength < 8) return null;
  const order = t.getUint16(0);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) return null;
  const ifd = t.getUint32(4, little);
  return { little, entries: readIfd(t, ifd, little) };
}

function readIfd(t: DataView, at: number, little: boolean): Map<number, { type: number; count: number; value: number }> {
  const entries = new Map<number, { type: number; count: number; value: number }>();
  if (at + 2 > t.byteLength) return entries;
  const n = t.getUint16(at, little);
  for (let k = 0; k < n; k++) {
    const e = at + 2 + 12 * k;
    if (e + 12 > t.byteLength) break;
    const tag = t.getUint16(e, little), type = t.getUint16(e + 2, little), count = t.getUint32(e + 4, little);
    // A SHORT fits in the first two bytes of the value field; a LONG or an offset fills it.
    const value = type === 3 ? t.getUint16(e + 8, little) : t.getUint32(e + 8, little);
    entries.set(tag, { type, count, value });
  }
  return entries;
}

const tiffOf = (bytes: Uint8Array, s: Segment) => new DataView(bytes.buffer, bytes.byteOffset + s.start + 10, s.end - s.start - 10);

/** True when the photo says where it was taken: a GPS IFD with any entry, or a GPS field in its XMP. */
export function hasLocation(bytes: Uint8Array): boolean {
  const { list } = segments(bytes);
  for (const s of list) {
    if (isExif(bytes, s)) {
      const tiff = tiffOf(bytes, s);
      const read = readTiff(tiff);
      const gps = read?.entries.get(TAG_GPS);
      if (read && gps && readIfd(tiff, gps.value, read.little).size > 0) return true;
    }
    if (isXmp(bytes, s) && /exif:GPS|GPSLatitude|GPSLongitude/.test(ascii(bytes, s.start, s.end))) return true;
  }
  return false;
}

/** The photo's Orientation (1 to 8), or undefined when it has none. */
export function orientationOf(bytes: Uint8Array): number | undefined {
  for (const s of segments(bytes).list) {
    if (!isExif(bytes, s)) continue;
    const o = readTiff(tiffOf(bytes, s))?.entries.get(TAG_ORIENTATION);
    if (o && o.value >= 1 && o.value <= 8) return o.value;
  }
  return undefined;
}

/** The focal length as a 35mm camera's, mm (Exif IFD FocalLengthIn35mmFilm), or undefined when the photo has none. */
export function focal35Of(bytes: Uint8Array): number | undefined {
  for (const s of segments(bytes).list) {
    if (!isExif(bytes, s)) continue;
    const tiff = tiffOf(bytes, s);
    const read = readTiff(tiff);
    const exif = read?.entries.get(TAG_EXIF);
    if (!read || !exif) continue;
    const f = readIfd(tiff, exif.value, read.little).get(TAG_FOCAL_35);
    if (f && f.type === 3 && f.value > 0) return f.value;
  }
  return undefined;
}

/**
 * The JPEG's stored size, from its frame header (SOF0 to SOF15; C4, C8 and CC
 * are other markers). Phones often write progressive SOF2. An EXIF thumbnail's
 * own frame header sits inside APP1, which `segments` steps over whole.
 */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  for (const s of segments(bytes).list) {
    if (s.marker < 0xc0 || s.marker > 0xcf || s.marker === 0xc4 || s.marker === 0xc8 || s.marker === 0xcc) continue;
    if (s.end - s.start < 9) break;
    return { height: (bytes[s.start + 5]! << 8) | bytes[s.start + 6]!, width: (bytes[s.start + 7]! << 8) | bytes[s.start + 8]! };
  }
  throw new Error('not a JPEG: no frame header');
}

/** A minimal Exif APP1, big-endian: IFD0 with the Orientation and, when given, an Exif IFD with the 35mm focal length. */
function minimalExif(orientation: number | undefined, focal35: number | undefined): Uint8Array {
  const short = (tag: number, v: number) => [tag >> 8, tag & 0xff, 0, 3, 0, 0, 0, 1, v >> 8, v & 0xff, 0, 0];
  const n0 = (orientation !== undefined ? 1 : 0) + (focal35 !== undefined ? 1 : 0), exifAt = 8 + 2 + 12 * n0 + 4;
  const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, n0];
  if (orientation !== undefined) tiff.push(...short(TAG_ORIENTATION, orientation));
  if (focal35 !== undefined) tiff.push(TAG_EXIF >> 8, TAG_EXIF & 0xff, 0, 4, 0, 0, 0, 1, 0, 0, exifAt >> 8, exifAt & 0xff);
  tiff.push(0, 0, 0, 0);
  if (focal35 !== undefined) tiff.push(0, 1, ...short(TAG_FOCAL_35, focal35), 0, 0, 0, 0);
  const body = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = body.length + 2;
  return Uint8Array.from([0xff, APP1, len >> 8, len & 0xff, ...body]);
}

/**
 * The same photo with its Exif, XMP and IPTC removed, keeping only its
 * Orientation and 35mm focal length; the image data is untouched.
 */
export function stripMetadata(bytes: Uint8Array): Uint8Array {
  const { list, dataStart } = segments(bytes);
  const orientation = orientationOf(bytes), focal35 = focal35Of(bytes);
  const kept = list.filter((s) => s.marker !== APP1 && s.marker !== APP13);
  // The Orientation goes right after JFIF's APP0 when there is one, else first.
  const head: Uint8Array[] = [Uint8Array.of(0xff, SOI)];
  const app0 = kept.length > 0 && kept[0]!.marker === 0xe0 ? [kept[0]!] : [];
  for (const s of app0) head.push(bytes.subarray(s.start, s.end));
  if (orientation !== undefined || focal35 !== undefined) head.push(minimalExif(orientation, focal35));
  for (const s of kept.slice(app0.length)) head.push(bytes.subarray(s.start, s.end));
  head.push(bytes.subarray(dataStart));
  const out = new Uint8Array(head.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of head) { out.set(p, o); o += p.length; }
  return out;
}
