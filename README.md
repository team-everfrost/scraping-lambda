# Remak scraping Lambda

브라우저가 꼭 필요한 웹페이지 렌더링만 담당하는 Node.js Lambda입니다. 계정, 문서 상태, PostgreSQL에는 접근하지 않습니다.

## 책임과 경계

1. Go API가 transactional outbox에 `document.scrape.requested.v1`을 기록합니다.
2. Go worker가 요청을 SQS에 발행합니다.
3. 이 Lambda가 Chromium으로 페이지를 렌더링하고 원본 HTML과 추출 텍스트를 S3에 저장합니다.
4. Lambda가 `document.scrape.completed.v1` 또는 마지막 실패의 `document.scrape.failed.v1`을 결과 SQS에 발행합니다.
5. Go worker가 inbox idempotency와 문서 version 검사를 거쳐 DB를 변경합니다.

같은 요청을 여러 번 받아도 `jobId` 기반의 동일한 S3 key를 덮어쓰고, 결과의 `eventId`도 요청과 동일하게 유지합니다. SQS의 at-least-once 전달을 전제로 한 설계입니다.

## 보안

- 최초 URL과 모든 브라우저 하위 요청/redirect의 DNS 결과를 검사합니다.
- loopback, RFC1918, link-local, metadata 주소, reserved IP를 차단합니다.
- URL userinfo, 비 HTTP(S), `.local`, `.internal` 호스트를 차단합니다.
- Lambda에서 필요한 `--no-sandbox` 외에 `--disable-web-security`나 인증서 무시는 사용하지 않습니다.
- DB 자격 증명은 Lambda에 주지 않습니다. IAM도 아티팩트 bucket 쓰기, 결과 queue 발행, 요청 queue 소비로 제한합니다.

DNS 검사와 실제 Chromium 연결 사이의 DNS rebinding 가능성은 애플리케이션 계층만으로 완전히 제거할 수 없습니다. 운영에서는 Lambda를 전용 VPC에 넣고 private/metadata 대역 egress를 네트워크 계층에서도 차단하는 것을 권장합니다.

## 재시도

요청 큐의 `maxReceiveCount`와 `MAX_SCRAPE_ATTEMPTS`를 같은 값(기본 3)으로 둡니다. 중간 시도 실패는 `ReportBatchItemFailures`로 해당 메시지만 재시도합니다. 마지막 시도에는 실패 결과를 Go worker로 보내 문서 상태를 종결하고 메시지를 정상 처리합니다. 결과 SQS 발행 자체가 실패하면 요청 메시지는 다시 재시도됩니다.

## 로컬 검증

```sh
npm ci
npm run typecheck
npm test
npm run package
```

AWS SDK는 `AWS_ENDPOINT_URL=http://localhost:4566`을 통해 MiniStack S3/SQS를 사용할 수 있습니다. Chromium 캡처 테스트는 외부 네트워크를 사용하므로 기본 단위 테스트와 분리합니다.

## 배포

Serverless Framework v4의 로그인/라이선스 의존성을 제거했습니다. `npm run package`는 `.artifacts/scraping-lambda.zip`을 재현 가능한 방식으로 만들고, `infra/template.yaml`은 순수 CloudFormation 배포 명세입니다.

ZIP은 ESM으로 빌드합니다. package 단계가 production dependency 설치 뒤 완성된 `index.js`를 실제 Node로 import해 handler export와 ESM/CJS 경계를 먼저 검사하므로, Chromium package 형식 불일치는 배포 전에 실패합니다. 최종 runtime 검증은 공식 AWS Lambda Node 24 x86_64 image에서 수행합니다.

`.env.example`의 ARN/URL을 실제 AWS 리소스로 채운 뒤 `CODE_BUCKET` 등 Makefile에 표시된 값을 전달해 `make deploy`를 실행합니다. GitHub Actions/OIDC 배포를 추가하기 전까지 장기 AWS access key를 저장소 secret에 넣지 않습니다.
