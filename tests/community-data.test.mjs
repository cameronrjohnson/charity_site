import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function setup(result = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ["select", "insert", "delete", "eq", "order", "single", "update"]) {
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  const supabase = {
    from: (table) => {
      calls.push(["from", table]);
      return query;
    },
    rpc: async (...args) => {
      calls.push(["rpc", ...args]);
      return result;
    },
  };
  const context = vm.createContext({});
  const client = new vm.SyntheticModule(["supabase"], function () {
    this.setExport("supabase", supabase);
  }, { context });
  const registry = new vm.SourceTextModule(
    await readFile(new URL("../js/charities.js", import.meta.url), "utf8"), { context },
  );
  await registry.link(() => { throw new Error("Unexpected registry import"); });
  const module = new vm.SourceTextModule(
    await readFile(new URL("../js/community-data.js", import.meta.url), "utf8"), { context },
  );
  await module.link((specifier) => specifier === "./supabase-client.js" ? client : registry);
  await module.evaluate();
  return { api: module.namespace, calls };
}

test("posting trims body and never supplies a user ID", async () => {
  const { api, calls } = await setup();
  await api.postComment("direct-relief", "  A question\n ");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["from", "comments"], ["insert", { charity_id: "direct-relief", body: "A question" }],
  ]);
});

test("blank, overlong and unknown-charity comments never reach the database", async () => {
  const { api, calls } = await setup();
  await assert.rejects(api.postComment("direct-relief", " \t\n"), /1 and 2,000/);
  await assert.rejects(api.postComment("direct-relief", "x".repeat(2001)), /1 and 2,000/);
  await assert.rejects(api.postComment("unknown", "Hello"), /Unknown charity/);
  await assert.rejects(api.postComment("toString", "Hello"), /Unknown charity/);
  assert.equal(calls.length, 0);
});

test("2,000 characters are accepted", async () => {
  const { api, calls } = await setup();
  await api.postComment("donorschoose", "x".repeat(2000));
  assert.equal(calls[1][1].body.length, 2000);
});

test("database errors propagate instead of returning empty success", async () => {
  const failure = { message: "Permission denied" };
  const { api } = await setup({ data: null, error: failure });
  await assert.rejects(api.getFavorites(), (error) => error === failure);
  await assert.rejects(api.getComments("direct-relief"), (error) => error === failure);
  await assert.rejects(api.setFavorite("direct-relief", true), (error) => error === failure);
  await assert.rejects(api.setCommentLiked("comment-1", true), (error) => error === failure);
});

test("comments request a charity-specific page through the privacy-preserving RPC", async () => {
  const { api, calls } = await setup();
  await api.getComments("nature-conservancy", 20);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["rpc", "get_charity_comments", { p_charity: "nature-conservancy", p_offset: 20 }],
  ]);
});

test("likes and favorites insert no forged identity and remove only their target", async () => {
  const { api, calls } = await setup();
  await api.setCommentLiked("comment-1", true);
  await api.setCommentLiked("comment-1", false);
  await api.setFavorite("donorschoose", true);
  await api.setFavorite("donorschoose", false);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["from", "comment_likes"], ["insert", { comment_id: "comment-1" }],
    ["from", "comment_likes"], ["delete"], ["eq", "comment_id", "comment-1"],
    ["from", "favorites"], ["insert", { charity_id: "donorschoose" }],
    ["from", "favorites"], ["delete"], ["eq", "charity_id", "donorschoose"],
  ]);
});

test("deleting a missing or unauthorized comment reports failure", async () => {
  const { api } = await setup();
  await assert.rejects(api.deleteComment("comment-1"), /cannot delete/);
});

test("deleting an owned comment confirms the returned row", async () => {
  const { api, calls } = await setup({ data: [{ id: "comment-1" }], error: null });
  await api.deleteComment("comment-1");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["from", "comments"], ["delete"], ["eq", "id", "comment-1"], ["select", "id"],
  ]);
});

test("profile reads request only the current user's public username", async () => {
  const { api, calls } = await setup({ data: { username: "River" }, error: null });
  assert.equal((await api.getProfile("user-1")).username, "River");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["from", "profiles"], ["select", "username"], ["eq", "user_id", "user-1"], ["single"],
  ]);
});

test("username updates trim whitespace and change only username", async () => {
  const { api, calls } = await setup({ data: { username: "River_2" }, error: null });
  assert.equal((await api.updateUsername("user-1", " River_2 ")).username, "River_2");
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ["from", "profiles"], ["update", { username: "River_2" }],
    ["eq", "user_id", "user-1"], ["select", "username"], ["single"],
  ]);
});

test("username format validation rejects invalid values before querying", async () => {
  const { api, calls } = await setup();
  for (const value of ["", "ab", "a".repeat(41), "two words", "<script>", "name@example.com"]) {
    await assert.rejects(api.updateUsername("user-1", value), /3-40/);
  }
  assert.equal(calls.length, 0);
  await api.updateUsername("user-1", "abc");
  await api.updateUsername("user-1", "a".repeat(40));
});

test("username conflicts have a useful message and other errors propagate", async () => {
  const duplicate = await setup({ data: null, error: { code: "23505", message: "duplicate key" } });
  await assert.rejects(duplicate.api.updateUsername("user-1", "River"), /already taken/);
  const failure = { code: "42501", message: "Permission denied" };
  const { api } = await setup({ data: null, error: failure });
  await assert.rejects(api.getProfile("user-1"), (error) => error === failure);
  await assert.rejects(api.updateUsername("user-1", "River"), (error) => error === failure);
});
