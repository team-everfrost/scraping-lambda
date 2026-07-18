.DEFAULT_GOAL := help

.PHONY: help install check audit package deploy

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; print "Usage: make <target>"} /^[a-zA-Z_-]+:.*##/ {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install exactly the locked dependencies
	npm ci --ignore-scripts

check: ## Run formatting, types, and unit tests
	npm run format:check
	npm run typecheck
	npm test

audit: ## Check the locked dependency graph for known vulnerabilities
	npm audit

package: ## Build the Lambda deployment ZIP without cloud credentials
	npm run package

deploy: package ## Upload code and deploy CloudFormation (requires explicit env values)
	@test -n "$(CODE_BUCKET)" || (echo "CODE_BUCKET is required" && exit 1)
	@test -n "$(ARTIFACT_BUCKET)" || (echo "ARTIFACT_BUCKET is required" && exit 1)
	@test -n "$(SCRAPE_REQUEST_QUEUE_ARN)" || (echo "SCRAPE_REQUEST_QUEUE_ARN is required" && exit 1)
	@test -n "$(SCRAPE_RESULT_QUEUE_ARN)" || (echo "SCRAPE_RESULT_QUEUE_ARN is required" && exit 1)
	@test -n "$(SCRAPE_RESULT_QUEUE_URL)" || (echo "SCRAPE_RESULT_QUEUE_URL is required" && exit 1)
	aws s3 cp .artifacts/scraping-lambda.zip s3://$(CODE_BUCKET)/remak/scraping-lambda.zip
	aws cloudformation deploy --stack-name remak-scraping --template-file infra/template.yaml --capabilities CAPABILITY_IAM --parameter-overrides CodeBucket=$(CODE_BUCKET) CodeKey=remak/scraping-lambda.zip ArtifactBucketName=$(ARTIFACT_BUCKET) ScrapeRequestQueueArn=$(SCRAPE_REQUEST_QUEUE_ARN) ScrapeResultQueueArn=$(SCRAPE_RESULT_QUEUE_ARN) ScrapeResultQueueUrl=$(SCRAPE_RESULT_QUEUE_URL)
