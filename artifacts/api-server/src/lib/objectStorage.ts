import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

interface StoredFileMeta {
  contentType: string;
  size: number;
  originalName: string;
}

interface PendingUpload {
  absolutePath: string;
  expiresAt: number;
}

const STORAGE_ROOT = path.resolve(process.env.LOCAL_OBJECT_STORAGE_DIR || path.join(process.cwd(), 'uploads'));
const PRIVATE_DIR = path.join(STORAGE_ROOT, 'private');
const PUBLIC_DIR = path.join(STORAGE_ROOT, 'public');
const UPLOAD_TTL_MS = 15 * 60 * 1000; // 15 minutes, single-use

// In-memory ticket store for the two-step upload protocol — a token minted
// after an authenticated /uploads/request-url call is the only credential
// needed for the subsequent unauthenticated PUT (mirrors presigned-URL
// semantics: the URL itself is the authorization).
const pendingUploads = new Map<string, PendingUpload>();

function sweepExpiredUploads() {
  const now = Date.now();
  for (const [token, entry] of pendingUploads) {
    if (entry.expiresAt < now) pendingUploads.delete(token);
  }
}

function metaPath(absolutePath: string): string {
  return `${absolutePath}.meta.json`;
}

/** Resolve a relative object path under `root`, rejecting any traversal outside it. */
function resolveSafe(root: string, relativeSegments: string[]): string {
  const resolved = path.resolve(root, ...relativeSegments);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ObjectNotFoundError();
  }
  return resolved;
}

export class ObjectStorageService {
  constructor() {
    fs.mkdirSync(path.join(PRIVATE_DIR, 'uploads'), { recursive: true });
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  /**
   * Mints a single-use upload ticket. Returns the token (to build the PUT URL
   * from) and the objectPath to store in the database — same objectPath shape
   * (`/objects/uploads/<uuid>`) as before, so no other code needs to change.
   */
  createUploadTicket(): { token: string; objectPath: string } {
    sweepExpiredUploads();
    const objectId = randomUUID();
    const absolutePath = path.join(PRIVATE_DIR, 'uploads', objectId);
    const token = randomUUID();
    pendingUploads.set(token, { absolutePath, expiresAt: Date.now() + UPLOAD_TTL_MS });
    return { token, objectPath: `/objects/uploads/${objectId}` };
  }

  /** Consumes an upload ticket, returning the absolute path to write to, or null if invalid/expired. */
  consumeUploadTicket(token: string): string | null {
    const entry = pendingUploads.get(token);
    pendingUploads.delete(token);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.absolutePath;
  }

  async writeMeta(absolutePath: string, meta: StoredFileMeta): Promise<void> {
    await fs.promises.writeFile(metaPath(absolutePath), JSON.stringify(meta));
  }

  /** Writes a server-generated buffer (e.g. a generated docx) directly to private storage and returns its objectPath. */
  async savePrivateObject(buffer: Buffer, contentType: string, originalName: string): Promise<string> {
    const objectId = randomUUID();
    const absolutePath = path.join(PRIVATE_DIR, 'uploads', objectId);
    await fs.promises.writeFile(absolutePath, buffer);
    await this.writeMeta(absolutePath, { contentType, size: buffer.length, originalName });
    return `/objects/uploads/${objectId}`;
  }

  private async readMeta(absolutePath: string): Promise<StoredFileMeta | null> {
    try {
      const raw = await fs.promises.readFile(metaPath(absolutePath), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Resolve a private `/objects/...` path to an absolute file path, verifying it exists. */
  async getPrivateObjectPath(objectPath: string): Promise<string> {
    if (!objectPath.startsWith('/objects/')) throw new ObjectNotFoundError();
    const segments = objectPath.slice('/objects/'.length).split('/').filter(Boolean);
    if (segments.some((s) => s === '..' || s === '.')) throw new ObjectNotFoundError();
    const absolutePath = resolveSafe(PRIVATE_DIR, segments);
    if (!fs.existsSync(absolutePath)) throw new ObjectNotFoundError();
    return absolutePath;
  }

  /** Resolve a public object under any of the configured search paths (kept as a single `public/` root locally). */
  async getPublicObjectPath(filePath: string): Promise<string | null> {
    const segments = filePath.split('/').filter(Boolean);
    if (segments.some((s) => s === '..' || s === '.')) return null;
    const absolutePath = resolveSafe(PUBLIC_DIR, segments);
    return fs.existsSync(absolutePath) ? absolutePath : null;
  }

  /** Reads a private `/objects/...` file fully into memory (e.g. for docxtemplater). */
  async readPrivateObject(objectPath: string): Promise<Buffer> {
    const absolutePath = await this.getPrivateObjectPath(objectPath);
    return fs.promises.readFile(absolutePath);
  }

  async streamObject(absolutePath: string): Promise<{ stream: fs.ReadStream; contentType: string; size: number }> {
    const meta = await this.readMeta(absolutePath);
    const stat = await fs.promises.stat(absolutePath);
    return {
      stream: fs.createReadStream(absolutePath),
      contentType: meta?.contentType || 'application/octet-stream',
      size: stat.size,
    };
  }

  /** Normalizes a raw stored path — kept for interface parity; local paths are already normalized. */
  normalizeObjectEntityPath(rawPath: string): string {
    return rawPath;
  }
}
