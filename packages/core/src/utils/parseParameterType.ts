// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-supplied-parameter-types.html
const AWS_SPECIFIC_TYPES = new Set([
  'AWS::EC2::AvailabilityZone::Name',
  'AWS::EC2::Image::Id',
  'AWS::EC2::Instance::Id',
  'AWS::EC2::KeyPair::KeyName',
  'AWS::EC2::SecurityGroup::GroupName',
  'AWS::EC2::SecurityGroup::Id',
  'AWS::EC2::Subnet::Id',
  'AWS::EC2::Volume::Id',
  'AWS::EC2::VPC::Id',
  'AWS::Route53::HostedZone::Id',
]);

// base decides which constraints apply; list means values are comma-separated.
export type ParameterTypeInfo = { base: 'String' | 'Number' | 'AWS' | 'SSM'; list: boolean };

// Returns undefined for a type CloudFormation doesn't support.
export function parseParameterType(type: string): ParameterTypeInfo | undefined {
  switch (type) {
    case 'String':
      return { base: 'String', list: false };
    case 'CommaDelimitedList':
      return { base: 'String', list: true };
    case 'Number':
      return { base: 'Number', list: false };
    case 'List<Number>':
      return { base: 'Number', list: true };
    case 'AWS::SSM::Parameter::Name':
      return { base: 'SSM', list: false };
  }

  if (AWS_SPECIFIC_TYPES.has(type)) {
    return { base: 'AWS', list: false };
  }

  const listItem = /^List<(.+)>$/.exec(type)?.[1];
  if (listItem && AWS_SPECIFIC_TYPES.has(listItem)) {
    return { base: 'AWS', list: true };
  }

  const ssmValue = /^AWS::SSM::Parameter::Value<(.+)>$/.exec(type)?.[1];
  if (ssmValue === 'String') {
    return { base: 'SSM', list: false };
  }
  if (ssmValue === 'List<String>' || ssmValue === 'CommaDelimitedList') {
    return { base: 'SSM', list: true };
  }
  const inner = ssmValue === undefined ? undefined : parseParameterType(ssmValue);
  if (inner?.base === 'AWS') {
    return { base: 'SSM', list: inner.list };
  }

  return undefined;
}
