import { describe, expect, it } from 'vitest';
import { buildDiagram, parseTemplate } from '@cfn-lens/core';
import { loadLayout } from './layoutDiagram';

function modelOf(source: string) {
  return buildDiagram(parseTemplate(source).template!);
}

describe('layout cache', () => {
  const queue = `Resources:
  Queue:
    Type: AWS::SQS::Queue
`;

  it('reuses the layout when an edit changes nothing drawn', async () => {
    const first = loadLayout(modelOf(queue));
    const second = loadLayout(modelOf(`# A comment shifts every line\n${queue}`));

    expect(second).toBe(first);
    await first;
  });

  it('reuses the layout when only a description changes', async () => {
    const first = loadLayout(modelOf(`Description: One\n${queue}`));
    const second = loadLayout(modelOf(`Description: Two\n${queue}`));

    expect(second).toBe(first);
    await first;
  });

  it('lays out again when a resource is added', async () => {
    const first = loadLayout(modelOf(queue));
    const second = loadLayout(modelOf(`${queue}  Topic:\n    Type: AWS::SNS::Topic\n`));

    expect(second).not.toBe(first);
    await Promise.all([first, second]);
  });
});

describe('container connections', () => {
  it('routes references and dependencies to container boundaries', async () => {
    const { template } = parseTemplate(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
  Subnet:
    Type: AWS::EC2::Subnet
    DependsOn: Vpc
    Properties: {VpcId: !Ref Vpc}
  Topic:
    Type: AWS::SNS::Topic
    DependsOn: Subnet
`);
    const layout = await loadLayout(buildDiagram(template!));
    expect(layout.edges).toHaveLength(2);
    for (const edge of layout.edges) {
      expect(edge.data?.points.length).toBeGreaterThan(1);
      expect(edge.data?.points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    }
  });
});
