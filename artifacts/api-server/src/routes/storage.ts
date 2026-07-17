import fs from 'fs';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/* ── Upload policy ── */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml',
];

// Some browsers/OSes report a generic or empty contentType for Office Open XML
// files (.docx/.xlsx/.pptx) instead of the proper MIME type — fall back to the
// file extension in that case rather than spuriously rejecting a valid upload.
const GENERIC_CONTENT_TYPES = ['', 'application/octet-stream', 'application/zip'];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

function isMimeAllowed(contentType: string, fileName?: string): boolean {
  const ct = contentType.toLowerCase().split(';')[0].trim();
  if (ALLOWED_MIME_PREFIXES.some(prefix => ct.startsWith(prefix))) return true;
  if (GENERIC_CONTENT_TYPES.includes(ct) && fileName) {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    return ALLOWED_EXTENSIONS.includes(ext);
  }
  return false;
}

/** Check session-based auth (express-session with req.session.userId) */
function isSessionAuthenticated(req: Request): boolean {
  return !!(req.session as any)?.userId;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request an upload ticket. The client sends JSON metadata (name, size,
 * contentType) — NOT the file. Then PUTs the file directly to the returned
 * URL (a same-origin endpoint backed by local disk storage — see
 * PUT /storage/local-upload/:token below).
 * Requires session auth so unauthenticated callers cannot mint upload tickets.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!isSessionAuthenticated(req)) {
      res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول.' });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'بيانات الملف غير صالحة' });
      return;
    }

    const { name, size, contentType } = parsed.data;

    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: `حجم الملف يتجاوز الحد المسموح (20 ميغابايت)` });
      return;
    }

    if (!isMimeAllowed(contentType, name)) {
      res.status(400).json({ error: 'نوع الملف غير مسموح. الأنواع المسموحة: PDF، صور، Word، Excel.' });
      return;
    }

    try {
      const { token, objectPath } = objectStorageService.createUploadTicket();
      const uploadURL = `${req.protocol}://${req.get('host')}/api/storage/local-upload/${token}`;

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'فشل في توليد رابط الرفع' });
    }
  },
);

/**
 * PUT /storage/local-upload/:token
 *
 * Receives the raw file bytes for a previously-minted upload ticket and
 * writes them to local disk. No session check — the single-use token itself
 * is the authorization (matches how the client never sends cookies on this
 * PUT, mirroring presigned-URL semantics).
 */
router.put('/storage/local-upload/:token', async (req: Request, res: Response) => {
  const rawToken = req.params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const absolutePath = objectStorageService.consumeUploadTicket(token);
  if (!absolutePath) {
    res.status(410).json({ error: 'انتهت صلاحية رابط الرفع أو تم استخدامه من قبل' });
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(absolutePath);
      req.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
      req.on('error', reject);
    });

    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const stat = await fs.promises.stat(absolutePath);
    await objectStorageService.writeMeta(absolutePath, {
      contentType,
      size: stat.size,
      originalName: '',
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, 'Error writing uploaded file');
    res.status(500).json({ error: 'فشل في حفظ الملف' });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from the local `public/` storage directory.
 * Unconditionally public — no authentication checks.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const absolutePath = await objectStorageService.getPublicObjectPath(filePath);
      if (!absolutePath) {
        res.status(404).json({ error: 'الملف غير موجود' });
        return;
      }

      const { stream, contentType, size } = await objectStorageService.streamObject(absolutePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(size));
      res.setHeader('Cache-Control', 'public, max-age=3600');
      stream.pipe(res);
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'فشل في جلب الملف' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from local disk storage.
 * Requires session authentication — no anonymous access.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  if (!isSessionAuthenticated(req)) {
    res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول.' });
    return;
  }

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const absolutePath = await objectStorageService.getPrivateObjectPath(objectPath);

    const { stream, contentType, size } = await objectStorageService.streamObject(absolutePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'الملف غير موجود' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'فشل في جلب الملف' });
  }
});

export default router;
