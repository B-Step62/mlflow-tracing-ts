# MLflow Assessment Entities - TypeScript Implementation

This module provides TypeScript implementations of the MLflow assessment entities, including `Expectation` and `Feedback` classes, based on the Python source code from the `mlflow.entities.assessment` module.

## Overview

The assessment entities are used for annotating traces in MLflow with two types of assessments:

- **Expectations**: Labels that represent expected values for particular operations (e.g., ground truth answers)
- **Feedback**: Labels that represent feedback on the quality of operations (e.g., human judgments, LLM-as-a-Judge scores)

## Classes

### `Expectation`

Represents an expectation about the output of an operation, such as the expected response that a generative AI application should provide to a particular user query.

```typescript
import { Expectation } from './assessment';

// Simple value expectation
const expectation = new Expectation(42);

// String expectation
const textExpectation = new Expectation('The correct answer is 42');

// Complex object expectation
const complexExpectation = new Expectation({
  answer: 'correct',
  confidence: 0.95,
  category: 'factual'
});

// Array expectation
const arrayExpectation = new Expectation([1, 2, 3, 'correct']);
```

### `Feedback`

Represents feedback about the output of an operation, with optional error handling for cases where feedback generation fails.

```typescript
import { Feedback, AssessmentError } from './assessment';

// Simple feedback
const feedback = new Feedback(0.9);

// Feedback with string value
const textFeedback = new Feedback('excellent');

// Feedback with error (when generation fails)
const error: AssessmentError = {
  errorCode: 'RATE_LIMIT_EXCEEDED',
  errorMessage: 'Rate limit for the judge exceeded.'
};
const errorFeedback = new Feedback('failed', error);
```

### `Assessment`

The main class that wraps either an expectation or feedback with metadata and trace information.

```typescript
import { Assessment, AssessmentSourceType } from './assessment';

// Assessment with expectation
const expectationAssessment = new Assessment({
  name: 'expected_answer',
  source: {
    sourceType: AssessmentSourceType.HUMAN,
    sourceId: 'user123'
  },
  traceId: 'trace_123',
  expectation: new Expectation('The answer is 42'),
  metadata: { source: 'ground_truth' }
});

// Assessment with feedback
const feedbackAssessment = new Assessment({
  name: 'faithfulness',
  source: {
    sourceType: AssessmentSourceType.LLM_JUDGE,
    sourceId: 'gpt-4'
  },
  traceId: 'trace_456',
  feedback: new Feedback(0.85),
  rationale: 'The response is highly faithful to the input',
  metadata: { model: 'gpt-4o-mini' }
});
```

## Utility Functions

### `AssessmentUtils`

Provides convenient factory methods for creating assessments:

```typescript
import { AssessmentUtils, AssessmentSourceType } from './assessment';

// Create expectation assessment
const expectationAssessment = AssessmentUtils.createExpectation({
  name: 'expected_answer',
  source: {
    sourceType: AssessmentSourceType.HUMAN,
    sourceId: 'annotator_1'
  },
  value: 'The correct answer is 42',
  traceId: 'trace_123',
  metadata: { dataset: 'qa_test' }
});

// Create feedback assessment
const feedbackAssessment = AssessmentUtils.createFeedback({
  name: 'quality_score',
  source: {
    sourceType: AssessmentSourceType.LLM_JUDGE,
    sourceId: 'gpt-4'
  },
  value: 0.92,
  traceId: 'trace_456',
  rationale: 'High quality response with accurate information',
  metadata: { judge_model: 'gpt-4o-mini' }
});

// Create feedback with error
const errorFeedback = AssessmentUtils.createFeedback({
  name: 'automated_check',
  source: {
    sourceType: AssessmentSourceType.CODE,
    sourceId: 'validator_v1'
  },
  value: 'failed',
  error: {
    errorCode: 'TIMEOUT',
    errorMessage: 'Validation timed out after 30 seconds'
  }
});
```

## Types

### `AssessmentValueType`

Defines the allowed types for assessment values:

```typescript
type PbValueType = number | string | boolean;
type AssessmentValueType = PbValueType | { [key: string]: PbValueType } | PbValueType[];
```

### `AssessmentSourceType`

Enum defining the types of assessment sources:

```typescript
enum AssessmentSourceType {
  AI_JUDGE = 'AI_JUDGE',
  CODE = 'CODE',
  HUMAN = 'HUMAN',
  LLM_JUDGE = 'LLM_JUDGE',
  SOURCE_TYPE_UNSPECIFIED = 'SOURCE_TYPE_UNSPECIFIED'
}
```

### `AssessmentError`

Interface for representing errors during assessment generation:

```typescript
interface AssessmentError {
  errorCode: string;
  errorMessage?: string;
}
```

### `AssessmentSource`

Interface for representing the source of an assessment:

```typescript
interface AssessmentSource {
  sourceType: string;
  sourceId?: string;
}
```

## Serialization

All classes support serialization to dictionary and protocol buffer formats:

```typescript
// Convert to dictionary
const dict = assessment.toDictionary();

// Convert to protocol buffer format
const proto = assessment.toProto();

// Create from dictionary
const fromDict = Assessment.fromDictionary(dict);

// Create from protocol buffer
const fromProto = Assessment.fromProto(proto);
```

## Validation

The `Assessment` class enforces that exactly one of `expectation` or `feedback` is provided:

```typescript
// This will throw an error
try {
  new Assessment({
    name: 'invalid',
    source: { sourceType: 'HUMAN' },
    expectation: new Expectation('test'),
    feedback: new Feedback(0.5) // Both provided - invalid!
  });
} catch (error) {
  console.error('Exactly one of expectation or feedback should be specified.');
}

// This will also throw an error
try {
  new Assessment({
    name: 'invalid',
    source: { sourceType: 'HUMAN' }
    // Neither expectation nor feedback provided - invalid!
  });
} catch (error) {
  console.error('Exactly one of expectation or feedback should be specified.');
}
```

## Timestamps

Timestamps are automatically set to the current time if not provided:

```typescript
const assessment = new Assessment({
  name: 'test',
  source: { sourceType: 'HUMAN' },
  expectation: new Expectation('test')
  // createTimeMs and lastUpdateTimeMs will be set automatically
});

// Or provide custom timestamps
const customAssessment = new Assessment({
  name: 'test',
  source: { sourceType: 'HUMAN' },
  expectation: new Expectation('test'),
  createTimeMs: 1640995200000, // Custom timestamp
  lastUpdateTimeMs: 1640995200000
});
```

## Experimental Status

⚠️ **Note**: These classes are marked as experimental and may change or be removed in future releases without warning. They are currently designed to be compatible with Databricks Managed MLflow.

## Testing

Comprehensive tests are available in `__tests__/assessment.test.ts` covering:

- Basic functionality of all classes
- Serialization and deserialization
- Error handling and validation
- Type compatibility
- Utility functions

Run tests with:

```bash
npm test src/core/entities/__tests__/assessment.test.ts
```
