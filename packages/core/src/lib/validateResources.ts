import type { Condition, Diagnostic, Parameter, Resource } from '../types';
import { findReferences } from '../utils/findReferences';
import { findCycles, type Edge } from '../utils/findCycles';

// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-deletionpolicy.html
const DELETION_POLICIES: ReadonlySet<string> = new Set(['Delete', 'Retain', 'RetainExceptOnCreate', 'Snapshot']);
// https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-updatereplacepolicy.html
const UPDATE_REPLACE_POLICIES: ReadonlySet<string> = new Set(['Delete', 'Retain', 'Snapshot']);

type Sections = { conditions: ReadonlyMap<string, Condition>; parameters?: ReadonlyMap<string, Parameter> };

const PSEUDO_PARAMETERS = new Set([
  'AWS::AccountId',
  'AWS::NotificationARNs',
  'AWS::NoValue',
  'AWS::Partition',
  'AWS::Region',
  'AWS::StackId',
  'AWS::StackName',
  'AWS::URLSuffix',
]);

// Pure: checks resource attributes against other sections and reports DependsOn cycles.
// Property references also create implicit dependencies.
export function validateResources(resources: ReadonlyMap<string, Resource>, { conditions, parameters }: Sections): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const graph = new Map<string, Edge[]>();

  for (const resource of resources.values()) {
    const { name, propertyRanges } = resource;

    if (resource.condition !== undefined && !conditions.has(resource.condition)) {
      diagnostics.push({
        severity: 'error',
        code: 'unknown-condition',
        message: `Condition '${resource.condition}' is not defined.`,
        range: propertyRanges.Condition,
      });
    }

    const policies = [
      ['DeletionPolicy', resource.deletionPolicy, DELETION_POLICIES],
      ['UpdateReplacePolicy', resource.updateReplacePolicy, UPDATE_REPLACE_POLICIES],
    ] as const;
    for (const [property, value, allowed] of policies) {
      if (value !== undefined && !allowed.has(value)) {
        diagnostics.push({
          severity: 'error',
          code: 'invalid-policy',
          message: `${property} of ${name} must be one of ${[...allowed].join(', ')}, not '${value}'.`,
          range: propertyRanges[property],
        });
      }
    }

    // DependsOn holds names only, so every edge points at the DependsOn value.
    const edges: Edge[] = [];
    for (const target of resource.dependsOn) {
      if (resources.has(target)) {
        edges.push({ target, range: propertyRanges.DependsOn });
      } else {
        diagnostics.push({
          severity: 'error',
          code: 'unknown-resource',
          message: `${name} depends on '${target}', which is not a resource in this template.`,
          range: propertyRanges.DependsOn,
        });
      }
    }
    for (const reference of resource.properties ? findReferences(resource.properties) : []) {
      const { target, via, range } = reference;
      if (resources.has(target)) {
        edges.push({ target, range });
      } else if (via === 'Fn::GetAtt' || (!parameters?.has(target) && !PSEUDO_PARAMETERS.has(target))) {
        diagnostics.push({
          severity: 'error',
          code: 'unknown-resource-reference',
          message: `${name} references '${target}', which is not a ${via === 'Fn::GetAtt' ? 'resource' : 'resource, parameter, or pseudo parameter'} in this template.`,
          range,
        });
      }
    }
    graph.set(name, edges);
  }

  const cycles = findCycles(graph).map(({ path, edge }): Diagnostic => ({
    severity: 'error',
    code: 'circular-dependency',
    message: `Circular dependency: ${path.join(' → ')}.`,
    range: edge.range,
  }));

  return [...diagnostics, ...cycles];
}
