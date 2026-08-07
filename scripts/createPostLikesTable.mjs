import "dotenv/config";

import connectionPool from "../utils/db.mjs";

await connectionPool.query(`
  create table if not exists public.post_likes (
    post_id integer not null references public.posts(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamp with time zone not null default now(),
    primary key (post_id, user_id)
  );

  create or replace function public.update_post_likes_count()
  returns trigger
  language plpgsql
  set search_path = public
  as $$
  begin
    if tg_op = 'INSERT' then
      update posts
      set likes_count = coalesce(likes_count, 0) + 1
      where id = new.post_id;
      return new;
    end if;

    update posts
    set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
    where id = old.post_id;
    return old;
  end;
  $$;

  drop trigger if exists post_likes_count_trigger on public.post_likes;
  create trigger post_likes_count_trigger
    after insert or delete on public.post_likes
    for each row execute function public.update_post_likes_count();
`);

console.log("post_likes table is ready.");
await connectionPool.end();
