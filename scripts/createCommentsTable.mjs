import "dotenv/config";

import connectionPool from "../utils/db.mjs";

await connectionPool.query(`
  create table if not exists public.comments (
    id bigserial primary key,
    post_id integer not null references public.posts(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    comment_text text not null
      check (char_length(trim(comment_text)) between 1 and 1000),
    created_at timestamp with time zone not null default now()
  );

  alter table public.comments
    drop constraint if exists comments_user_id_fkey;

  alter table public.comments
    add constraint comments_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade;

  create index if not exists comments_post_id_created_at_idx
    on public.comments (post_id, created_at desc);
`);

console.log("comments table is ready.");
await connectionPool.end();
