import connectionPool from "../utils/db.mjs";

export const POST_SELECT = `
  select
    posts.id,
    posts.title,
    posts.image,
    posts.category_id as "categoryId",
    categories.name as category,
    posts.description,
    posts.content,
    case
      when statuses.status = 'publish' then 'published'
      else statuses.status
    end as status,
    posts.date,
    posts.likes_count as likes,
    posts.author_id as "authorId",
    coalesce(
      nullif(trim(authors.name), ''),
      nullif(trim(authors.username), ''),
      'Admin'
    ) as author,
    authors.avatar_url as "authorAvatar",
    authors.bio as "authorBio"
  from posts
  left join categories on posts.category_id = categories.id
  left join statuses on posts.status_id = statuses.id
  left join profiles as authors on posts.author_id = authors.id
`;

export const COMMENT_SELECT = `
  select
    comments.id,
    comments.user_id as "userId",
    coalesce(
      nullif(trim(profiles.name), ''),
      nullif(trim(profiles.username), ''),
      'Member'
    ) as name,
    profiles.avatar_url as avatar,
    comments.comment_text as message,
    comments.created_at as "createdAt"
  from comments
  join profiles on comments.user_id = profiles.id
`;

export async function countPosts(whereClause, values) {
  const result = await connectionPool.query(
    `select count(*)::int as total
     from posts
     left join categories on posts.category_id = categories.id
     left join statuses on posts.status_id = statuses.id
     ${whereClause}`,
    values,
  );
  return result.rows[0].total;
}

export async function findPosts(whereClause, values, limit, offset) {
  const dataValues = [...values, limit, offset];
  const result = await connectionPool.query(
    `${POST_SELECT}
     ${whereClause}
     order by posts.id desc
     limit $${values.length + 1} offset $${values.length + 2}`,
    dataValues,
  );
  return result.rows;
}

export async function findPostById(postId, client = connectionPool) {
  const result = await client.query(
    `${POST_SELECT} where posts.id = $1`,
    [postId],
  );
  return result.rows[0] ?? null;
}

export async function findPostStatus(postId) {
  const result = await connectionPool.query(
    `select statuses.status
     from posts
     left join statuses on posts.status_id = statuses.id
     where posts.id = $1`,
    [postId],
  );
  return result.rows[0] ?? null;
}

export async function findCommentsByPostId(postId) {
  const result = await connectionPool.query(
    `${COMMENT_SELECT}
     where comments.post_id = $1
     order by comments.created_at desc, comments.id desc`,
    [postId],
  );
  return result.rows;
}

export async function hasUserLikedPost(postId, userId) {
  const result = await connectionPool.query(
    `select 1 from post_likes where post_id = $1 and user_id = $2`,
    [postId, userId],
  );
  return result.rowCount > 0;
}

export async function findCategoryById(client, categoryId) {
  const result = await client.query(
    `select id from categories where id = $1`,
    [categoryId],
  );
  return result.rowCount > 0;
}

export async function findStatusByName(client, status) {
  const result = await client.query(
    `select id from statuses where lower(status) = $1`,
    [status],
  );
  return result.rows[0] ?? null;
}

export async function insertPost(client, post) {
  const result = await client.query(
    `insert into posts
      (title, image, category_id, description, content, status_id, author_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      post.title,
      post.image,
      post.categoryId,
      post.description,
      post.content,
      post.statusId,
      post.authorId,
    ],
  );
  return result.rows[0].id;
}

export async function updatePost(client, postId, post) {
  const result = await client.query(
    `update posts
     set title = $2,
         image = $3,
         category_id = $4,
         description = $5,
         content = $6,
         status_id = $7
     where id = $1
     returning id`,
    [
      postId,
      post.title,
      post.image,
      post.categoryId,
      post.description,
      post.content,
      post.statusId,
    ],
  );
  return result.rowCount > 0;
}

export async function deletePost(postId) {
  const result = await connectionPool.query(
    `delete from posts where id = $1 returning id`,
    [postId],
  );
  return result.rowCount > 0;
}

export async function findPostForLike(client, postId) {
  const result = await client.query(
    `select likes_count, author_id from posts where id = $1 for update`,
    [postId],
  );
  return result.rows[0] ?? null;
}

export async function insertLike(client, postId, userId) {
  const result = await client.query(
    `insert into post_likes (post_id, user_id)
     values ($1, $2)
     on conflict (post_id, user_id) do nothing
     returning post_id`,
    [postId, userId],
  );
  return result.rowCount > 0;
}

export async function deleteLike(client, postId, userId) {
  const result = await client.query(
    `delete from post_likes
     where post_id = $1 and user_id = $2
     returning post_id`,
    [postId, userId],
  );
  return result.rowCount > 0;
}

export async function getLikesCount(client, postId) {
  const result = await client.query(
    `select likes_count from posts where id = $1`,
    [postId],
  );
  return Number(result.rows[0]?.likes_count ?? 0);
}

export async function insertLikeNotification(client, recipientId, actorId, postId) {
  await client.query(
    `insert into notifications
      (recipient_id, actor_id, post_id, event_type)
     values ($1, $2, $3, 'like')
     on conflict do nothing`,
    [recipientId, actorId, postId],
  );
}

export async function deleteLikeNotification(client, recipientId, actorId, postId) {
  await client.query(
    `delete from notifications
     where recipient_id = $1
       and actor_id = $2
       and post_id = $3
       and event_type = 'like'`,
    [recipientId, actorId, postId],
  );
}

export async function findPublishedPostForComment(client, postId) {
  const result = await client.query(
    `select posts.author_id
     from posts
     join statuses on posts.status_id = statuses.id
     where posts.id = $1 and statuses.status = 'publish'
     for share`,
    [postId],
  );
  return result.rows[0] ?? null;
}

export async function insertComment(client, postId, userId, message) {
  const result = await client.query(
    `insert into comments (post_id, user_id, comment_text)
     values ($1, $2, $3)
     returning id`,
    [postId, userId, message],
  );
  return result.rows[0].id;
}

export async function insertCommentNotification(
  client,
  recipientId,
  actorId,
  postId,
  commentId,
) {
  await client.query(
    `insert into notifications
      (recipient_id, actor_id, post_id, event_type, comment_id)
     values ($1, $2, $3, 'comment', $4)`,
    [recipientId, actorId, postId, commentId],
  );
}

export async function findCommentById(commentId) {
  const result = await connectionPool.query(
    `${COMMENT_SELECT} where comments.id = $1`,
    [commentId],
  );
  return result.rows[0] ?? null;
}

export async function findPostAuthorForUnlike(client, postId) {
  const result = await client.query(
    `select id, author_id from posts where id = $1 for update`,
    [postId],
  );
  return result.rows[0] ?? null;
}
