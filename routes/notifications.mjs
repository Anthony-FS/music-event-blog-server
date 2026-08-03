import { Router } from "express";

import protectUser from "../middlewares/protectUser.mjs";
import connectionPool from "../utils/db.mjs";

const notificationsRouter = Router();

notificationsRouter.use(protectUser);

notificationsRouter.get("/", async (req, res) => {
  try {
    const [notificationsResult, unreadResult] = await Promise.all([
      connectionPool.query(
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
        [req.user.id],
      ),
      connectionPool.query(
        `select count(*)::int as count
         from notifications
         where recipient_id = $1 and is_read = false`,
        [req.user.id],
      ),
    ]);

    return res.status(200).json({
      notifications: notificationsResult.rows,
      unreadCount: unreadResult.rows[0].count,
    });
  } catch {
    return res.status(500).json({ message: "Unable to load notifications" });
  }
});

notificationsRouter.patch("/read", async (req, res) => {
  try {
    await connectionPool.query(
      `update notifications
       set is_read = true
       where recipient_id = $1 and is_read = false`,
      [req.user.id],
    );

    return res.status(200).json({ unreadCount: 0 });
  } catch {
    return res.status(500).json({ message: "Unable to update notifications" });
  }
});

export default notificationsRouter;
