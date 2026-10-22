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

export const staticWebsite = `AWSTemplateFormatVersion: '2010-09-09'
Description: Static website with private S3 and CloudFront OAC
Resources:
  WebsiteBucket:
    Type: AWS::S3::Bucket
    Properties:
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  OriginAccessControl:
    Type: AWS::CloudFront::OriginAccessControl
    Properties:
      OriginAccessControlConfig:
        Name: !Sub '\${AWS::StackName}-oac'
        OriginAccessControlOriginType: s3
        SigningBehavior: always
        SigningProtocol: sigv4

  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        Origins:
          - Id: S3Origin
            DomainName: !GetAtt WebsiteBucket.RegionalDomainName
            OriginAccessControlId: !GetAtt OriginAccessControl.Id
            S3OriginConfig:
              OriginAccessIdentity: ''
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods:
            - GET
            - HEAD
          CachedMethods:
            - GET
            - HEAD
          ForwardedValues:
            QueryString: false
          MinTTL: 0
          DefaultTTL: 86400
          MaxTTL: 31536000
        ViewerCertificate:
          CloudFrontDefaultCertificate: true

  WebsiteBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref WebsiteBucket
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowCloudFrontRead
            Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action:
              - s3:GetObject
            Resource: !Sub '\${WebsiteBucket.Arn}/*'
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub 'arn:\${AWS::Partition}:cloudfront::\${AWS::AccountId}:distribution/\${CloudFrontDistribution}'

Outputs:
  WebsiteURL:
    Description: CloudFront website URL
    Value: !Sub 'https://\${CloudFrontDistribution.DomainName}'
  BucketName:
    Description: S3 bucket for website files
    Value: !Ref WebsiteBucket
  DistributionId:
    Description: CloudFront distribution ID
    Value: !Ref CloudFrontDistribution
`;

export const queueWorker = `
AWSTemplateFormatVersion: "2010-09-09"
Description: "An SQS queue feeding a Lambda function, with a dead-letter queue for failures."

Resources:
    SQSQueue:
        Type: AWS::SQS::Queue
`;
