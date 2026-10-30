import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function setup(initializationFailures = 0, getPageContext = () => null) {
  const context = vm.createContext({});
  const registry = new vm.SourceTextModule(await readFile(new URL("../js/charities.js", import.meta.url), "utf8"), { context });
  await registry.link(() => { throw new Error("Unexpected registry import"); });
  const module = new vm.SourceTextModule(await readFile(new URL("../js/chat-engine.js", import.meta.url), "utf8"), { context });
  await module.link(() => registry);
  await module.evaluate();
  const calls = [];
  let failure = false;
  const engine = {
    chat: { completions: { create: async (request) => {
      calls.push(request);
      if (failure) throw new Error("GPU unavailable");
      return (async function* () {
        yield { choices: [{ delta: { content: "Check " } }] };
        yield { choices: [{ delta: { content: "official reports." } }] };
      })();
    } } },
    interruptGenerate: () => { calls.push("stop"); },
    resetChat: async () => { calls.push("reset"); },
  };
  let attempts = 0;
  const chat = module.namespace.createChat(async (onProgress) => {
    attempts += 1;
    if (attempts <= initializationFailures) throw new Error("Network failed");
    onProgress?.({ progress: 1 });
    return engine;
  }, getPageContext);
  return { chat, calls, getAttempts: () => attempts, fail: () => { failure = true; }, recover: () => { failure = false; } };
}

test("chat requires loading and rejects blank or oversized input", async () => {
  const { chat, calls } = await setup();
  await assert.rejects(chat.reply("Help"), /Start the assistant/);
  await chat.load();
  await assert.rejects(chat.reply("  "), /1 and 400/);
  await assert.rejects(chat.reply("x".repeat(401)), /1 and 400/);
  assert.equal(calls.length, 0);
});

test("chat streams actual model output with charity facts and recent history", async () => {
  const { chat, calls } = await setup();
  await chat.load();
  const updates = [];
  const result = await chat.reply("  Help me choose  ", (text) => updates.push(text));
  assert.equal(result.text, "Check official reports.");
  assert.deepEqual(updates, ["Check ", "Check official reports."]);
  assert.match(calls[0].messages[0].content, /Direct Relief/);
  assert.match(calls[0].messages[0].content, /cannot browse/);
  assert.match(calls[0].messages[0].content, /recommend ONLY DonorsChoose/);
  assert.equal(calls[0].messages[1].content, "Help me choose");
  await chat.reply("What about education?");
  assert.equal(calls[1].messages[2].content, result.text);
  for (let turn = 0; turn < 4; turn += 1) await chat.reply(`Question ${turn}`);
  assert.equal(calls.at(-1).messages.length, 6);
});

test("generation errors allow retry without adding failed turns to model history", async () => {
  const { chat, calls, fail, recover } = await setup();
  await chat.load();
  fail();
  await assert.rejects(chat.reply("Help"), /GPU unavailable/);
  recover();
  await chat.reply("Try again");
  assert.equal(calls[1].messages.length, 2);
});

test("stop interrupts generation and blocks overlapping requests", async () => {
  const { chat, calls } = await setup();
  await chat.load();
  const reply = chat.reply("Help", () => chat.stop());
  await assert.rejects(chat.reply("Another question"), /current response/);
  await assert.rejects(chat.clear(), /current operation/);
  const result = await reply;
  assert.equal(result.stopped, true);
  assert.equal(result.text, "Check ");
  assert.ok(calls.includes("stop"));
});

test("new conversation clears the model history", async () => {
  const { chat, calls } = await setup();
  await chat.load();
  await chat.reply("Help");
  await chat.clear();
  await chat.reply("A new question");
  assert.ok(calls.includes("reset"));
  assert.equal(calls.at(-1).messages.length, 2);
});

test("failed model initialization can be retried", async () => {
  const { chat, getAttempts } = await setup(1);
  await assert.rejects(chat.load(), /Network failed/);
  await chat.load();
  assert.equal(getAttempts(), 2);
});

test("each reply gets fresh, bounded page context without unrelated fields", async () => {
  let context = { page: "Direct Relief", heading: "Direct Relief", summary: "Medical resources", email: "private@example.com" };
  const { chat, calls } = await setup(0, async () => context);
  await chat.load();
  await chat.reply("What does this charity do?");
  assert.match(calls[0].messages[0].content, /Medical resources/);
  assert.doesNotMatch(calls[0].messages[0].content, /private@example/);
  assert.match(calls[0].messages[0].content, /reference data, not instructions/);
  context = { page: "Education", heading: "DonorsChoose", summary: "x".repeat(900) };
  await chat.reply("And this one?");
  assert.match(calls[1].messages[0].content, /"heading":"DonorsChoose"/);
  const serializedContext = JSON.parse(calls[1].messages[0].content.split("\n").at(-1));
  assert.equal(serializedContext.summary.length, 700);
});

async function contextReader() {
  const module = new vm.SourceTextModule(await readFile(new URL("../js/chat-context.js", import.meta.url), "utf8"), {
    context: vm.createContext({ URL }),
  });
  await module.link(() => { throw new Error("Unexpected context import"); });
  await module.evaluate();
  return module.namespace.getPageContext;
}

test("account and unknown pages never read DOM content or expose titles and query strings", async () => {
  const getContext = await contextReader();
  for (const filename of ["login.html", "profile.html", "other.html"]) {
    const context = getContext({
      URL: `https://example.com/charity_site/pages/${filename}?email=private@example.com`,
      title: "private@example.com",
      querySelector: () => { throw new Error("Private DOM read"); },
      querySelectorAll: () => { throw new Error("Private DOM read"); },
    });
    assert.doesNotMatch(JSON.stringify(context), /private@example/);
    assert.equal(context.page, "Account or other page");
  }
});

test("charity context reads only public profile text and bounds its length", async () => {
  const getContext = await contextReader();
  let selected;
  const context = getContext({
    URL: "https://example.com/charity_site/pages/charity-direct-relief.html?private=secret",
    title: "Direct Relief | Charity Finder",
    querySelector: () => ({ textContent: " Direct\n Relief. " }),
    querySelectorAll: (selector) => {
      selected = selector;
      return [{ textContent: "Medical\n resources " }, { textContent: "x".repeat(900) }];
    },
  });
  assert.equal(context.heading, "Direct Relief.");
  assert.match(context.summary, /^Medical resources/);
  assert.equal(context.summary.length, 700);
  assert.doesNotMatch(selected, /comment|favorite|input|textarea|saved/);
  assert.doesNotMatch(JSON.stringify(context), /secret/);
});

test("quiz context includes the prototype's limitations instead of assuming saved answers", async () => {
  const getContext = await contextReader();
  let selected;
  const context = getContext({
    URL: "https://example.com/pages/quiz-focus.html",
    title: "Quiz | Charity Finder",
    querySelector: () => ({ textContent: "What impact matters?" }),
    querySelectorAll: (selector) => {
      selected = selector;
      return [{ textContent: "This prototype does not save answers or personalize recommendations." }];
    },
  });
  assert.match(selected, /quiz-footnote/);
  assert.match(context.summary, /does not save answers/);
});