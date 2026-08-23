/**
 * Warehouse SPA — Device capability detection and reusable capture components.
 *
 * Implements:
 *  - Capabilities.supportsCamera — whether MediaDevices.getUserMedia is available.
 *  - createScanInput(options) — unified barcode scan-or-type input component.
 *  - createPhotoCapture(options) — photo evidence capture component.
 *
 * Design notes (per UX spec / FR-037, AC-018–AC-022):
 *  - USB/BT scanners work via keyboard emulation (Enter terminates a scan sequence).
 *  - Camera capture uses <input capture="environment"> for simplicity and broad compatibility.
 *  - BarcodeDetector is used as progressive enhancement if available (Chrome 83+).
 *  - All fallbacks degrade to manual text entry.
 *  - ObjectURLs created by photo capture must be revoked when thumbnails are removed.
 */
(() => {
const WarehouseShell = /** @type {any} */ (window).WarehouseShell;

// -----------------------------------------------------------------------
// Capability detection
// -----------------------------------------------------------------------

const Capabilities = {
  supportsCamera: !!(
    typeof navigator !== 'undefined'
    && navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function'
  ),
  supportsBarcodeDetector: typeof /** @type {any} */ (window).BarcodeDetector !== 'undefined',
};

// -----------------------------------------------------------------------
// createScanInput
// -----------------------------------------------------------------------

/**
 * Creates a unified scan-or-type input element.
 *
 * @param {{ label: string, placeholder?: string, hint?: string, onValue: (value: string) => void }} options
 * @returns {HTMLElement}
 */
function createScanInput({ label, placeholder = 'Escanear o escribir...', hint, onValue }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'scan-input-wrapper';

  const labelEl = document.createElement('label');
  labelEl.className = 'scan-input__label';
  labelEl.textContent = label;

  const rowEl = document.createElement('div');
  rowEl.className = 'scan-input__row';

  const inputId = `scan-input-${Math.random().toString(36).slice(2, 8)}`;
  labelEl.setAttribute('for', inputId);

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.id = inputId;
  inputEl.className = 'scan-input__field';
  inputEl.placeholder = placeholder;
  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('autocorrect', 'off');
  inputEl.setAttribute('spellcheck', 'false');
  inputEl.setAttribute('inputmode', 'text');

  inputEl.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      const value = inputEl.value.trim();
      if (value) {
        onValue(value);
        inputEl.value = '';
      }
    }
  });

  rowEl.append(inputEl);

  // Camera button — only shown if device supports camera
  if (Capabilities.supportsCamera) {
    const cameraBtn = document.createElement('button');
    cameraBtn.type = 'button';
    cameraBtn.className = 'scan-input__camera-btn';
    cameraBtn.setAttribute('aria-label', 'Capturar con camara');
    cameraBtn.textContent = '📷';

    // Hidden file input for camera capture
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.setAttribute('capture', 'environment');
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) { return; }

      // Progressive enhancement: try BarcodeDetector if available
      if (Capabilities.supportsBarcodeDetector) {
        const url = URL.createObjectURL(file);
        const img = /** @type {HTMLImageElement} */ (document.createElement('img'));
        img.onload = async () => {
          try {
            const BarcodeDetectorClass = /** @type {any} */ (window).BarcodeDetector;
            const detector = new BarcodeDetectorClass({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'] });
            const barcodes = await detector.detect(img);
            URL.revokeObjectURL(url);
            if (barcodes.length > 0) {
              onValue(barcodes[0].rawValue);
            } else {
              // No barcode detected — prompt manual entry
              inputEl.focus();
            }
          } catch (_err) {
            URL.revokeObjectURL(url);
            inputEl.focus();
          }
        };
        img.src = url;
      } else {
        // No BarcodeDetector — fall back to manual entry
        inputEl.focus();
      }

      // Reset file input for reuse
      fileInput.value = '';
    });

    cameraBtn.addEventListener('click', () => { fileInput.click(); });
    rowEl.append(cameraBtn, fileInput);
  }

  wrapper.append(labelEl, rowEl);

  if (hint) {
    const hintEl = document.createElement('p');
    hintEl.className = 'scan-input__hint';
    hintEl.textContent = hint;
    wrapper.append(hintEl);
  } else {
    const defaultHintEl = document.createElement('p');
    defaultHintEl.className = 'scan-input__hint';
    defaultHintEl.textContent = 'Los scanners USB/Bluetooth funcionan automaticamente.';
    wrapper.append(defaultHintEl);
  }

  /** Focus the underlying input for scanner auto-capture. */
  wrapper.focus = () => inputEl.focus();

  return wrapper;
}

