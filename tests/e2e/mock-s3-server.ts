import { createServer } from 'node:http';

// A minimal S3-compatible test double: just enough PUT/GET/HEAD/DELETE
// semantics (path-style, unauthenticated) for @aws-sdk/client-s3's
// PutObject/GetObject/HeadObject/DeleteObject and presigned PUT uploads to
// work against it. This lets the E2E suite exercise the real
// S3MediaStorage/AWS SDK code path (the same one apps/api and apps/worker
// use in production) without needing real cloud credentials.
const port = Number(process.env.MOCK_S3_PORT ?? 4200);
const objects = new Map<string, { body: Buffer; contentType: string }>();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  const key = decodeURIComponent(url.pathname.slice(1));
  if (req.method === 'PUT') {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      objects.set(key, {
        body: Buffer.concat(chunks),
        contentType: req.headers['content-type'] ?? 'application/octet-stream',
      });
      res.writeHead(200, { etag: '"mock-etag"' });
      res.end();
    });
    return;
  }
  if (req.method === 'HEAD' || req.method === 'GET') {
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-length': object.body.length,
      'content-type': object.contentType,
    });
    res.end(req.method === 'GET' ? object.body : undefined);
    return;
  }
  if (req.method === 'DELETE') {
    objects.delete(key);
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(405);
  res.end();
});
server.listen(port, () => console.log(`mock S3 listening on ${port}`));
