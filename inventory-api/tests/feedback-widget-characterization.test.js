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

/**
 * Minimal DOM element mock that supports common methods used by the widget.
 */
function createMockElement(tag = 'div') {
  const el = {
    _tag: tag,
    id: '',
    type: '',
    textContent: '',
    innerHTML: '',
    style: { cssText: '' },
    _attrs: {},
    _children: [],
    _listeners: {},
    parentNode: null,
    setAttribute(name, value) { this._attrs[name] = value; },
    getAttribute(name) { return this._attrs[name] ?? null; },
    addEventListener(event, fn) {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(fn);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentNode = this;
        this._children.push(child);
      }
    },
    removeChild(child) {
      this._children = this._children.filter((c) => c !== child);
      if (child) child.parentNode = null;
    },
  };
  return el;
}

/**
 * Creates a browser context with a minimal DOM mock sufficient for the widget.
 */
function createWidgetContext() {
  const appendedToBody = [];
  const sessionStorageData = {};
  const documentListeners = {};
  const createdElements = [];

  const mockBody = {
    _children: appendedToBody,
    appendChild(el) {
      appendedToBody.push(el);
      if (el && typeof el === 'object') el.parentNode = mockBody;
    },
    removeChild(el) {
      const idx = appendedToBody.indexOf(el);
      if (idx !== -1) appendedToBody.splice(idx, 1);
    },
  };

  const mockDocument = {
    _elementsById: {},
    body: mockBody,
    createElement(tag) {
      const el = createMockElement(tag);
      createdElements.push(el);
      return el;
    },
    getElementById(id) {
      return appendedToBody.find((el) => el && el.id === id) || null;
    },
    addEventListener(event, fn) {
      documentListeners[event] = documentListeners[event] || [];
      documentListeners[event].push(fn);
    },
    removeEventListener() {},
  };

  const mockSessionStorage = {
    _data: sessionStorageData,
    getItem(key) { return sessionStorageData[key] !== undefined ? sessionStorageData[key] : null; },
    setItem(key, value) { sessionStorageData[key] = value; },
    removeItem(key) { delete sessionStorageData[key]; },
  };

  const browserWindow = {};
  const context = vm.createContext({ Map, window: browserWindow });
  browserWindow.window = browserWindow;
  browserWindow.document = mockDocument;
  browserWindow.sessionStorage = mockSessionStorage;
  browserWindow.setTimeout = (_fn, _ms) => 0; // do not auto-execute — allows asserting toast presence
  browserWindow.clearTimeout = () => {};
  browserWindow.location = { hash: '#test-route' };
  browserWindow.HTMLElement = class HTMLElement {};

  return {
    browserWindow,
    context,
    appendedToBody,
    sessionStorageData,
    documentListeners,
    createdElements,
    mockBody,
    mockDocument,
    mockSessionStorage,
  };
}

function buildFeedbackWidget() {
  const mocks = createWidgetContext();
  const { browserWindow, context } = mocks;

  executeRootScript('registry.js', context);

  browserWindow.RootShell.register('feedbackApi', {
    submitFeedback: async () => ({ id: 1 }),
    listFeedback: async () => [],
    resolveFeedback: async () => ({}),
  });

  executeRootScript('feedback-widget.js', context);

  const widget = browserWindow.RootShell.require('feedbackWidget');
  return { widget, ...mocks };
}

// ── Registration ───────────────────────────────────────────────────────────────

test('feedbackWidget registers correctly with init and triggerNudge functions', () => {
  const { widget } = buildFeedbackWidget();
  assert.equal(typeof widget.init, 'function');
  assert.equal(typeof widget.triggerNudge, 'function');
});

// ── init() — floating button ───────────────────────────────────────────────────

