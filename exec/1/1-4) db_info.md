# DB 관련 파일 정리

## 1) 접속 정보 파일 (DB 연결 주소/호스트/포트 포함)
- `S14P11B201/Backend/src/main/resources/application.properties`
  - 접속 URL: `spring.datasource.url`
  - 예시 값(마스킹): `jdbc:postgresql://<host>:<port>/<db>?stringtype=unspecified`
- `S14P11B201/Backend/docker-compose.yml`
  - DB 포트 바인딩: `services.db.ports` (예: `"5432:5432"`)

## 2) 계정/자격증명 파일 (DB 사용자/비밀번호)
- `S14P11B201/Backend/src/main/resources/application.properties`
  - 사용자: `spring.datasource.username`
  - 비밀번호: `spring.datasource.password` (마스킹: `<password>`)
- `S14P11B201/Backend/docker-compose.yml`
  - 사용자: `services.db.environment.POSTGRES_USER`
  - 비밀번호: `services.db.environment.POSTGRES_PASSWORD` (마스킹: `<password>`)

## 3) DB 프로퍼티/동작 설정 파일
- `S14P11B201/Backend/src/main/resources/application.properties`
  - 드라이버: `spring.datasource.driver-class-name`
  - 스키마/마이그레이션: `spring.flyway.enabled`, `spring.flyway.locations`, `spring.flyway.schemas`
  - JPA DDL 정책: `spring.jpa.hibernate.ddl-auto`

## 4) 스키마/ERD 기준 자료(DDL/마이그레이션)
- `S14P11B201/Backend/src/main/resources/db/migration/`
  - 예: `V1__init.sql` (초기 스키마)
  - 예: `V2__schema_changes.sql` 등 버전별 변경 이력
