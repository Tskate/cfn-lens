export const webAppWithVpc = `AWSTemplateFormatVersion: '2010-09-09'
Description: 'Web app in a VPC with Load Balancer and servers across two Availability Zones, with an optional database.'

Parameters:
  EnvironmentName:
    Type: String
    Default: 'webapp'
    Description: 'Prefix used in resource Name tags'
    AllowedPattern: '[a-z][a-z0-9-]*'
    ConstraintDescription: Lowercase letters, digits and hyphens, starting with a letter

  VpcCidr:
    Type: String
    Default: '10.10.0.0/16'
    Description: CIDR for VPC
    AllowedPattern: '^(\\d{1,3}\\.){3}\\d{1,3}/(1[6-9]|2[0-8])$'
    ConstraintDescription: Must be a valid CIDR block with a prefix between /16 and /28
  PublicSubnet1Cidr:
    Type: String
    Default: 10.10.0.0/24
    Description: CIDR for the public subnet in the first AZ
    AllowedPattern: '^(\\d{1,3}\\.){3}\\d{1,3}/(1[8-9]|2[0-8])$'
    ConstraintDescription: Must be a valid CIDR block with a prefix between /18 and /28
  PublicSubnet2Cidr:
    Type: String
    Default: 10.10.1.0/24
    Description: CIDR for the public subnet in the second AZ
    AllowedPattern: '^(\\d{1,3}\\.){3}\\d{1,3}/(1[8-9]|2[0-8])$'
    ConstraintDescription: Must be a valid CIDR block with a prefix between /18 and /28
  PrivateSubnet1Cidr:
    Type: String
    Default: 10.10.10.0/24
    Description: CIDR for the private subnet in the first AZ
    AllowedPattern: '^(\\d{1,3}\\.){3}\\d{1,3}/(1[8-9]|2[0-8])$'
    ConstraintDescription: Must be a valid CIDR block with a prefix between /18 and /28
  PrivateSubnet2Cidr:
    Type: String
    Default: 10.10.11.0/24
    Description: CIDR for the private subnet in the second AZ
    AllowedPattern: '^(\\d{1,3}\\.){3}\\d{1,3}/(1[8-9]|2[0-8])$'
    ConstraintDescription: Must be a valid CIDR block with a prefix between /18 and /28

  InstanceType:
    Type: String
    Default: t3.micro
    Description: EC2 instance type for the web servers
    AllowedValues:
      - t3.micro
      - t3.small

  MinSize:
    Type: Number
    Default: 2
    Description: Minimum number of web server instances (one per AZ at least)
    MinValue: 2
    MaxValue: 4
  MaxSize:
    Type: Number
    Default: 4
    Description: Maximum number of web server instances (must be >= MinSize)
    MinValue: 2
    MaxValue: 8

  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64
    Description: Amazon Linux 2023 AMI, resolved from the public SSM parameter at deploy time

  CreateDatabase:
    Type: String
    Default: 'false'
    Description: Create a PostgreSQL database in the private subnets
    AllowedValues:
      - 'true'
      - 'false'

Conditions:
  ShouldCreateDatabase: !Equals [!Ref CreateDatabase, 'true']

Resources:
  # ---------- VPC and internet access ----------
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-vpc'

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-igw'

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref Vpc
      InternetGatewayId: !Ref InternetGateway

  # ---------- Subnets: one public + one private per AZ ----------
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: !Ref PublicSubnet1Cidr
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-public-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: !Ref PublicSubnet2Cidr
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-public-2'

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      AvailabilityZone: !Select [0, !GetAZs '']
      CidrBlock: !Ref PrivateSubnet1Cidr
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-private-1'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      AvailabilityZone: !Select [1, !GetAZs '']
      CidrBlock: !Ref PrivateSubnet2Cidr
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-private-2'

  # ---------- Public routing: 0.0.0.0/0 → internet gateway ----------
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-public'

  PublicDefaultRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet1

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PublicRouteTable
      SubnetId: !Ref PublicSubnet2

  # ---------- NAT gateways: one per AZ, each in its AZ's public subnet ----------
  NatGateway1Eip:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway2Eip:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway1:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway1Eip.AllocationId
      SubnetId: !Ref PublicSubnet1
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-nat-1'

  NatGateway2:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway2Eip.AllocationId
      SubnetId: !Ref PublicSubnet2
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-nat-2'

  # ---------- Private routing: 0.0.0.0/0 → the NAT gateway in the same AZ ----------
  PrivateRouteTable1:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-private-1'

  PrivateDefaultRoute1:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway1

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable1
      SubnetId: !Ref PrivateSubnet1

  PrivateRouteTable2:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-private-2'

  PrivateDefaultRoute2:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway2

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      RouteTableId: !Ref PrivateRouteTable2
      SubnetId: !Ref PrivateSubnet2

  # ---------- Security groups: internet → ALB → servers → database ----------
  LoadBalancerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: HTTP from the internet to the load balancer
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - Description: HTTP from anywhere
          IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-alb'

  WebServerSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: HTTP from the load balancer only
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - Description: HTTP from the load balancer
          IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          SourceSecurityGroupId: !Ref LoadBalancerSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-web'

  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Condition: ShouldCreateDatabase
    Properties:
      GroupDescription: PostgreSQL from the web servers only
      VpcId: !Ref Vpc
      SecurityGroupIngress:
        - Description: PostgreSQL from the web servers
          IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref WebServerSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-db'

  # ---------- Load balancer: public subnets, forwards to the target group ----------
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Type: application
      Scheme: internet-facing
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref LoadBalancerSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-alb'

  WebServerTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      VpcId: !Ref Vpc
      TargetType: instance
      Protocol: HTTP
      Port: 80
      HealthCheckPath: /
      Matcher:
        HttpCode: '200'
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: '30'

  HttpListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref LoadBalancer
      Protocol: HTTP
      Port: 80
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref WebServerTargetGroup

  # ---------- Web servers: role → instance profile → launch template → Auto Scaling group ----------
  WebServerRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - !Sub 'arn:\${AWS::Partition}:iam::aws:policy/AmazonSSMManagedInstanceCore'
      Policies: !If
        - ShouldCreateDatabase
        - - PolicyName: read-database-secret
            PolicyDocument:
              Version: '2012-10-17'
              Statement:
                - Effect: Allow
                  Action: secretsmanager:GetSecretValue
                  Resource: !GetAtt Database.MasterUserSecret.SecretArn
        - !Ref AWS::NoValue

  WebServerInstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref WebServerRole

  WebServerLaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateData:
        ImageId: !Ref LatestAmiId
        InstanceType: !Ref InstanceType
        IamInstanceProfile:
          Arn: !GetAtt WebServerInstanceProfile.Arn
        SecurityGroupIds:
          - !Ref WebServerSecurityGroup
        MetadataOptions:
          HttpTokens: required
        TagSpecifications:
          - ResourceType: instance
            Tags:
              - Key: Name
                Value: !Sub '\${EnvironmentName}-web'
        UserData:
          Fn::Base64: !Sub |
            #!/bin/bash
            set -euo pipefail
            dnf install -y httpd
            TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
            AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
            echo "<h1>Hello from \${EnvironmentName} in $AZ</h1>" > /var/www/html/index.html
            systemctl enable --now httpd

  WebServerAutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    DependsOn:
      - PrivateDefaultRoute1
      - PrivateDefaultRoute2
    Properties:
      VPCZoneIdentifier:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      LaunchTemplate:
        LaunchTemplateId: !Ref WebServerLaunchTemplate
        Version: !GetAtt WebServerLaunchTemplate.LatestVersionNumber
      MinSize: !Ref MinSize
      MaxSize: !Ref MaxSize
      TargetGroupARNs:
        - !Ref WebServerTargetGroup
      HealthCheckType: ELB
      HealthCheckGracePeriod: 120
    UpdatePolicy:
      AutoScalingRollingUpdate:
        MinInstancesInService: 1
        MaxBatchSize: 1
        PauseTime: PT2M

  # ---------- Optional database: PostgreSQL in the private subnets ----------
  DatabaseSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Condition: ShouldCreateDatabase
    Properties:
      DBSubnetGroupDescription: Private subnets for the database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  Database:
    Type: AWS::RDS::DBInstance
    Condition: ShouldCreateDatabase
    DeletionPolicy: Snapshot
    UpdateReplacePolicy: Snapshot
    Properties:
      Engine: postgres
      EngineVersion: '17'
      DBInstanceClass: db.t4g.micro
      AllocatedStorage: '20'
      StorageType: gp3
      StorageEncrypted: true
      DBName: app
      MasterUsername: app_admin
      ManageMasterUserPassword: true
      DBSubnetGroupName: !Ref DatabaseSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      PubliclyAccessible: false
      MultiAZ: false
      BackupRetentionPeriod: 7
      Tags:
        - Key: Name
          Value: !Sub '\${EnvironmentName}-db'

Outputs:
  WebsiteUrl:
    Description: Open this in a browser; refresh to see the answering AZ change
    Value: !Sub 'http://\${LoadBalancer.DNSName}'
  VpcId:
    Description: VPC for other stacks to build in
    Value: !Ref Vpc
    Export:
      Name: !Sub '\${AWS::StackName}-VpcId'
  PrivateSubnetIds:
    Description: Private subnets, comma-separated
    Value: !Join [',', [!Ref PrivateSubnet1, !Ref PrivateSubnet2]]
    Export:
      Name: !Sub '\${AWS::StackName}-PrivateSubnetIds'
  DatabaseEndpoint:
    Condition: ShouldCreateDatabase
    Description: PostgreSQL host name, reachable from the web servers only
    Value: !GetAtt Database.Endpoint.Address
  DatabaseSecretArn:
    Condition: ShouldCreateDatabase
    Description: Secrets Manager secret holding the generated master password
    Value: !GetAtt Database.MasterUserSecret.SecretArn
`;

