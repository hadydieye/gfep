import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import { Badge } from '../badge';

/** Validates: Requirements 8.5, 8.7 */
describe('Property 3: Badge variant semantic color mapping', () => {
  it('should apply correct GFEP semantic color class and rounded-full for each variant', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('success', 'warning', 'error', 'neutral'),
        (variant) => {
          const { container } = render(
            <Badge variant={variant as any}>Test</Badge>,
          );
          const badge = container.querySelector('span');
          expect(badge).not.toBeNull();
          const className = badge!.className;

          // rounded-full must always be present (pill shape)
          expect(className).toContain('rounded-full');

          // No gray-* or slate-* classes
          expect(className).not.toMatch(/\bgray-/);
          expect(className).not.toMatch(/\bslate-/);

          // Texte toujours en premier plan (AA) ; la sémantique est portée par
          // le fond teinté et la pastille de la couleur du variant
          expect(className).toContain('text-foreground-primary');
          const dot = badge!.querySelector('span[aria-hidden]');
          expect(dot).not.toBeNull();
          if (variant === 'success') {
            expect(className).toContain('bg-success/');
            expect(dot!.className).toContain('bg-success');
          }
          if (variant === 'warning') {
            expect(className).toContain('bg-warning/');
            expect(dot!.className).toContain('bg-warning');
          }
          if (variant === 'error') {
            expect(className).toContain('bg-error/');
            expect(dot!.className).toContain('bg-error');
          }
          if (variant === 'neutral') {
            expect(dot!.className).toContain('bg-foreground-secondary');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
