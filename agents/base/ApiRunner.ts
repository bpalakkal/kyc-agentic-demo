/** Phase 2: Abstract base class for code-based API runners. */
export abstract class ApiRunner {
  abstract run(context: import('../types.js').RunnerContext): Promise<import('../types.js').ApiRunnerResult>;
}
