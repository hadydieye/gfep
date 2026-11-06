import { CSV_BOM, formatDecimalFr, neutralizeFormula, toCsv } from './csv.js';

describe('CSV finance (N5)', () => {
  it('BOM, séparateur point-virgule, CRLF', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.slice(1)).toBe('A;B\r\n1;2\r\n');
  });

  it('guillemets RFC 4180 pour ; " et retours à la ligne', () => {
    const csv = toCsv(['x'], [['a;b'], ['dit "oui"'], ['l1\nl2']]);
    expect(csv.slice(1).split('\r\n')).toEqual(['x', '"a;b"', '"dit ""oui"""', '"l1\nl2"', '']);
  });

  it.each(['=SUM(A1)', '+1', '-2', '@cmd', '\tx', '\rx'])('neutralise une formule : %j', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`);
  });

  it('laisse intact un texte ordinaire et une valeur vide', () => {
    expect(neutralizeFormula('Facture 12')).toBe('Facture 12');
    expect(toCsv(['a'], [[null]]).slice(1)).toBe('a\r\n\r\n');
  });

  it('montants : virgule décimale, aucun flottant', () => {
    expect(formatDecimalFr('1500000.50')).toBe('1500000,50');
    expect(formatDecimalFr('99999999999999.99')).toBe('99999999999999,99');
  });
});
