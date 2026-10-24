import { supabase } from "./supabase-client.js";
import { charities } from "./charities.js";
import {
  getComments, postComment, deleteComment, setCommentLiked, getFavorites, setFavorite,
} from "./community-data.js";

const discussion = document.querySelector("[data-discussion]");
const savedList = document.querySelector("#saved-charities-list");
const status = document.querySelector("#community-status");
const favoriteButtons = Array.from(document.querySelectorAll("[data-favorite]"));
let userId;
let revision = 0;
let busy = false;
let favoritesReady = false;
let favorites = [];
let comments = [];
let hasMore = false;

function message(text, error = false) {
  status.textContent = text;
  status.dataset.state = error ? "error" : "info";
}

function errorText(error) {
  return error instanceof Error || typeof error?.message === "string"
    ? error.message : "The request failed. Please try again.";
}

if (discussion) {
  discussion.innerHTML = `
    <div class="comments-heading"><div><p class="eyebrow">Community discussion</p><h2 id="comments-title">Comments</h2></div></div>
    <p class="comments-notice">Comments are public. Please be respectful and do not share personal information.</p>
    <p id="comments-status" role="status"></p>
    <div id="comments-list"></div>
    <button type="button" id="comments-more" data-community-action hidden>Load more comments</button>
    <button type="button" id="comments-reload" data-community-action>Refresh comments</button>
    <form class="comment-form" id="comment-form">
      <label for="comment-text">Add to the conversation</label>
      <textarea id="comment-text" placeholder="Share a question or reflection..." maxlength="2000" required disabled></textarea>
      <span class="comments-notice">Up to 2,000 characters. <span data-auth-hint><a href="login.html">Sign in</a> to post, like, or save.</span></span>
      <button type="submit" data-community-action disabled>Post comment</button>
    </form>`;
}

const commentsList = document.querySelector("#comments-list");
const commentsStatus = document.querySelector("#comments-status");
const moreButton = document.querySelector("#comments-more");
const commentForm = document.querySelector("#comment-form");
const commentText = document.querySelector("#comment-text");

function actionButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.communityAction = "";
  button.addEventListener("click", handler);
  return button;
}

function updateDisabled() {
  document.querySelectorAll("[data-community-action]").forEach((button) => {
    button.disabled = busy || (!userId && !["comments-more", "comments-reload"].includes(button.id));
  });
  favoriteButtons.forEach((button) => {
    button.disabled = busy || !userId || !favoritesReady;
  });
  if (commentText) commentText.disabled = busy || !userId;
  document.querySelectorAll("[data-auth-hint]").forEach((hint) => {
    hint.hidden = Boolean(userId);
  });
}

function renderFavorites() {
  favoriteButtons.forEach((button) => {
    const saved = favorites.some((favorite) => favorite.charity_id === button.dataset.favorite);
    button.textContent = saved ? "Remove from saved" : "Save charity";
    button.setAttribute("aria-pressed", String(saved));
  });
  if (savedList) {
    savedList.replaceChildren();
    if (!userId || !favoritesReady || favorites.length === 0) {
      const notice = document.createElement("p");
      notice.textContent = !userId ? "Sign in to see your saved charities."
        : !favoritesReady ? "Saved charities could not be loaded. Try again."
          : "No saved charities yet. Browse the directory to save one for later.";
      savedList.append(notice);
    } else {
      const list = document.createElement("ul");
      for (const favorite of favorites) {
        const charity = charities[favorite.charity_id];
        if (!charity) {
          message("A saved charity is not recognized by this version of the site.", true);
          continue;
        }
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = charity.href;
        link.textContent = charity.name;
        const remove = actionButton("Remove", () => runAction(
          () => setFavorite(favorite.charity_id, false), "Charity removed from saved.",
        ));
        remove.setAttribute("aria-label", `Remove ${charity.name} from saved charities`);
        item.append(link, remove);
        list.append(item);
      }
      savedList.append(list);
    }
  }
  updateDisabled();
}

