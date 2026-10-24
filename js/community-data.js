import { supabase } from "./supabase-client.js";
import { charities } from "./charities.js";

function requireCharity(charityId) {
  if (!Object.hasOwn(charities, charityId)) throw new Error("Unknown charity.");
}

function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function getComments(charityId, offset = 0) {
  requireCharity(charityId);
  return check(await supabase.rpc("get_charity_comments", {
    p_charity: charityId,
    p_offset: offset,
  }));
}

export async function postComment(charityId, body) {
  requireCharity(charityId);
  const trimmedBody = body.trim();
  if (!trimmedBody || [...trimmedBody].length > 2000) {
    throw new Error("Comments must contain between 1 and 2,000 characters.");
  }
  check(await supabase.from("comments").insert({ charity_id: charityId, body: trimmedBody }));
}

export async function deleteComment(id) {
  const rows = check(await supabase.from("comments").delete().eq("id", id).select("id"));
  if (rows.length !== 1) throw new Error("This comment was removed or you cannot delete it. Refresh the comments.");
}

export async function setCommentLiked(commentId, liked) {
  if (liked) {
    check(await supabase.from("comment_likes").insert({ comment_id: commentId }));
  } else {
    check(await supabase.from("comment_likes").delete().eq("comment_id", commentId));
  }
}

export async function getFavorites() {
  return check(await supabase.from("favorites").select("charity_id, created_at")
    .order("created_at", { ascending: false }));
}

export async function setFavorite(charityId, saved) {
  requireCharity(charityId);
  if (saved) {
    check(await supabase.from("favorites").insert({ charity_id: charityId }));
  } else {
    check(await supabase.from("favorites").delete().eq("charity_id", charityId));
  }
}
