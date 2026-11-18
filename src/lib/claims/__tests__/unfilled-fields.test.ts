// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getUnfilledFields } from '../unfilled-fields';

describe('getUnfilledFields', () => {
  let container: HTMLDivElement;

  function mockVisible<T extends HTMLElement>(el: T): T {
    Object.defineProperty(el, 'offsetParent', {
      configurable: true,
      get: () => document.body,
    });
    el.getBoundingClientRect = () => ({
      width: 100,
      height: 30,
      top: 0,
      left: 0,
      right: 100,
      bottom: 30,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    return el;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('returns empty array when container is null', () => {
    expect(getUnfilledFields(null)).toEqual([]);
  });

  it('detects empty input, textarea, and select fields', () => {
    const textInput = mockVisible(document.createElement('input'));
    textInput.type = 'text';
    textInput.value = '';

    const whitespaceInput = mockVisible(document.createElement('input'));
    whitespaceInput.type = 'text';
    whitespaceInput.value = '   ';

    const textarea = mockVisible(document.createElement('textarea'));
    textarea.value = '';

    const select = mockVisible(document.createElement('select'));
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select an option...';
    select.appendChild(defaultOpt);

    container.appendChild(textInput);
    container.appendChild(whitespaceInput);
    container.appendChild(textarea);
    container.appendChild(select);

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toHaveLength(4);
    expect(unfilled).toContain(textInput);
    expect(unfilled).toContain(whitespaceInput);
    expect(unfilled).toContain(textarea);
    expect(unfilled).toContain(select);
  });

  it('treats select with "Not applicable" option as NOT unfilled', () => {
    const selectNA = mockVisible(document.createElement('select'));
    const optNA = document.createElement('option');
    optNA.value = '';
    optNA.textContent = 'Not applicable';
    selectNA.appendChild(optNA);

    const selectCase = mockVisible(document.createElement('select'));
    const optCase = document.createElement('option');
    optCase.value = '';
    optCase.textContent = 'NOT APPLICABLE';
    selectCase.appendChild(optCase);

    container.appendChild(selectNA);
    container.appendChild(selectCase);

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toEqual([]);
  });

  it('skips filled inputs, textareas, and selects', () => {
    const input = mockVisible(document.createElement('input'));
    input.type = 'text';
    input.value = 'John Surveyor';

    const textarea = mockVisible(document.createElement('textarea'));
    textarea.value = 'Front bumper damaged on LHS.';

    const select = mockVisible(document.createElement('select'));
    const opt = document.createElement('option');
    opt.value = 'commercial';
    opt.textContent = 'Commercial';
    select.appendChild(opt);
    select.value = 'commercial';

    container.appendChild(input);
    container.appendChild(textarea);
    container.appendChild(select);

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toEqual([]);
  });

  it('skips disabled and readonly inputs', () => {
    const disabledInput = mockVisible(document.createElement('input'));
    disabledInput.disabled = true;
    disabledInput.value = '';

    const readonlyInput = mockVisible(document.createElement('input'));
    readonlyInput.readOnly = true;
    readonlyInput.value = '';

    const disabledSelect = mockVisible(document.createElement('select'));
    disabledSelect.disabled = true;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Select...';
    disabledSelect.appendChild(opt);

    const readonlyTextarea = mockVisible(document.createElement('textarea'));
    readonlyTextarea.readOnly = true;
    readonlyTextarea.value = '';

    container.appendChild(disabledInput);
    container.appendChild(readonlyInput);
    container.appendChild(disabledSelect);
    container.appendChild(readonlyTextarea);

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toEqual([]);
  });

  it('skips hidden, file, and button/choice input types', () => {
    const types = ['hidden', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset'];

    types.forEach((t) => {
      const input = mockVisible(document.createElement('input'));
      input.type = t;
      input.value = '';
      container.appendChild(input);
    });

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toEqual([]);
  });

  it('skips invisible elements (offsetParent null, aria-hidden, or 0x0 size)', () => {
    // 1. offsetParent null
    const noOffset = document.createElement('input');
    noOffset.type = 'text';
    noOffset.value = '';
    Object.defineProperty(noOffset, 'offsetParent', { get: () => null });
    noOffset.getBoundingClientRect = () => ({
      width: 100,
      height: 30,
      top: 0,
      left: 0,
      right: 100,
      bottom: 30,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // 2. aria-hidden true
    const ariaHidden = mockVisible(document.createElement('input'));
    ariaHidden.type = 'text';
    ariaHidden.value = '';
    ariaHidden.setAttribute('aria-hidden', 'true');

    // 3. 0x0 bounding rect
    const zeroSize = document.createElement('input');
    zeroSize.type = 'text';
    zeroSize.value = '';
    Object.defineProperty(zeroSize, 'offsetParent', { get: () => document.body });
    zeroSize.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    container.appendChild(noOffset);
    container.appendChild(ariaHidden);
    container.appendChild(zeroSize);

    const unfilled = getUnfilledFields(container);
    expect(unfilled).toEqual([]);
  });
});
