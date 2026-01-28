# 실행 방법

## Frontend 폴더 안에 .env.local 파일 추가 후 아래 내용 복붙
`NEXT_PUBLIC_SIGNALING_URL=ws://I14B201.p.ssafy.io/ws/webrtc`
`NEXT_PUBLIC_ROBOT_ROOM_ID=robot_default`
(프론트도 EC2에 올라갔다면)
`NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`

(아니라면)
`NEXT_PUBLIC_API_BASE_URL=http://3.35.235.49:8080`


## (웹에서 실행)
`cd Frontend` 후

`npm install`<br>
`npm run build -- --webpack`<br>
`npm run start` 한 후

`http://localhost:3000` 접속


<!-- ## (모바일에서 실행) -> 이거 지금 안됨
powershell(관리자) 에서<br>
`winget install Cloudflare.cloudflared`

돌아와서<br>
`cloudflared tunnel --url http://localhost:3000`<br>
실행 후, 로그에서

`https://light-salem-bringing-morrison.trycloudflare.com`<br>
이런 형태의 url 찾고(`trycloudflare.com` 으로 끝나는 url), 해당 url을 모바일 크롬에 그대로 적어서 접속 -->