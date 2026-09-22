import {
  isDataStoreKind,
  isSensitiveClassification
} from 'src/security/classification';
import { Issue, RuleDefinition } from './types';

export const RULE_ID = 'sensitive-datastore-unencrypted';

export const sensitiveDatastoreUnencryptedRule: RuleDefinition = {
  id: RULE_ID,
  title: 'Sensitive data store not encrypted at rest',
  description:
    'A database, cache, storage or queue node classified confidential or ' +
    'restricted has no `encryptedAtRest: true`.',
  severity: 'error',
  rationale:
    'Confidential or restricted data left unencrypted at rest is exposed ' +
    'in full to anyone who gains access to the underlying storage, backups ' +
    'or snapshots.',
  check: (ctx): Issue[] => {
    const issues: Issue[] = [];

    ctx.view.items.forEach((viewItem) => {
      const item = ctx.itemsById.get(viewItem.id);
      if (!item || !isDataStoreKind(item.kind)) return;

      if (!isSensitiveClassification(item.dataClassification)) {
        return;
      }

      if (item.encryptedAtRest === true) return;

      issues.push({
        ruleId: RULE_ID,
        severity: 'error',
        message: `"${item.name}" (${item.kind}) is classified "${item.dataClassification}" but is not marked as encrypted at rest.`,
        viewId: ctx.view.id,
        targets: [{ type: 'ITEM', id: item.id }]
      });
    });

    return issues;
  }
};
