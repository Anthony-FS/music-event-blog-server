# Workshop Notes

## Submission checklist

| เกณฑ์ | สถานะ | ไฟล์ |
|--------|--------|------|
| Unit ≥ 5/6 เคสบังคับ (Happy + Error) | ✅ 7/7 (6 บังคับ + Happy) | `test/postValidation.test.mjs` |
| Custom design ≥ 2 เคส + reject ≥ 1 | ✅ 2 custom (image missing, description 121 chars) | `test/postValidation.test.mjs` (comment block บรรทัด 1–16) |
| Mock test + assertion | ✅ `vi.mock` Supabase + `createPostMock` | `test/protectUser.test.mjs`, `test/posts.create.integration.test.mjs` |
| Integration Happy + Error ≥ 1 | ✅ Happy 201 + Error 400 + Error 401 | `test/posts.create.integration.test.mjs` |
| Coverage notes | ✅ ด้านล่าง | — |
| TestSprite notes | ✅ ด้านล่าง | — |

รันทดสอบทั้งหมด: `npm test` → **24 passed**

---

## Coverage

### ผลที่รันได้

```
npx vitest run --coverage

 RUN  v4.1.10
      Coverage enabled with v8

 Test Files  4 passed (4)
      Tests  24 passed (24)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   18.79 |    20.14 |    9.57 |   18.79 |
 app.mjs           |   70.96 |    83.33 |   66.66 |   70.96 | 45-57,73,77-78
 postValidation    |      92 |    91.66 |     100 |      92 | 27,37
 protectUser.mjs   |    90.9 |      100 |     100 |    90.9 | 18
 protectAdmin.mjs  |      25 |    28.57 |     100 |      25 | 11-32
 postService.mjs   |       0 |        0 |       0 |       0 | 7-351
-------------------|---------|----------|---------|---------|-------------------

Statements   : 18.79% ( 100/532 )
Branches     : 20.14% ( 55/273 )
Functions    : 9.57% ( 9/94 )
Lines        : 18.79% ( 100/532 )
```

- Uncovered 1: `middlewares/protectUser.mjs` — line 18 (catch → 500 when Supabase throws)
- Uncovered 2: `middlewares/postValidation.mjs` — lines 27, 37 (`description` / `content` required branches)
- จะปิดก่อน: `middlewares/protectUser.mjs` — invalid token → 401 (lines 12–13)
- เหตุผล (Impact / Likelihood):
  - **Impact: สูง** — `protectUser` คุ้มครอง likes, comments, notifications และ avatars
  - **Likelihood: สูง** — token หมดอายุ / token ผิด เกิดบ่อยใน production
  - ไม่เลือกแค่เพราะ % ต่ำสุด — เลือกเพราะเป็น **security gate** ที่ user-facing

### Test ที่เพิ่มจาก Coverage prioritization

- `test/protectUser.test.mjs` — mock `supabase.auth.getUser`, invalid token → 401

---

## TestSprite

### Setup

1. ติดตั้ง TestSprite MCP ใน Cursor (`Settings → MCP → TestSprite`)
2. ใส่ `API_KEY` จาก [TestSprite Dashboard → Settings → API Keys](https://www.testsprite.com/dashboard/settings/apikey)
3. รัน backend local: `npm start` (port **4000**)
4. ใน chat: *"Help me test this project with TestSprite"*

### ผลที่ลองรัน

- **Project type:** backend (Express API)
- **Local port:** 4000
- **Endpoint ทดสอบ:** `GET /health` → `{ "message": "OK" }`
- **สถานะ:** MCP เชื่อมต่อได้ แต่ API key ที่ config ไว้ถูก reject (`Invalid TestSprite API Key`) — ต้องสร้าง key ใหม่แล้ว restart MCP ก่อน bootstrap ได้

### Workflow ที่ TestSprite จะรัน (เมื่อ API key ถูกต้อง)

1. Bootstrap environment
2. Analyze codebase
3. Generate backend test plan
4. Generate + execute tests ผ่าน tunnel ไป local server
5. รายงานผล / dashboard

---

## ไฟล์ที่ส่ง

| ไฟล์ | ประเภท |
|------|--------|
| `test/postValidation.test.mjs` | Unit — validateCreatePost |
| `test/protectUser.test.mjs` | Unit — mock auth middleware |
| `test/posts.create.integration.test.mjs` | Integration — POST /posts |
| `test/app.test.mjs` | Integration — smoke / auth guards |
| `workshop-notes.md` | Coverage + TestSprite notes |