test('init() appends a floating button with id feedback-float-btn to document.body', () => {
  const { widget, appendedToBody } = buildFeedbackWidget();
  widget.init({ token: 'test-session' });
  const floatBtn = appendedToBody.find((el) => el && el.id === 'feedback-float-btn');
  assert.ok(floatBtn, 'feedback-float-btn should be appended to document.body');
});

test('init() is idempotent — calling twice does not add a second button', () => {
  const { widget, appendedToBody } = buildFeedbackWidget();
  widget.init({ token: 'session-1' });
  widget.init({ token: 'session-2' });
  const buttons = appendedToBody.filter((el) => el && el.id === 'feedback-float-btn');
  assert.equal(buttons.length, 1, 'Only one floating button should be added');
});

// ── triggerNudge() — session guard ────────────────────────────────────────────

test('triggerNudge() appends a toast element to document.body on first call', () => {
  const { widget, appendedToBody } = buildFeedbackWidget();
  widget.triggerNudge('rfq', { token: 'test' });
  const toast = appendedToBody.find((el) => el && el.id === 'feedback-toast-rfq');
  assert.ok(toast, 'feedback-toast-rfq should be appended to body');
});

test('triggerNudge() sets sessionStorage key on first call', () => {
  const { widget, sessionStorageData } = buildFeedbackWidget();
  widget.triggerNudge('billing', { token: 'test' });
  assert.equal(sessionStorageData['fbnudge-billing'], '1', 'sessionStorage key should be set');
});

test('triggerNudge() does NOT create a second toast for same context (session guard)', () => {
  const { widget, appendedToBody, sessionStorageData } = buildFeedbackWidget();

  widget.triggerNudge('produccion', { token: 'test' });
  const countAfterFirst = appendedToBody.filter((el) => el && el.id === 'feedback-toast-produccion').length;

  widget.triggerNudge('produccion', { token: 'test' });
  const countAfterSecond = appendedToBody.filter((el) => el && el.id === 'feedback-toast-produccion').length;

  assert.equal(countAfterFirst, 1, 'First nudge should create one toast');
  assert.equal(countAfterSecond, 1, 'Second nudge for same context must be suppressed by session guard');
  assert.equal(sessionStorageData['fbnudge-produccion'], '1');
});

test('triggerNudge() creates separate toasts for different contexts', () => {
  const { widget, appendedToBody } = buildFeedbackWidget();

  widget.triggerNudge('recibo', { token: 'test' });
  widget.triggerNudge('cliente', { token: 'test' });

  const reciboToast = appendedToBody.find((el) => el && el.id === 'feedback-toast-recibo');
  const clienteToast = appendedToBody.find((el) => el && el.id === 'feedback-toast-cliente');

  assert.ok(reciboToast, 'recibo toast should be created');
  assert.ok(clienteToast, 'cliente toast should be created');
});

// ── Source-level contract ──────────────────────────────────────────────────────

test('feedback-widget.js registers feedbackWidget (not a different name)', () => {
  const source = readRootFile('feedback-widget.js');
  assert.match(source, /rootShell\.register\(\s*['"]feedbackWidget['"]/);
});

test('feedback-widget.js uses sessionStorage for nudge guard (DEC-006)', () => {
  const source = readRootFile('feedback-widget.js');
  assert.match(source, /sessionStorage\.getItem/);
  assert.match(source, /sessionStorage\.setItem/);
});

test('feedback-widget.js defines TOAST_TIMEOUT_MS constant', () => {
  const source = readRootFile('feedback-widget.js');
  assert.match(source, /TOAST_TIMEOUT_MS/);
});

test('feedback-widget.js modal uses role="dialog" and aria-modal="true"', () => {
  const source = readRootFile('feedback-widget.js');
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
});

test('feedback-widget.js has data-rating attributes for 5 rating buttons', () => {
  const source = readRootFile('feedback-widget.js');
  [1, 2, 3, 4, 5].forEach((r) => {
    assert.match(source, new RegExp(`data-rating="${r}"`), `Missing data-rating="${r}" button`);
  });
});
