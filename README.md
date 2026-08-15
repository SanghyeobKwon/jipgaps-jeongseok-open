# 집값의 정석

대한민국 부동산 실거래, 지역 환경, 생활권과 정책을 함께 비교하는 부동산 의사결정 서비스입니다.

프로젝트를 수정하기 전에 다음 문서를 확인하세요.

- [사업 및 제품 운영 기준](BUSINESS.md)
- [저장소 전체 필수 작업 규칙](AGENTS.md)
- [제품 원칙](PRODUCT.md)
- [디자인 기준](DESIGN.md)

## Technical Base

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

로컬 개발 서버는 카카오 JavaScript SDK에 등록된 `http://localhost:3010`으로 고정됩니다. 다른 포트로 실행하면 카카오에서 `domain mismatched`로 SDK 요청을 거부하므로 `npm run dev` 또는 `pnpm dev`를 사용하세요.

## Kakao Maps

실제 도로 지도와 주소·주변 시설 검색은 카카오맵을 사용합니다.

- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: 카카오 플랫폼 키 중 JavaScript 키
- `KAKAO_REST_API_KEY`: 서버의 주소·장소 검색에 사용하는 REST API 키
- 카카오 개발자 콘솔의 JavaScript SDK 허용 도메인에는 `http://localhost:3010`과 운영 도메인을 각각 등록해야 합니다.
- 실제 키는 `.env.local`과 호스팅 환경변수에만 저장하고 Git에는 올리지 않습니다.

## Supabase Free Cache

Supabase는 선택 사항인 서버 캐시로 사용합니다. 실거래 원본의 영구 보관소나 지도 타일 저장소가 아니며, 기존 공공데이터·카카오 API 경로가 항상 fallback으로 남습니다.

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: 서버의 PostgREST 캐시 읽기·쓰기 키
- `SUPABASE_DATABASE_URL`: 마이그레이션 도구 전용 연결 문자열
- `DATA_SYNC_SECRET`: 보호된 동기화 API를 추가할 때 사용할 서버 비밀값
- 브라우저는 Supabase에 직접 연결하지 않습니다. 서비스 역할 키를 `NEXT_PUBLIC_*` 변수에 넣지 마세요.
- `SUPABASE_URL` 또는 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 캐시 계층은 자동으로 우회되고 현재 API 동작을 유지합니다.
- 최초 설정은 `supabase/migrations/0001_free_cache.sql`을 적용합니다. 기본 RLS는 `anon`과 `authenticated`의 직접 접근을 차단합니다.
- `freshForSeconds`는 정상 캐시 기간이고 `staleForSeconds`는 그 뒤에 외부 API 장애 시 사용할 추가 fallback 기간입니다.
- 무료 500MB 범위에서는 300~350MB를 운영 목표로 삼고, 만료 데이터는 `purge_expired_api_cache()`로 정리합니다.
- 단일 캐시 항목은 최대 5MiB이며, 그보다 큰 응답은 저장하지 않고 기존 API 경로로 우회합니다.

지도 행정경계 GeoJSON, 카카오 지도 타일, 외부 API 원문과 사용자 검색 기록은 이 캐시에 저장하지 않습니다.

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
