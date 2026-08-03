# Music Event Blog Server

Express/Postgres API for the Music Event Blog.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY`.
3. Install and run:

```sh
npm install
npm run dev
```

The frontend should use:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Security

Article and category reads are public. Create, update, and delete endpoints
require a valid Supabase access token whose `profiles.role` is `admin`.

Never commit `DATABASE_URL`. If a database password has previously appeared in
Git history, rotate it in Supabase before deploying.

## Routes

- `GET /health`
- `GET /posts`
- `GET /posts/:postId`
- `POST /posts` (admin)
- `PATCH /posts/:postId` (admin)
- `DELETE /posts/:postId` (admin)
- `GET /categories`
- `POST /categories` (admin)
- `PATCH /categories/:categoryId` (admin)
- `DELETE /categories/:categoryId` (admin)

## Deployment

Configure the variables from `.env.example` in the backend Vercel project.
Set `FRONTEND_URL` to the deployed frontend origin without a trailing slash.

Run the frontend's `supabase/storage.sql` once in the Supabase SQL Editor to
create the article image bucket and admin-only write policies.
