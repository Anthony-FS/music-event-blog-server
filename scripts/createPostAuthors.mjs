import "dotenv/config";

import connectionPool from "../utils/db.mjs";

const authorResult = await connectionPool.query(
  `select id
   from public.profiles
   where role = 'admin'
   order by id
   limit 1`,
);
const authorId = authorResult.rows[0]?.id;

if (!authorId) {
  await connectionPool.end();
  throw new Error("An admin profile is required to assign existing posts");
}

const client = await connectionPool.connect();

try {
  await client.query("begin");
  await client.query(
    `alter table public.posts
     add column if not exists author_id uuid`,
  );
  await client.query(
    `update public.posts
     set author_id = $1
     where author_id is null`,
    [authorId],
  );
  await client.query(
    `alter table public.posts
     drop constraint if exists posts_author_id_fkey`,
  );
  await client.query(
    `alter table public.posts
     add constraint posts_author_id_fkey
     foreign key (author_id) references public.profiles(id)`,
  );
  await client.query(
    `alter table public.posts
     alter column author_id set not null`,
  );
  await client.query("commit");
  console.log("Existing posts are assigned to the current admin profile.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await connectionPool.end();
}
