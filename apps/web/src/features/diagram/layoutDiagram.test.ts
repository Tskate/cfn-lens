import { describe, expect, it } from 'vitest';
import { buildDiagram, parseTemplate } from '@cfn-lens/core';
import { loadLayout } from './layoutDiagram';

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
