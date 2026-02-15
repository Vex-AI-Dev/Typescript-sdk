// Vex TypeScript SDK
export { Vex } from './vex';
export type { VexOptions, TraceOptions } from './vex';

export { Session } from './session';
export type { SessionTraceOptions } from './session';

export { TraceContext } from './trace';

export type {
  VexResult,
  ExecutionEvent,
  ConversationTurn,
  StepRecord,
  ThresholdConfig,
} from './models';

export type { VexConfig, VexConfigInput } from './config';

export {
  VexError,
  ConfigurationError,
  IngestionError,
  VerificationError,
  VexBlockError,
} from './errors';
