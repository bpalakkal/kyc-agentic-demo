import { AutonomousRunner } from '../../base/AutonomousRunner.js';

export class JerseyRunner extends AutonomousRunner {
  constructor(sb) {
    super(sb, 'uk-jersey-financial-services-commission');
  }

  buildRequestBody(ctx) {
    return {
      entity_name:  ctx.entityName,
      jurisdiction: 'UK',
      async:        true,
    };
  }
}
