import { baseStyles } from './stylesBase.js';
import { decisionStyles } from './stylesDecisions.js';
import { impactStyles } from './stylesImpact.js';
import { navigationStyles } from './stylesNavigation.js';
import { tableStyles } from './stylesTable.js';

export function reportStyles() {
  return [
    baseStyles(),
    navigationStyles(),
    tableStyles(),
    decisionStyles(),
    impactStyles(),
  ].join('\n');
}
