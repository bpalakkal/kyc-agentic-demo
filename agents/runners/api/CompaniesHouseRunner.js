/**
 * Companies House API runner — stub.
 * Implementation will be provided separately.
 */

import { ApiRunner } from '../../base/ApiRunner.js';

export class CompaniesHouseRunner extends ApiRunner {
  get slug()       { return 'companies-house'; }
  get outputType() { return 'attributes'; }

  async execute(ctx) {
    this.step(`Searching Companies House for "${ctx.entityName}"…`);
    throw new Error('CompaniesHouseRunner: implementation not yet provided');
  }
}
