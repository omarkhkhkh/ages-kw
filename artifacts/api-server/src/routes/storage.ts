import { Readable } from 'stream';
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

function isMimeAllowed(contentType: string): boolean {
  const ct = contentType.toLowerCase().split(';')[0].trim();
  return ALLOWED_MIME_PREFIXES.some(prefix => ct.startsWith(prefix));
}

/** Check session-based auth (express-session with req.session.userId) */
function isSessionAuthenticated(req: Request): boolean {
  return !!(req.session as any)?.userId;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires session auth so unauthenticated callers cannot mint write-capable URLs.
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

    // Server-side size validation
    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: `حجم الملف يتجاوز الحد المسموح (20 ميغابايت)` });
      return;
    }

    // Server-side MIME validation
    if (!isMimeAllowed(contentType)) {
      res.status(400).json({ error: 'نوع الملف غير مسموح. الأنواع المسموحة: PDF، صور، Word، Excel.' });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

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
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Unconditionally public — no authentication checks.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'الملف غير موجود' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'فشل في جلب الملف' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 * Requires session authentication — no anonymous access.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  // Require valid session for private objects
  if (!isSessionAuthenticated(req)) {
    res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول.' });
    return;
  }

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
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
