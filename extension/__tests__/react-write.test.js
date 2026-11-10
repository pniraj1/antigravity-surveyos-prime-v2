// React widget writers, driven with plain fake objects (no DOM library).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { reactProps, matchOption, pickDropdown, writeText, clickRadio } = require('../src/lib/react-write.js');

const OPTS = [{ l: 'LMV', v: '1' }, { l: 'MCWG', v: '2' }];

/** A host element whose fiber has `onChange` two levels up. */
function dropdownRoot(props) {
  const top = { memoizedProps: props, return: null };
  const mid = { memoizedProps: { className: 'x' }, return: top };
  return { '__reactFiber$abc': { memoizedProps: { id: 'licenseType' }, return: mid } };
}

describe('react-write', () => {
  it('reactProps finds onChange two fibers up', () => {
    const onChange = () => {};
    expect(reactProps(dropdownRoot({ onChange, options: OPTS })).onChange).toBe(onChange);
    expect(reactProps({})).toBeNull();
  });

  it('matchOption: case-insensitive label, no partial match', () => {
    expect(matchOption(OPTS, 'l', 'v', 'lmv')).toBe(OPTS[0]);
    expect(matchOption(OPTS, 'l', 'v', '2')).toBe(OPTS[1]);
    expect(matchOption(OPTS, 'l', 'v', 'LMV-TR')).toBeNull();
  });

  it('pickDropdown calls onChange with the option value, or reports noOption', () => {
    const calls = [];
    const root = dropdownRoot({ name: 'licenseType', id: 'licenseType', options: OPTS, optionLabel: 'l', optionValue: 'v', onChange: (e) => calls.push(e) });
    expect(pickDropdown(root, 'LMV')).toBe('filled');
    expect(calls).toHaveLength(1);
    expect(calls[0].value).toBe('1');
    expect(calls[0].target).toMatchObject({ name: 'licenseType', value: '1' });
    expect(pickDropdown(root, 'LMV-TR')).toBe('noOption');
    expect(calls).toHaveLength(1);
  });

  it('writeText sets the value, resets the tracker, fires input and change', () => {
    const events = [];
    let tracked;
    const input = { value: 'old', _valueTracker: { setValue: (v) => { tracked = v; } }, dispatchEvent: (e) => events.push(e.type) };
    expect(writeText(input, 'new')).toBe('filled');
    expect(input.value).toBe('new');
    expect(tracked).toBe('old');
    expect(events).toEqual(['input', 'change']);
  });

  it('clickRadio clicks the input', () => {
    let clicked = 0;
    expect(clickRadio({ type: 'radio', click: () => { clicked++; } })).toBe('filled');
    expect(clicked).toBe(1);
  });

  it('clickRadio never clicks anything that is not a radio input', () => {
    let clicked = 0;
    expect(clickRadio({ type: 'submit', click: () => { clicked++; } })).toBe('manual');
    expect(clickRadio({ click: () => { clicked++; } })).toBe('manual');
    expect(clicked).toBe(0);
  });
});