function renderComments() {
  if (!discussion) return;
  commentsList.replaceChildren();
  for (const comment of comments) {
    const article = document.createElement("article");
    article.className = "community-comment";
    const meta = document.createElement("p");
    meta.className = "comment-meta";
    meta.textContent = `${comment.author_username}${comment.is_mine ? " (you)" : ""} `;
    const date = document.createElement("time");
    date.dateTime = comment.created_at;
    date.textContent = new Date(comment.created_at).toLocaleString();
    meta.append(date);
    const body = document.createElement("p");
    body.className = "comment-body";
    body.textContent = comment.body;
    const actions = document.createElement("div");
    actions.className = "comment-actions";
    const like = actionButton(`${comment.liked_by_me ? "Unlike" : "Like"} (${comment.like_count})`,
      () => runAction(() => setCommentLiked(comment.id, !comment.liked_by_me), "Comment like updated."));
    like.setAttribute("aria-pressed", String(comment.liked_by_me));
    actions.append(like);
    if (comment.is_mine) {
      actions.append(actionButton("Delete", () => {
        if (window.confirm("Delete your comment?")) {
          runAction(() => deleteComment(comment.id), "Comment deleted.");
        }
      }));
    }
    article.append(meta, body, actions);
    commentsList.append(article);
  }
  moreButton.hidden = !hasMore;
  updateDisabled();
}

async function loadComments(append, expectedRevision) {
  if (!discussion) return;
  commentsStatus.textContent = "Loading comments...";
  try {
    const rows = await getComments(discussion.dataset.charity, append ? comments.length : 0);
    if (expectedRevision !== revision) return;
    hasMore = rows.length === 20;
    comments = append ? [...comments, ...rows] : rows;
    renderComments();
    commentsStatus.textContent = comments.length ? "" : "No comments yet. Start the conversation.";
  } catch (error) {
    if (expectedRevision === revision) {
      commentsStatus.textContent = `Could not load comments: ${errorText(error)} Use Refresh comments to retry.`;
    }
  }
}

async function refresh(expectedRevision) {
  if (expectedRevision !== revision) return;
  busy = true;
  updateDisabled();
  if (savedList && userId && !favoritesReady) savedList.textContent = "Loading saved charities...";
  await Promise.all([
    loadComments(false, expectedRevision),
    (async () => {
      try {
        const rows = userId ? await getFavorites() : [];
        if (expectedRevision !== revision) return;
        favorites = rows;
        favoritesReady = true;
      } catch (error) {
        if (expectedRevision !== revision) return;
        favorites = [];
        favoritesReady = false;
        message(`Could not load saved charities: ${errorText(error)}`, true);
      }
      renderFavorites();
    })(),
  ]);
  if (expectedRevision !== revision) return;
  busy = false;
  updateDisabled();
}

async function runAction(action, success) {
  if (busy || !userId) return;
  const expectedRevision = revision;
  busy = true;
  message("");
  updateDisabled();
  try {
    await action();
    if (expectedRevision !== revision) return;
    message(success);
    await refresh(expectedRevision);
  } catch (error) {
    if (expectedRevision === revision) message(errorText(error), true);
  } finally {
    if (expectedRevision === revision) {
      busy = false;
      updateDisabled();
    }
  }
}

favoriteButtons.forEach((button) => {
  button.dataset.communityAction = "";
  button.addEventListener("click", () => {
    const charityId = button.dataset.favorite;
    const saved = favorites.some((favorite) => favorite.charity_id === charityId);
    runAction(() => setFavorite(charityId, !saved),
      saved ? "Charity removed from saved." : "Charity saved for later.");
  });
});

commentForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = commentText.value;
  const expectedRevision = revision;
  runAction(async () => {
    await postComment(discussion.dataset.charity, body);
    if (expectedRevision === revision) commentText.value = "";
  }, "Comment posted.");
});

moreButton?.addEventListener("click", async () => {
  if (busy) return;
  const expectedRevision = revision;
  busy = true;
  updateDisabled();
  await loadComments(true, expectedRevision);
  if (expectedRevision === revision) {
    busy = false;
    updateDisabled();
  }
});

document.querySelector("#comments-reload")?.addEventListener("click", () => refresh(revision));
document.querySelector("#favorites-reload")?.addEventListener("click", () => refresh(revision));

function sessionChanged(session) {
  const nextUserId = session?.user.id ?? null;
  if (nextUserId === userId) return;
  userId = nextUserId;
  revision += 1;
  favorites = [];
  favoritesReady = false;
  comments = [];
  hasMore = false;
  if (commentText) commentText.value = "";
  message("");
  renderFavorites();
  renderComments();
  if (savedList && userId) savedList.textContent = "Loading saved charities...";
  const expectedRevision = revision;
  setTimeout(() => refresh(expectedRevision), 0);
}

supabase.auth.onAuthStateChange((_event, session) => sessionChanged(session));
try {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  sessionChanged(data.session);
} catch (error) {
  message(`Could not check your sign-in status: ${errorText(error)}`, true);
  updateDisabled();
}
