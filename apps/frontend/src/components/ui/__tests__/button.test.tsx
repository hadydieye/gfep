import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { Button } from '../button';

// Feature: gfep-phase-0-foundations
// Property 1: Button variant color mapping
// Validates: Requirements 8.1, 8.7
describe('Property 1: Button variant color mapping', () => {
  it('should apply the correct GFEP color class for each variant and never use gray/slate', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('primary', 'secondary', 'destructive'),
        (variant) => {
          const { container } = render(
            <Button variant={variant as any}>Test</Button>,
          );
          const button = container.querySelector('button');
          expect(button).not.toBeNull();
          const className = button!.className;

          // No gray-* or slate-* classes should ever appear
          expect(className).not.toMatch(/\bgray-/);
          expect(className).not.toMatch(/\bslate-/);

          // Variant-specific assertions
          if (variant === 'primary') {
            expect(className).toContain('bg-primary');
          }
          if (variant === 'secondary') {
            expect(className).toContain('border');
          }
          if (variant === 'destructive') {
            expect(className).toContain('bg-error');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
