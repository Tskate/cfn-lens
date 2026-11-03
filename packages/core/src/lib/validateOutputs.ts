import type { Condition, Diagnostic, Output } from '../types';

type Sections = { conditions: ReadonlyMap<string, Condition> };

// Pure: checks output conditions and that literal export names are unique.
export function validateOutputs(outputs: ReadonlyMap<string, Output>, { conditions }: Sections): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const exportNames = new Set<string>();

  for (const output of outputs.values()) {
    if (output.condition !== undefined && !conditions.has(output.condition)) {
      diagnostics.push({
        severity: 'error',
        code: 'unknown-condition',
        message: `Condition '${output.condition}' is not defined.`,
        range: output.propertyRanges.Condition,
      });
    }

    // Export names are unique per account and Region, so a repeat within the template can't deploy.
    // Names built with functions are only known at deploy time and aren't compared.
    const exportName = output.exportName;
    if (exportName?.kind !== 'scalar' || exportName.value === null) {
      continue;
    }
    const literal = String(exportName.value);
    if (exportNames.has(literal)) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-export-name',
        message: `Export name '${literal}' is already used by another output.`,
        range: exportName.range,
      });
    }
    exportNames.add(literal);
  }

  return diagnostics;
}
