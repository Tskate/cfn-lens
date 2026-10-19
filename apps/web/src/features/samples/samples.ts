import type { ServiceIconName } from '@/components/ServiceIcon';
import { serverlessApi, webAppWithVpc } from './templates';

export interface Sample {
  id: string;
  title: string;
  description: string;
  icons: ServiceIconName[];
  template: string;
}

export const samples: Sample[] = [
  {
    id: 'vpc-web-app',
    title: 'Web app in a VPC',
    description: 'Load balancer and servers across two Availability Zones, with an optional database.',
    icons: ['loadBalancer', 'server', 'database'],
    template: webAppWithVpc,
  },
  {
    id: 'serverless-api',
    title: 'Serverless API',
    description: 'API Gateway calling a Lambda function that reads and writes a DynamoDB table.',
    icons: ['api', 'function', 'table'],
    template: serverlessApi,
  },
  {
    id: 'static-website',
    title: 'Static website',
    description: 'A private S3 bucket served through CloudFront with origin access control.',
    icons: ['cdn', 'bucket'],
    template: '',
  },
  {
    id: 'queue-worker',
    title: 'Queue worker',
    description: 'An SQS queue feeding a Lambda function, with a dead-letter queue for failures.',
    icons: ['queue', 'function'],
    template: '',
  },
];
