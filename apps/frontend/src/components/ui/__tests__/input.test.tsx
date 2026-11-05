import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { Input } from '../input';

describe('Property 2: Input label and error positioning', () => {
  it('should always place label before input and error after input with text-error class', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (label, error) => {
          const { container } = render(<Input label={label} error={error} />);
          const wrapper = container.firstChild as HTMLElement;

          // Get child elements (label, input, error p)
          const children = Array.from(wrapper.children);

          // There should be 3 children: label, input, error message
          expect(children).toHaveLength(3);

          // First child must be a label
          expect(children[0].tagName).toBe('LABEL');
          expect(children[0].textContent).toBe(label);

          // Second child must be an input
          expect(children[1].tagName).toBe('INPUT');

          // Third child must be a paragraph (error message) with text-error class
          expect(children[2].tagName).toBe('P');
          expect(children[2].getAttribute('role')).toBe('alert');
          expect(children[2].className).toContain('text-error');
          expect(children[2].textContent).toBe(error);
        },
      ),
      { numRuns: 100 },
    );
  });
});
