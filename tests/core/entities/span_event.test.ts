import { SpanEvent } from '../../../src/core/entities/span_event';

describe('SpanEvent', () => {
  describe('constructor', () => {
    it('should create a span event with all parameters', () => {
      const timestamp = Date.now() * 1000; // microseconds
      const attributes = {
        'key1': 'value1',
        'key2': 42,
        'key3': true,
        'key4': ['a', 'b', 'c']
      };

      const event = new SpanEvent({
        name: 'test_event',
        timestamp,
        attributes
      });

      expect(event.name).toBe('test_event');
      expect(event.timestamp).toBe(timestamp);
      expect(event.attributes).toEqual(attributes);
    });
  });

  describe('fromException', () => {
    it('should create a span event from a basic error', () => {
      const error = new Error('Test error message');
      const event = SpanEvent.fromException(error);

      expect(event.name).toBe('exception');
      expect(event.attributes['exception.message']).toBe('Test error message');
      expect(event.attributes['exception.type']).toBe('Error');
      expect(event.attributes['exception.stacktrace']).toContain('Test error message');
    });
  });
});