# SentiBoard Frontend Integration (Basic)

This backend is designed to be consumed by a Next.js frontend using server-side proxy rewrites.

## 1) Base idea

- Frontend calls same-origin paths (through Next.js).
- Next.js rewrites those paths to this backend.
- Browser does not call backend cross-origin directly.

## 2) Backend endpoint

- Health: /health
- Processors: /api/v1/processors/releases

## 3) Recommended Next.js rewrite

In next.config.js, add a rewrite so frontend calls stay same-origin:

  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/api/v1/:path*"
      }
    ];
  }

With this, frontend should call:

- /api/backend/processors/releases

## 4) Backend CORS mode

Default for this setup:

- SB_ENABLE_CORS=false

Why:

- With rewrites, CORS is usually unnecessary.
- Keep backend surface stricter by default.

## 5) Minimal backend env example

Create or update .env in this folder with:

  SB_ENABLE_CORS=false
  SB_PROCESSORS_TIMEOUT_SECONDS=20
  SB_PROCESSORS_CACHE_TTL_SECONDS=3600

## 6) Expected response shape

Frontend should rely on this shape:

- data.processors_releases (array)
- meta.source
- meta.fetched_at
- meta.cache_ttl_seconds
- meta.stale
- error (null or object)

## 7) Frontend basic behavior

Implement these UI states:

1. Loading
2. Success with data
3. Success with stale data (meta.stale=true)
4. Empty list
5. Error (if request fails and no usable payload)

## 8) Local run checklist

1. Start backend on port 8000 (uvicorn main.app --reload --host 0.0.0.0 --port 8000).
2. Start frontend on port 3000.
3. Confirm frontend request goes to /api/backend/processors/releases.
4. Confirm backend receives /api/v1/processors/releases via rewrite.
5. Confirm processors page renders from returned array.
