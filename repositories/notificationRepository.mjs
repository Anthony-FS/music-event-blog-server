import connectionPool from "../utils/db.mjs";

export async function findNotificationsByRecipient(recipientId) {
  const result = await connectionPool.query(
    `select
       notifications.id,
       notifications.event_type as type,
       notifications.is_read as "isRead",
       notifications.created_at as "createdAt",
       notifications.post_id as "articleId",
       posts.title as "articleTitle",
       coalesce(
         nullif(trim(actors.name), ''),
         nullif(trim(actors.username), ''),
         'Member'
       ) as "userName",
       actors.avatar_url as "avatarUrl",
       comments.comment_text as comment
     from notifications
     join posts on notifications.post_id = posts.id
     join profiles as actors on notifications.actor_id = actors.id
     left join comments on notifications.comment_id = comments.id
     where notifications.recipient_id = $1
     order by notifications.created_at desc, notifications.id desc
     limit 100`,
    [recipientId],
  );
  return result.rows;
}

export async function countUnreadNotifications(recipientId) {
  const result = await connectionPool.query(
    `select count(*)::int as count
     from notifications
     where recipient_id = $1 and is_read = false`,
    [recipientId],
  );
  return result.rows[0].count;
}

export async function markAllAsRead(recipientId) {
  await connectionPool.query(
    `update notifications
     set is_read = true
     where recipient_id = $1 and is_read = false`,
    [recipientId],
  );
}
