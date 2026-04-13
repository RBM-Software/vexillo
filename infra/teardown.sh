#!/bin/bash
set -eo pipefail

# Full teardown — deletes everything in the correct order:
#   1. RDS (must go first; blocks VPC subnet deletion)
#   2. cdk destroy (VPC, ECS, ALB, CloudFront, etc.)
#   3. ECR, S3, SSM parameters, IAM deploy user (retained by CDK)

echo ""
echo "Vexillo — teardown"
echo "=================="
echo "About to permanently delete:"
echo "  • RDS instance       (contains all data)"
echo "  • CDK stack          (VPC, ECS, ALB, CloudFront, etc.)"
echo "  • ECR repository     vexillo-api"
echo "  • S3 bucket          (web assets)"
echo "  • SSM parameters     /vexillo/*"
echo "  • IAM user           vexillo-deploy"
echo ""
echo "WARNING: This is irreversible. All data will be lost."
echo ""
read -rp "Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# ── 1. RDS (delete first so cdk destroy can remove the VPC) ──────────────────
echo ""
echo "Deleting RDS instance..."
DB_ID=$(aws rds describe-db-instances \
  --query "DBInstances[?contains(DBInstanceIdentifier, 'vexillo')].DBInstanceIdentifier" \
  --output text 2>/dev/null | head -1)

if [ -n "$DB_ID" ]; then
  aws rds delete-db-instance \
    --db-instance-identifier "$DB_ID" \
    --skip-final-snapshot \
    --delete-automated-backups > /dev/null
  echo "  Waiting for $DB_ID to be deleted (this takes a few minutes)..."
  aws rds wait db-instance-deleted --db-instance-identifier "$DB_ID"
  echo "  ✓ RDS deleted"
else
  echo "  No RDS instance found, skipping."
fi

# ── 2. CDK stack ──────────────────────────────────────────────────────────────
echo ""
echo "Destroying CDK stack..."
if aws cloudformation describe-stacks --stack-name VexilloStack &>/dev/null 2>&1; then
  cdk destroy --force
  echo "  ✓ Stack destroyed"
else
  echo "  Stack not found, skipping."
fi

# ── 3. ECR ────────────────────────────────────────────────────────────────────
echo ""
echo "Deleting ECR repository..."
if aws ecr describe-repositories --repository-names vexillo-api &>/dev/null 2>&1; then
  aws ecr delete-repository --repository-name vexillo-api --force > /dev/null
  echo "  ✓ Deleted ECR repository vexillo-api"
else
  echo "  No ECR repository found, skipping."
fi

# ── 4. S3 ─────────────────────────────────────────────────────────────────────
echo ""
echo "Deleting S3 bucket(s)..."
S3_BUCKETS=$(aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, 'vexillostack')].Name" \
  --output text 2>/dev/null | tr '\t' '\n')

if [ -n "$S3_BUCKETS" ]; then
  while IFS= read -r bucket; do
    [ -z "$bucket" ] && continue
    aws s3 rm "s3://$bucket" --recursive > /dev/null 2>&1 || true
    aws s3api delete-bucket --bucket "$bucket" > /dev/null
    echo "  ✓ Deleted S3 bucket $bucket"
  done <<< "$S3_BUCKETS"
else
  echo "  No S3 buckets found, skipping."
fi

# ── 5. SSM parameters ─────────────────────────────────────────────────────────
echo ""
echo "Deleting SSM parameters..."
PARAMS=$(aws ssm get-parameters-by-path --path /vexillo \
  --query 'Parameters[].Name' --output text 2>/dev/null || true)

if [ -n "$PARAMS" ]; then
  for param in $PARAMS; do
    aws ssm delete-parameter --name "$param" > /dev/null
    echo "  ✓ Deleted $param"
  done
else
  echo "  No /vexillo SSM parameters found, skipping."
fi

# ── 6. IAM deploy user ────────────────────────────────────────────────────────
echo ""
echo "Deleting IAM deploy user..."
if aws iam get-user --user-name vexillo-deploy &>/dev/null 2>&1; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/vexillo-deploy"
  # Detach ALL attached managed policies (not just the vexillo-deploy one)
  ATTACHED=$(aws iam list-attached-user-policies --user-name vexillo-deploy \
    --query 'AttachedPolicies[].PolicyArn' --output text)
  for arn in $ATTACHED; do
    aws iam detach-user-policy --user-name vexillo-deploy --policy-arn "$arn" > /dev/null
    echo "  Detached policy $arn"
  done
  # Delete all inline policies
  INLINE=$(aws iam list-user-policies --user-name vexillo-deploy \
    --query 'PolicyNames[]' --output text)
  for name in $INLINE; do
    aws iam delete-user-policy --user-name vexillo-deploy --policy-name "$name" > /dev/null
    echo "  Deleted inline policy $name"
  done
  # Delete the vexillo-deploy managed policy itself
  if aws iam get-policy --policy-arn "$POLICY_ARN" &>/dev/null 2>&1; then
    VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
      --query 'Versions[?!IsDefaultVersion].VersionId' --output text)
    for v in $VERSIONS; do
      aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v" > /dev/null
    done
    aws iam delete-policy --policy-arn "$POLICY_ARN" > /dev/null
  fi
  # Delete login profile (console password) if it exists
  aws iam delete-login-profile --user-name vexillo-deploy > /dev/null 2>&1 || true
  # Delete access keys
  KEYS=$(aws iam list-access-keys --user-name vexillo-deploy \
    --query 'AccessKeyMetadata[].AccessKeyId' --output text)
  for key in $KEYS; do
    aws iam delete-access-key --user-name vexillo-deploy --access-key-id "$key" > /dev/null
  done
  aws iam delete-user --user-name vexillo-deploy > /dev/null
  echo "  ✓ Deleted IAM user vexillo-deploy"
else
  echo "  No IAM user found, skipping."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "Teardown complete."
echo ""
echo "To redeploy from scratch:"
echo "  cd infra"
echo "  ./setup.sh"
echo "  git push origin main"
echo ""
