# 실행 방법

## 1. Node.js 설치
v24.13.0 로 깔았음

## 2. Frontend 폴더 안에 .env.local 파일 추가 후 아래 내용 복붙
NEXT_PUBLIC_SIGNALING_URL=wss://I14B201.p.ssafy.io/ws/webrtc
NEXT_PUBLIC_ROBOT_ROOM_ID=robot_default

프론트, 백 둘 다 로컬일 경우
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

프론트 Vercel, 백 EC2일 경우
NEXT_PUBLIC_API_BASE_URL=https://i14b201.p.ssafy.io


## 3. 실행
### 프론트, 백 둘 다 로컬일 경우 (웹만 가능)
`cd Frontend` 후

`npm install`<br>
`npm run build -- --webpack`<br>
`npm run start` 한 후

`http://localhost:3000` 접속


### 프론트는 Vercel, 백은 EC2인 경우 (웹, 모바일 모두 가능)
`vercel --prod`
실행 후 나오는 Preview url 접속