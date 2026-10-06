// Stateful in-memory stand-ins for the repositories, so a whole user journey
// (create → read → like → comment → notify → delete) runs through the real
// app over real HTTP with no database. Reset between tests with resetStore().
const store = {};

export function resetStore() {
  Object.assign(store, {
    seq: { category: 0, post: 0, comment: 0, notification: 0 },
    categories: [],
    posts: [],
    comments: [],
    likes: [],
    notifications: [],
  });
}
resetStore();

const next = (kind) => ++store.seq[kind];
const statuses = { draft: { id: 1 }, publish: { id: 2 } };
const present = (post) => ({
  ...post,
  category: store.categories.find((c) => c.id === post.categoryId)?.name,
  likes: store.likes.filter((l) => l.postId === post.id).length,
});

export const categoryRepository = {
  findAllCategories: async () => [...store.categories],
  findDuplicateCategory: async (name, excludeId = null) =>
    store.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== excludeId,
    ),
  createCategory: async (name) => {
    const category = { id: next("category"), name };
    store.categories.push(category);
    return category;
  },
  updateCategory: async (id, name) => {
    const category = store.categories.find((c) => c.id === id);
    if (category) category.name = name;
    return category;
  },
  countPostsUsingCategory: async (id) =>
    store.posts.filter((p) => p.categoryId === id).length,
  deleteCategory: async (id) => {
    const before = store.categories.length;
    store.categories = store.categories.filter((c) => c.id !== id);
    return store.categories.length < before;
  },
};

export const notificationRepository = {
  findNotificationsByRecipient: async (id) =>
    store.notifications.filter((n) => n.recipientId === id),
  countUnreadNotifications: async (id) =>
    store.notifications.filter((n) => n.recipientId === id && !n.read).length,
  markAllAsRead: async (id) => {
    store.notifications.filter((n) => n.recipientId === id).forEach((n) => (n.read = true));
  },
};

const visible = (values) =>
  store.posts.filter((p) => (values[0] ? p.status === values[0] : true));

export const postRepository = {
  countPosts: async (_where, values) => visible(values).length,
  findPosts: async (_where, values, limit, offset) =>
    visible(values).slice(offset, offset + limit).map(present),
  findPostById: async (id) => {
    const post = store.posts.find((p) => p.id === id);
    return post && present(post);
  },
  findPostStatus: async (id) => store.posts.find((p) => p.id === id),
  findCommentsByPostId: async (id) => store.comments.filter((c) => c.postId === id),
  hasUserLikedPost: async (postId, userId) =>
    store.likes.some((l) => l.postId === postId && l.userId === userId),
  findCategoryById: async (_client, id) => store.categories.some((c) => c.id === id),
  findStatusByName: async (_client, name) => statuses[name],
  insertPost: async (_client, post) => {
    const record = {
      id: next("post"),
      title: post.title,
      image: post.image,
      categoryId: post.categoryId,
      description: post.description,
      content: post.content,
      status: post.status,
      authorId: post.authorId,
    };
    store.posts.push(record);
    return record.id;
  },
  updatePost: async (_client, id, post) => {
    const record = store.posts.find((p) => p.id === id);
    if (record) Object.assign(record, post);
    return Boolean(record);
  },
  deletePost: async (id) => {
    const before = store.posts.length;
    store.posts = store.posts.filter((p) => p.id !== id);
    return store.posts.length < before;
  },
  findPostForLike: async (_client, id) => {
    const post = store.posts.find((p) => p.id === id);
    return post && { author_id: post.authorId };
  },
  findPostAuthorForUnlike: async (_client, id) => {
    const post = store.posts.find((p) => p.id === id);
    return post && { author_id: post.authorId };
  },
  insertLike: async (_client, postId, userId) => {
    if (store.likes.some((l) => l.postId === postId && l.userId === userId)) return false;
    store.likes.push({ postId, userId });
    return true;
  },
  deleteLike: async (_client, postId, userId) => {
    const before = store.likes.length;
    store.likes = store.likes.filter((l) => !(l.postId === postId && l.userId === userId));
    return store.likes.length < before;
  },
  getLikesCount: async (_client, postId) =>
    store.likes.filter((l) => l.postId === postId).length,
  insertLikeNotification: async (_client, recipientId, actorId, postId) => {
    store.notifications.push({
      id: next("notification"), type: "like", recipientId, actorId, postId, read: false,
    });
  },
  deleteLikeNotification: async (_client, recipientId, actorId, postId) => {
    store.notifications = store.notifications.filter(
      (n) =>
        !(n.type === "like" && n.recipientId === recipientId &&
          n.actorId === actorId && n.postId === postId),
    );
  },
  findPublishedPostForComment: async (_client, id) => {
    const post = store.posts.find((p) => p.id === id && p.status === "publish");
    return post && { author_id: post.authorId };
  },
  insertComment: async (_client, postId, userId, message) => {
    const comment = { id: next("comment"), postId, userId, message };
    store.comments.push(comment);
    return comment.id;
  },
  insertCommentNotification: async (_client, recipientId, actorId, postId) => {
    store.notifications.push({
      id: next("notification"), type: "comment", recipientId, actorId, postId, read: false,
    });
  },
  findCommentById: async (id) => store.comments.find((c) => c.id === id),
};
