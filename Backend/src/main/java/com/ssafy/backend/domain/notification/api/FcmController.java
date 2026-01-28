package com.ssafy.backend.domain.notification.api;

import com.ssafy.backend.domain.notification.application.FcmService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notification")
public class FcmController {

    private final FcmService fcmService;

    public FcmController(FcmService fcmService) {
        this.fcmService = fcmService;
    }

    @PostMapping("/test")
    public String sendTestNotification(@RequestParam String token, @RequestParam String title,
            @RequestParam String body) {
        System.out.println(token);
        fcmService.sendMessage(token, title, body);
        return "전송 요청 완료";
    }
}