export const serverlessApi = `AWSTemplateFormatVersion: '2010-09-09'
Description: 'API Gateway calling a Lambda function that reads and writes a DynamoDB table.'

Resources:
  # ---------- Data: one table, keyed by item id ----------
  ItemsTable:
    Type: AWS::DynamoDB::Table
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

  # ---------- Function: role → log group → Lambda ----------
  ItemsFunctionLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      RetentionInDays: 14

  ItemsFunctionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: write-logs
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: !GetAtt ItemsFunctionLogGroup.Arn
        - PolicyName: read-write-items
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - dynamodb:GetItem
                  - dynamodb:PutItem
                  - dynamodb:Scan
                Resource: !GetAtt ItemsTable.Arn

  ItemsFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: nodejs22.x
      Architectures:
        - arm64
      Handler: index.handler
      MemorySize: 256
      Timeout: 10
      Role: !GetAtt ItemsFunctionRole.Arn
      LoggingConfig:
        LogGroup: !Ref ItemsFunctionLogGroup
      Environment:
        Variables:
          TABLE_NAME: !Ref ItemsTable
      Code:
        ZipFile: |
          const { randomUUID } = require('node:crypto');
          const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
          const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

          const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
          const TableName = process.env.TABLE_NAME;
          const json = (statusCode, body) => ({
            statusCode,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });

          exports.handler = async (event) => {
            switch (event.routeKey) {
              case 'GET /items': {
                const { Items } = await db.send(new ScanCommand({ TableName, Limit: 50 }));
                return json(200, Items);
              }
              case 'GET /items/{id}': {
                const { Item } = await db.send(new GetCommand({ TableName, Key: { id: event.pathParameters.id } }));
                return Item ? json(200, Item) : json(404, { message: 'Item not found' });
              }
              case 'POST /items': {
                const item = { ...JSON.parse(event.body ?? '{}'), id: randomUUID() };
                await db.send(new PutCommand({ TableName, Item: item }));
                return json(201, item);
              }
              default:
                return json(404, { message: 'Route not found' });
            }
          };

  # ---------- HTTP API: routes → one Lambda integration ----------
  ItemsApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: !Sub '\${AWS::StackName}-items'
      ProtocolType: HTTP

  ItemsIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref ItemsApi
      IntegrationType: AWS_PROXY
      IntegrationUri: !GetAtt ItemsFunction.Arn
      PayloadFormatVersion: '2.0'

  ListItemsRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref ItemsApi
      RouteKey: GET /items
      Target: !Sub 'integrations/\${ItemsIntegration}'

  GetItemRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref ItemsApi
      RouteKey: GET /items/{id}
      Target: !Sub 'integrations/\${ItemsIntegration}'

  CreateItemRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref ItemsApi
      RouteKey: POST /items
      Target: !Sub 'integrations/\${ItemsIntegration}'

  DefaultStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref ItemsApi
      StageName: $default
      AutoDeploy: true
      DefaultRouteSettings:
        ThrottlingRateLimit: 10
        ThrottlingBurstLimit: 20

  ItemsApiInvokePermission:
    Type: AWS::Lambda::Permission
    Properties:
      Action: lambda:InvokeFunction
      FunctionName: !Ref ItemsFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:\${AWS::Partition}:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${ItemsApi}/*'

Outputs:
  ApiUrl:
    Description: "Try: curl -X POST $URL/items -d '{\\"name\\":\\"first\\"}', then curl $URL/items"
    Value: !GetAtt ItemsApi.ApiEndpoint
  TableName:
    Description: DynamoDB table holding the items
    Value: !Ref ItemsTable
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
