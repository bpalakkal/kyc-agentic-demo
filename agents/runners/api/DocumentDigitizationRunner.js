import { ApiRunner } from '../../base/ApiRunner.js';
import schemaMeta from '../../../schema/schema-meta.js';
import { digitizeKycDocument } from './sourcingArtifacts.js';

const SCALAR_FIELDS = Object.entries(schemaMeta.attributes)
  .filter(([name, meta]) => meta.kind === 'scalar' && !meta.party && !['entity_id', 'case_id'].includes(name))
  .map(([name]) => name);
const PARTY_ROLES = Object.entries(schemaMeta.attributes)
  .filter(([, meta]) => meta.kind === 'array' && meta.party && meta.party !== 'documents')
  .map(([, meta]) => meta.party);

export class DocumentDigitizationRunner extends ApiRunner {
  constructor(sb, { slug, documentType, file, modelProfile }) {
    super(sb, { modelProfile });
    this.config = { slug, documentType, file };
  }
  get slug() { return this.config.slug; }
  get outputType() { return 'both'; }

  async execute({ kycRef }) {
    const startedAt = Date.now();
    const { file, documentType } = this.config;
    this.step(`Digitizing ${file.filename} as ${documentType}`);
    const digitized = await digitizeKycDocument(file, {
      documentType, source: `Customer/source document: ${file.title || file.filename}`,
      scalarFields: SCALAR_FIELDS, partyRoles: PARTY_ROLES,
      modelProfileKey: this.modelProfile?.key,
    });
    const existing = await this._existingAttributeNames(kycRef);
    const seen = new Set(existing);
    const attributes = digitized.attributes.filter(attribute => {
      if (seen.has(attribute.attributeName)) return false;
      seen.add(attribute.attributeName);
      return true;
    });
    return {
      agentSlug: this.slug, kycRef, outputType: 'both', attributes,
      persons: digitized.persons, personSource: `Document digitization (${documentType})`, files: [],
      metadata: { outcome: 'data_found', completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, sourcesConsulted: [`case_files:${file.id}`] },
    };
  }

  async _existingAttributeNames(kycRef) {
    const { data: runs, error: runError } = await this.sb.from('agent_runs').select('id')
      .eq('kyc_ref', kycRef).eq('status', 'complete');
    if (runError) throw runError;
    if (!runs?.length) return new Set();
    const { data, error } = await this.sb.from('entity_attributes').select('attribute_name')
      .eq('kyc_ref', kycRef).in('agent_run_id', runs.map(run => run.id));
    if (error) throw error;
    return new Set((data ?? []).map(row => row.attribute_name));
  }
}
