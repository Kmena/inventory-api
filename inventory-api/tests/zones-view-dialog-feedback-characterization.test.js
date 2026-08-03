const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootPublicPath = path.join(__dirname, '..', 'src', 'public', 'root');

function executeRootScript(relativePath, context) {
  const source = fs.readFileSync(path.join(rootPublicPath, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

class FakeClassList {
  constructor(initialValues = []) {
    this.values = new Set(initialValues);
  }

  add(...classNames) {
    classNames.forEach((className) => this.values.add(className));
  }

  remove(...classNames) {
    classNames.forEach((className) => this.values.delete(className));
  }

  contains(className) {
    return this.values.has(className);
  }
}

class FakeHTMLElement {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.hidden = true;
    this.classList = new FakeClassList(['hidden']);
    this.attributes = new Map();
    this.listeners = new Map();
    this.queryResults = [];
    this.innerHTML = '';
    this.textContent = '';
    this.disabled = false;
    this.focusCount = 0;
  }

  addEventListener(eventName, handler) {
    const handlers = this.listeners.get(eventName) || [];
    handlers.push(handler);
    this.listeners.set(eventName, handlers);
  }

  removeEventListener(eventName, handler) {
    const handlers = this.listeners.get(eventName) || [];
    this.listeners.set(eventName, handlers.filter((candidate) => candidate !== handler));
  }

  dispatchEvent(eventName, event) {
    const handlers = this.listeners.get(eventName) || [];
    handlers.forEach((handler) => handler(event));
  }

  querySelectorAll() {
    return this.queryResults;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.focusCount += 1;
  }
}

class FakeInputElement extends FakeHTMLElement {
  constructor(ownerDocument, value = '') {
    super(ownerDocument);
    this.value = value;
  }
}

class FakeFormElement extends FakeHTMLElement {
  constructor(ownerDocument, resetCallback) {
    super(ownerDocument);
    this.resetCallback = resetCallback;
  }

  reset() {
    if (typeof this.resetCallback === 'function') {
      this.resetCallback();
    }
  }
}

function createHelpersHarness() {
  const browserWindow = {};
  const browserDocument = {
    body: { classList: new FakeClassList() },
    activeElement: null,
  };

  const context = vm.createContext({
    Map,
    window: browserWindow,
  });

  browserWindow.window = browserWindow;
  browserWindow.document = browserDocument;
  browserWindow.HTMLElement = FakeHTMLElement;
  browserWindow.HTMLInputElement = FakeInputElement;

  executeRootScript('registry.js', context);
  browserWindow.RootShell.register('ui', {
    escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    },
    renderInlineMessage(message, tone = 'default') {
      if (!message) {
        return '';
      }

      const className = tone === 'default' ? 'message' : `message ${tone}`;
      return `<p class="${className}" role="status">${this.escapeHtml(message)}</p>`;
    },
  });

  executeRootScript(path.join('views', 'zones-admin.helpers.js'), context);

  return {
    helpers: browserWindow.RootShell.require('views.zonesAdminHelpers'),
    browserDocument,
  };
}

function createFieldMap(browserDocument, initialNameValue = '') {
  return {
    name: {
      input: new FakeInputElement(browserDocument, initialNameValue),
      error: new FakeHTMLElement(browserDocument),
    },
    routeCode: {
      input: new FakeInputElement(browserDocument, 'RC-01'),
      error: new FakeHTMLElement(browserDocument),
    },
  };
}

test('zones dialog helpers open with focus trap and close on escape restoring previous focus', () => {
  const { helpers, browserDocument } = createHelpersHarness();
  const triggerButton = new FakeHTMLElement(browserDocument);
  const firstFocusable = new FakeInputElement(browserDocument);
  const secondFocusable = new FakeHTMLElement(browserDocument);
  const dialogElement = new FakeHTMLElement(browserDocument);
  dialogElement.queryResults = [firstFocusable, secondFocusable];
  browserDocument.activeElement = triggerButton;

  let closeRequests = 0;
  helpers.openDialog(dialogElement, firstFocusable, {
    onRequestClose() {
      closeRequests += 1;
      helpers.closeDialog(dialogElement);
    },
  });

  assert.equal(dialogElement.hidden, false);
  assert.equal(dialogElement.classList.contains('hidden'), false);
  assert.equal(browserDocument.body.classList.contains('root-page--drawer-open'), true);
  assert.equal(browserDocument.activeElement, firstFocusable);

  browserDocument.activeElement = secondFocusable;
  let prevented = false;
  dialogElement.dispatchEvent('keydown', {
    key: 'Tab',
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(browserDocument.activeElement, firstFocusable);

  dialogElement.dispatchEvent('keydown', {
    key: 'Escape',
    preventDefault() {},
  });

  assert.equal(closeRequests, 1);
  assert.equal(dialogElement.hidden, true);
  assert.equal(dialogElement.classList.contains('hidden'), true);
  assert.equal(browserDocument.body.classList.contains('root-page--drawer-open'), false);
  assert.equal(browserDocument.activeElement, triggerButton);
});

test('zones form helpers reset form state and clear stale field errors before reopening', () => {
  const { helpers, browserDocument } = createHelpersHarness();
  const fieldMap = createFieldMap(browserDocument, 'Zona previa');
  const formMessage = new FakeHTMLElement(browserDocument);
  formMessage.innerHTML = '<p class="message error">Error previo</p>';
  fieldMap.name.error.textContent = 'Nombre invalido';
  fieldMap.name.input.setAttribute('aria-invalid', 'true');
  fieldMap.routeCode.error.textContent = 'Codigo invalido';
  fieldMap.routeCode.input.setAttribute('aria-invalid', 'true');

  const formElement = new FakeFormElement(browserDocument, () => {
    fieldMap.name.input.value = '';
    fieldMap.routeCode.input.value = '';
  });

  helpers.resetFormState(formElement, formMessage, fieldMap);

  assert.equal(fieldMap.name.input.value, '');
  assert.equal(fieldMap.routeCode.input.value, '');
  assert.equal(formMessage.innerHTML, '');
  assert.equal(fieldMap.name.error.textContent, '');
  assert.equal(fieldMap.routeCode.error.textContent, '');
  assert.equal(fieldMap.name.input.getAttribute('aria-invalid'), null);
  assert.equal(fieldMap.routeCode.input.getAttribute('aria-invalid'), null);
});

test('zones form helpers keep client validation and backend feedback visible without changing the dialog contract', () => {
  const { helpers, browserDocument } = createHelpersHarness();
  const fieldMap = createFieldMap(browserDocument, ' ');
  const formMessage = new FakeHTMLElement(browserDocument);

  const validationResult = helpers.validateRequiredName(fieldMap, 2);
  assert.equal(validationResult, false);
  assert.match(fieldMap.name.error.textContent, /Ingresa un nombre de al menos 2 caracteres/);
  assert.equal(fieldMap.name.input.getAttribute('aria-invalid'), 'true');
  assert.equal(browserDocument.activeElement, fieldMap.name.input);

  helpers.renderFormError(formMessage, fieldMap, {
    message: 'Ya existe una zona con ese nombre',
    fieldErrors: {
      routeCode: ['Codigo duplicado'],
    },
  }, 'No se pudo crear la zona.');

  assert.match(formMessage.innerHTML, /Ya existe una zona con ese nombre/);
  assert.equal(fieldMap.routeCode.error.textContent, 'Codigo duplicado');
  assert.equal(fieldMap.routeCode.input.getAttribute('aria-invalid'), 'true');
});

test('zones feedback helpers preserve submit button state and toast semantics', () => {
  const { helpers, browserDocument } = createHelpersHarness();
  const submitButton = new FakeHTMLElement(browserDocument);
  submitButton.textContent = 'Guardar zona';

  helpers.setSubmitButtonState(submitButton, {
    isSubmitting: true,
    idleText: 'Guardar zona',
    submittingText: 'Guardando zona...',
  });
  assert.equal(submitButton.disabled, true);
  assert.equal(submitButton.textContent, 'Guardando zona...');

  helpers.setSubmitButtonState(submitButton, {
    isSubmitting: false,
    idleText: 'Guardar zona',
    submittingText: 'Guardando zona...',
  });
  assert.equal(submitButton.disabled, false);
  assert.equal(submitButton.textContent, 'Guardar zona');

  assert.match(helpers.renderToast('Zona creada correctamente.'), /role="status"/);
  assert.match(helpers.renderToast('Zona creada correctamente.'), /Zona creada correctamente\./);
});