// -----------------------------------------------------------------------
// createPhotoCapture
// -----------------------------------------------------------------------

/**
 * Creates a photo evidence capture component.
 *
 * @param {{ label?: string, multiple?: boolean, onFilesChanged: (files: File[]) => void }} options
 * @returns {HTMLElement & { destroy: () => void }}
 */
function createPhotoCapture({ label = 'Evidencia fotografica (opcional)', multiple = true, onFilesChanged }) {
  const files = /** @type {File[]} */ ([]);
  const objectUrls = /** @type {string[]} */ ([]);

  const wrapper = document.createElement('div');
  wrapper.className = 'photo-capture-wrapper';

  const labelEl = document.createElement('p');
  labelEl.className = 'photo-capture__label';
  labelEl.textContent = label;

  const zone = document.createElement('div');
  zone.className = 'photo-capture__zone';
  zone.setAttribute('role', 'button');
  zone.setAttribute('tabindex', '0');
  zone.setAttribute('aria-label', 'Tomar foto o subir imagen');

  const zoneIcon = document.createElement('span');
  zoneIcon.setAttribute('aria-hidden', 'true');
  zoneIcon.textContent = '📷';

  const zoneText = document.createElement('span');
  zoneText.textContent = 'Tomar foto o subir desde galeria';

  zone.append(zoneIcon, zoneText);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.setAttribute('capture', 'environment');
  if (multiple) { fileInput.multiple = true; }
  fileInput.style.display = 'none';

  const thumbnailsEl = document.createElement('div');
  thumbnailsEl.className = 'photo-capture__thumbnails';

  function addFile(file) {
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    files.push(file);

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'photo-capture__thumb';

    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    img.className = 'photo-capture__thumb-img';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'photo-capture__thumb-remove';
    removeBtn.setAttribute('aria-label', `Eliminar ${file.name}`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      const idx = files.indexOf(file);
      if (idx >= 0) {
        files.splice(idx, 1);
        URL.revokeObjectURL(url);
        objectUrls.splice(objectUrls.indexOf(url), 1);
      }
      thumbWrapper.remove();
      onFilesChanged([...files]);
    });

    thumbWrapper.append(img, removeBtn);
    thumbnailsEl.append(thumbWrapper);
    onFilesChanged([...files]);
  }

  fileInput.addEventListener('change', () => {
    if (!fileInput.files) { return; }
    for (const file of Array.from(fileInput.files)) {
      addFile(file);
    }
    fileInput.value = '';
  });

  zone.addEventListener('click', () => { fileInput.click(); });
  zone.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' || evt.key === ' ') {
      evt.preventDefault();
      fileInput.click();
    }
  });

  wrapper.append(labelEl, zone, fileInput, thumbnailsEl);

  /** Revoke all created ObjectURLs to prevent memory leaks. */
  function destroy() {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
    objectUrls.length = 0;
    files.length = 0;
  }

  /** @type {any} */ (wrapper).destroy = destroy;
  return /** @type {any} */ (wrapper);
}

// -----------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------

WarehouseShell.register('captures', { Capabilities, createScanInput, createPhotoCapture });
})();
