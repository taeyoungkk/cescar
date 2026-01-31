# 실행 방법

## 1. Node.js 설치
v24.13.0 로 깔았음

## 2. 환경 변수 설정
`Frontend/.env.local.example`을 복사해서 `Frontend/.env.local`로 만들고 값을 채워주세요.

채울 값들은 노션 참고

## 3. 실행
### 프론트는 Vercel, 백은 EC2인 경우 (웹, 모바일 모두 가능)
`cd Frontend` 후

`vercel link`
(마지막 `Would you like to pull environment variables now?` 질문에만 n 하면 되는 것으로 알고 있음)

`vercel --prod`
실행 후 나오는 Production url로 모바일 크롬에서 접속

 “홈 화면에 추가”로 PWA 설치 <br>
→ 그러면 모바일에서도 앱처럼 열리고, FCM 알림도 받을 수 있음.

### 프론트, 백 둘 다 로컬일 경우 (웹만 가능)
`cd Frontend` 후

`npm install`<br>
`npm run build -- --webpack`<br>
`npm run start` 한 후

`http://localhost:3000` 접속
