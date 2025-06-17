import type { LiveSpan } from '../../../src/core/entities/span';
import { deduplicateSpanNamesInPlace } from '../../../src/core/utils';
import { createTestSpan } from '../../helpers/span-helpers';

describe('deduplicateSpanNamesInPlace', () => {
  it('should deduplicate spans with duplicate names', () => {
    const spans = [createTestSpan('red'), createTestSpan('red')];

    deduplicateSpanNamesInPlace(spans);

    expect(spans[0].name).toBe('red_1');
    expect(spans[1].name).toBe('red_2');
  });

  it('should deduplicate only duplicate names, leaving unique names unchanged', () => {
    const spans = [createTestSpan('red'), createTestSpan('red'), createTestSpan('blue')];

    deduplicateSpanNamesInPlace(spans);

    expect(spans[0].name).toBe('red_1');
    expect(spans[1].name).toBe('red_2');
    expect(spans[2].name).toBe('blue');
  });

  it('should handle multiple sets of duplicates', () => {
    const spans = [
      createTestSpan('red'),
      createTestSpan('blue'),
      createTestSpan('red'),
      createTestSpan('green'),
      createTestSpan('blue'),
      createTestSpan('red')
    ];
    deduplicateSpanNamesInPlace(spans);

    expect(spans[0].name).toBe('red_1');
    expect(spans[1].name).toBe('blue_1');
    expect(spans[2].name).toBe('red_2');
    expect(spans[3].name).toBe('green');
    expect(spans[4].name).toBe('blue_2');
    expect(spans[5].name).toBe('red_3');
  });

  it('should handle spans with no duplicates', () => {
    const spans = [createTestSpan('red'), createTestSpan('blue'), createTestSpan('green')];

    deduplicateSpanNamesInPlace(spans);

    expect(spans[0].name).toBe('red');
    expect(spans[1].name).toBe('blue');
    expect(spans[2].name).toBe('green');
  });

  it('should handle empty array', () => {
    const spans: LiveSpan[] = [];

    expect(() => deduplicateSpanNamesInPlace(spans)).not.toThrow();
    expect(spans.length).toBe(0);
  });
});
