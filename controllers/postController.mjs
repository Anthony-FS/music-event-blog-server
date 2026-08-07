import { sendControllerError } from "../utils/httpError.mjs";
import * as postService from "../services/postService.mjs";

export async function listPosts(req, res) {
  try {
    const result = await postService.listPosts(req.query, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to load articles");
  }
}

export async function getPostComments(req, res) {
  try {
    const result = await postService.getPostComments(req.params.postId, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to load comments");
  }
}

export async function getPost(req, res) {
  try {
    const result = await postService.getPost(req.params.postId, req.user);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to load the article");
  }
}

export async function createPost(req, res) {
  try {
    const result = await postService.createPost(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to create the article");
  }
}

export async function updatePost(req, res) {
  try {
    const result = await postService.updatePost(req.params.postId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to update the article");
  }
}

export async function deletePost(req, res) {
  try {
    await postService.removePost(req.params.postId);
    return res.status(204).send();
  } catch (error) {
    return sendControllerError(res, error, "Unable to delete the article");
  }
}

export async function likePost(req, res) {
  try {
    const result = await postService.likePost(req.params.postId, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to like the article");
  }
}

export async function unlikePost(req, res) {
  try {
    const result = await postService.unlikePost(req.params.postId, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to unlike the article");
  }
}

export async function addComment(req, res) {
  try {
    const result = await postService.addComment(
      req.params.postId,
      req.user.id,
      req.body.message,
    );
    return res.status(201).json(result);
  } catch (error) {
    return sendControllerError(res, error, "Unable to add the comment");
  }
}
