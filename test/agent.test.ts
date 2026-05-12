import { test } from "node:test";
import assert from "node:assert/strict";
import { AgentBrick } from "../src/agent/AgentBrick";

test("AgentBrick: initial status reflects defaults", () => {
  const agent = new AgentBrick();
  const status = agent.status();

  assert.equal(status.name, "Sovereign Agent");
  assert.equal(typeof status.persona, "string");
  assert.ok(status.persona.length > 0);
  assert.equal(status.hasAvatar, false);
  assert.equal(status.historyLength, 0);
  assert.equal(typeof status.at, "string");
});

test("AgentBrick: configure updates name, persona, and avatar", () => {
  const agent = new AgentBrick();
  agent.configure({ name: "Advisor X", persona: "Strategic advisor.", avatarDataUrl: "data:image/png;base64,abc" });
  const status = agent.status();

  assert.equal(status.name, "Advisor X");
  assert.equal(status.persona, "Strategic advisor.");
  assert.equal(status.hasAvatar, true);
});

test("AgentBrick: communicate records history", () => {
  const agent = new AgentBrick();
  const out = agent.communicate({ message: "hello" });

  assert.equal(typeof out.reply, "string");
  assert.ok(out.reply.length > 0);
  assert.equal(out.historyLength, 2); // user + agent
  assert.equal(agent.history().length, 2);
  assert.equal(agent.history()[0].role, "user");
  assert.equal(agent.history()[1].role, "agent");
});

test("AgentBrick: communicate produces greeting reply", () => {
  const agent = new AgentBrick({ name: "TestBot" });
  const { reply } = agent.communicate({ message: "Hello!" });
  assert.ok(/TestBot/.test(reply), `Expected reply to mention agent name; got: ${reply}`);
});

test("AgentBrick: decide selects option and returns rationale", () => {
  const agent = new AgentBrick();
  const result = agent.decide({
    question: "Which option is best?",
    options: ["Option A with data-driven analysis", "Option B"]
  });

  assert.equal(typeof result.chosen, "string");
  assert.ok(result.chosen.length > 0);
  assert.equal(result.scores.length, 2);
  assert.equal(typeof result.rationale, "string");
  assert.ok(result.rationale.length > 0);
  // All scores should be non-negative numbers
  for (const s of result.scores) {
    assert.ok(s.score >= 0);
  }
});

test("AgentBrick: decide with no options returns empty chosen", () => {
  const agent = new AgentBrick();
  const result = agent.decide({ question: "Q?", options: [] });
  assert.equal(result.chosen, "");
  assert.equal(result.scores.length, 0);
});

test("AgentBrick: advise returns advice, confidence, and steps", () => {
  const agent = new AgentBrick();
  const result = agent.advise({ query: "How should I manage my budget?" });

  assert.equal(typeof result.advice, "string");
  assert.ok(result.advice.length > 0);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.ok(Array.isArray(result.steps));
  assert.ok(result.steps.length >= 3);
});

test("AgentBrick: advise confidence is higher for specific queries", () => {
  const agent = new AgentBrick();
  const vague = agent.advise({ query: "help" });
  const specific = agent.advise({ query: "Provide precise, specific, measurable steps with exact data metrics to optimise this system." });

  assert.ok(specific.confidence >= vague.confidence, `specific (${specific.confidence}) should be >= vague (${vague.confidence})`);
});

test("AgentBrick: history persists across multiple communications", () => {
  const agent = new AgentBrick();
  agent.communicate({ message: "First message" });
  agent.communicate({ message: "Second message" });

  assert.equal(agent.history().length, 4); // 2 users + 2 agents
  assert.equal(agent.status().historyLength, 4);
});
