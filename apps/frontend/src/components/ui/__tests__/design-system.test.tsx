import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import DesignSystemPage from '@/app/design-system/page';

const GFEP_PALETTE = [
  { name: 'Primary', light: '#0F4C3A', dark: '#1A6B52' },
  { name: 'Secondary', light: '#C9A227', dark: '#D4AF37' },
  { name: 'Background Main', light: '#FAFAF8', dark: '#0D0F0E' },
  { name: 'Background Surface', light: '#FFFFFF', dark: '#16181A' },
  { name: 'Text Primary', light: '#111418', dark: '#F2F3F2' },
  { name: 'Text Secondary', light: '#5C6168', dark: '#9AA0A6' },
  { name: 'Border', light: '#E4E6E8', dark: '#2A2D30' },
  { name: 'Success', light: '#1B8A5A', dark: '#2FA873' },
  { name: 'Warning', light: '#B8860B', dark: '#D4A017' },
  { name: 'Error', light: '#C0392B', dark: '#E05A4A' },
];

// Feature: gfep-phase-0-foundations
// Property 4: Design System page palette completeness
/** Validates: Requirements 9.3, 9.4 */
describe('Property 4: Design System page palette completeness', () => {
  it('should display the semantic name, light hex, and dark hex for each GFEP palette token', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GFEP_PALETTE),
        (token) => {
          const { container } = render(<DesignSystemPage />);
          const text = container.textContent || '';

          // The semantic name must appear in the rendered output
          expect(text).toContain(token.name);

          // The light mode hex value must appear
          expect(text).toContain(token.light);

          // The dark mode hex value must appear
          expect(text).toContain(token.dark);
        },
      ),
      { numRuns: 100 },
    );
  });
});
