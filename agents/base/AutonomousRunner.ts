/** Phase 2: Abstract base class for AWS ELB autonomous agent runners. */
export abstract class AutonomousRunner {
  abstract invoke(context: import('../types.js').RunnerContext): Promise<import('../types.js').AutonomousRunnerResult>;
}
