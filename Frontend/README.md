<!-- 1. npm install
2. npm run dev -- --webpack -->

# 실행 방법

## (웹에서 실행)
`npm run build -- --webpack`<br>
`npm run start` 한 후

`http://localhost:3000` 접속


## (모바일에서 실행)
powershell(관리자) 에서<br>
`winget install Cloudflare.cloudflared`

돌아와서<br>
`cloudflared tunnel --url http://localhost:3000`<br>
실행 후, 로그에서

`https://light-salem-bringing-morrison.trycloudflare.com`<br>
이런 형태의 url 찾고(`trycloudflare.com` 으로 끝나는 url), 해당 url을 모바일 크롬에 그대로 적어서 접속