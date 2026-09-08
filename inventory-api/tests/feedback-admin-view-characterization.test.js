'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function readRootFile(relativePath) {
  return fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
}

function executeRootScript(relativePath, context) {
  const source = readRootFile(relativePath);
  vm.runInContext(source, context, { filename: relativePath });
}

function createBrowserContext() {
  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow, HTMLElement: class HTMLElement {} });
  browserWindow.window = browserWindow;
  browserWindow.HTMLElement = class HTMLElement {};
  return { browserWindow, context };
}

function buildFeedbackAdminView() {
  const { browserWindow, context } = createBrowserContext();

  executeRootScript('registry.js', context);
  executeRootScript('ui.js', context);

  browserWindow.RootShell.register('feedbackApi', {
    listFeedback: async () => [],
    resolveFeedback: async () => ({}),
    submitFeedback: async () => ({}),
  });

  executeRootScript('views/feedback-admin.js', context);

  const view = browserWindow.RootShell.require('views.feedbackAdmin');
  return { view, browserWindow, context };
}

// ── Registration ───────────────────────────────────────────────────────────────

test('views.feedbackAdmin registers correctly with render and mount functions', () => {
  const { view } = buildFeedbackAdminView();
  assert.equal(typeof view.render, 'function');
  assert.equal(typeof view.mount, 'function');
});

// ── render() HTML structure ────────────────────────────────────────────────────

test('render() returns HTML containing feedback-filter select element', () => {
  const { view } = buildFeedbackAdminView();
  const html = view.render({});
  assert.ok(html.includes('feedback-filter'), 'HTML should include feedback-filter id');
});

test('render() returns HTML containing feedback-list-region div', () => {
  const { view } = buildFeedbackAdminView();
  const html = view.render({});
  assert.ok(html.includes('feedback-list-region'), 'HTML should include feedback-list-region id');
});

test('render() returns HTML containing feedback-page-message div', () => {
  const { view } = buildFeedbackAdminView();
  const html = view.render({});
  assert.ok(html.includes('feedback-page-message'), 'HTML should include feedback-page-message id');
});

test('render() returns HTML with title text "Feedback"', () => {
  const { view } = buildFeedbackAdminView();
  const html = view.render({});
  assert.ok(html.includes('Feedback'), 'HTML should include title Feedback');
});

test('render() includes filter options: Todos, Pendientes, Resueltos', () => {
  const { view } = buildFeedbackAdminView();
  const html = view.render({});
  assert.ok(html.includes('Todos'), 'HTML should include Todos option');
  assert.ok(html.includes('Pendientes'), 'HTML should include Pendientes option');
  assert.ok(html.includes('Resueltos'), 'HTML should include Resueltos option');
});

// ── Admin view source contract ─────────────────────────────────────────────────

test('feedback-admin.js uses ui.escapeHtml for user content (security contract)', () => {
  const source = readRootFile('views/feedback-admin.js');
  assert.match(source, /ui\.escapeHtml\(/, 'View must use ui.escapeHtml for output escaping');
});

test('feedback-admin.js registers views.feedbackAdmin (not a different name)', () => {
  const source = readRootFile('views/feedback-admin.js');
  assert.match(source, /rootShell\.register\(\s*['"]views\.feedbackAdmin['"]/);
});

test('feedback-admin.js uses data-resolve-feedback-id attribute for resolve button', () => {
  const source = readRootFile('views/feedback-admin.js');
  assert.match(source, /data-resolve-feedback-id/);
});

test('feedback-admin.js calls feedbackApi.listFeedback in mount', () => {
  const source = readRootFile('views/feedback-admin.js');
  assert.match(source, /feedbackApi\.listFeedback/);
});

test('feedback-admin.js calls feedbackApi.resolveFeedback on resolve button click', () => {
  const source = readRootFile('views/feedback-admin.js');
  assert.match(source, /feedbackApi\.resolveFeedback/);
});
