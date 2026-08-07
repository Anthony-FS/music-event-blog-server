import "dotenv/config";

import connectionPool from "../utils/db.mjs";

await connectionPool.query(`
  create table if not exists public.notifications (
    id bigserial primary key,
    recipient_id uuid not null references public.profiles(id) on delete cascade,
    actor_id uuid not null references public.profiles(id) on delete cascade,
    post_id integer not null references public.posts(id) on delete cascade,
    event_type text not null check (event_type in ('like', 'comment')),
    comment_id integer references public.comments(id) on delete cascade,
    is_read boolean not null default false,
    created_at timestamp with time zone not null default now(),
    check (
      (event_type = 'comment' and comment_id is not null)
      or (event_type = 'like' and comment_id is null)
    )
  );

  create unique index if not exists notifications_unique_like_idx
    on public.notifications (recipient_id, actor_id, post_id)
    where event_type = 'like';

  create index if not exists notifications_recipient_created_at_idx
    on public.notifications (recipient_id, created_at desc);
`);

console.log("notifications table is ready.");
await connectionPool.end();
