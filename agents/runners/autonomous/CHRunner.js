import { AutonomousRunner } from '../../base/AutonomousRunner.js';

export class CHRunner extends AutonomousRunner {
  constructor(sb) {
    super(sb, 'uk-companies-house');
  }

  buildRequestBody(ctx) {
    return {
      entity_name:        ctx.entityName,
      out_document_store: 'all_unstructured_docs',
      jurisdiction:       'UK',
      async:              true,
    };
  }
}
