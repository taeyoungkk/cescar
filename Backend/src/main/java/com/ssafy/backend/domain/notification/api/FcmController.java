package com.ssafy.backend.domain.notification.api;

import com.ssafy.backend.domain.notification.application.FcmService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notification")
@CrossOrigin("*")
public class FcmController {

    private final FcmService fcmService;

    public FcmController(FcmService fcmService) {
        this.fcmService = fcmService;
    }

    // 클라이언트로부터 토큰을 받아 등록
    @PostMapping("/register")
    public String registerToken(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        fcmService.registerToken(token);
        return "토큰 등록 완료";
    }

    // 수동 테스트용
    @PostMapping("/test")
    public String sendTestNotification(@RequestParam String token, @RequestParam String title,
            @RequestParam String body) {
        fcmService.sendMessage(token, title, body);
        return "전송 요청 완료";
    }

    // 전체 발송 테스트용
    @GetMapping("/test-all")
    public String sendAllTestNotification() {
        fcmService.broadcastMessage("테스트 전체 알림", "서버에서 보낸 전체 공지입니다! 🚀");
        return "전체 전송 요청 완료";
    }
}