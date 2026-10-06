# End-to-end tests

Two suites, split by what they are allowed to touch (same split as the client).

## Mocked: `mocked/*.test.mjs`

Hermetic. Starts the real Express app on an ephemeral port and drives it with
`fetch`. Postgres, Supabase auth and the repositories are replaced by the
stateful in-memory fakes in `mocked/fakes.mjs` (auth tokens come from
`test/helpers/auth.mjs`: `admin-token`, `member-token`). No credentials, no
network, so CI runs it on every push and write flows belong here.

```bash
npm run test:e2e:mocked
```

Fake repositories must keep the shapes the services read, or a journey passes
against a fake that no longer matches the real SQL.

## Live smoke: `smoke.test.mjs`

Runs against the deployed API and is **read-only**: no valid token, no
successful writes. Point it elsewhere with `E2E_BASE_URL`.

```bash
npm run test:e2e
E2E_BASE_URL=http://localhost:4000 npm run test:e2e
```

CI runs it nightly and on demand only. Never add a sign-in or a write here.

## Other layers

- `test/unit`: services, middleware and utils with repositories mocked.
- `test/integration`: real routes, controllers, services and auth middleware over
  supertest, with only repositories, the db pool and Supabase faked.
- Run both with `npm test`.
