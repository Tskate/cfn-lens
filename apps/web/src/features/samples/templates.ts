export const webAppWithVpc = `
AWSTemplateFormatVersion: "2010-09-09"
Description: "Web app in a VPC with Load Balancer and servers across two Availability Zones, with an optional database."

Resources: 
    VPC:
        Type: AWS::EC2::VPC
        Properties: 
            CidrBlock: 
`;

export const serverlessApi = `
AWSTemplateFormatVersion: "2010-09-09"
Description: "API Gateway calling a Lambda function that reads and writes a DynamoDB table."

Resources: 
    ApiGatewayApi:
        Type: AWS::ApiGateway::RestApi
`;

export const staticWebsite = `
AWSTemplateFormatVersion: 2010-09-09
Description: "A private S3 bucket served through CloudFront with origin access control."

Resources:
    MyBucket:
        Type: AWS::S3::Bucket
`;

export const queueWorker = `
AWSTemplateFormatVersion: "2010-09-09"
Description: "An SQS queue feeding a Lambda function, with a dead-letter queue for failures."

Resources:
    SQSQueue:
        Type: AWS::SQS::Queue
`;
