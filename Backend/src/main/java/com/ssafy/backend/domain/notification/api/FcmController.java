package com.ssafy.backend.domain.notification.api;

import com.ssafy.backend.domain.notification.application.FcmService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    @Operation(summary = "FCM 토큰 등록",
            description = "로그인된 사용자의 FCM 토큰을 등록합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "토큰 등록 완료"),
            @ApiResponse(responseCode = "400", description = "요청 값 오류"),
            @ApiResponse(responseCode = "401", description = "인증 실패")
    })
    @PostMapping("/register")
    public String registerToken(@RequestBody Map<String, String> request,
                                @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        String token = request.get("token");
        fcmService.registerToken(memberId, token);
        return "토큰 등록 완료";
    }

    // FCM 토큰 삭제
    @Operation(summary = "FCM 토큰 삭제",
            description = "로그인된 사용자의 FCM 토큰을 삭제합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "토큰 삭제 완료")
    })
    @PostMapping("/unregister")
    public String unregisterToken(@RequestBody Map<String, String> request,
                                  @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        String token = request.get("token");
        fcmService.removeToken(memberId, token);
        return "토큰 삭제 완료";
    }

    // 수동 테스트용
    @Operation(summary = "FCM 토큰 단일 전송(테스트)",
            description = "지정한 토큰으로 알림을 전송합니다. 실제 FCM 토큰이 필요합니다. 운영에서는 비추천.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "전송 요청 완료")
    })
    @PostMapping("/test")
    public String sendTestNotification(@RequestParam String token, @RequestParam String title,
                                       @RequestParam String body) {
        fcmService.sendMessage(token, title, body);
        return "전송 요청 완료";
    }

    // 전체 전송 테스트용
    @Operation(summary = "전체 FCM 브로드캐스트(테스트)",
            description = "등록된 모든 토큰으로 테스트 알림을 전송합니다. 실제 FCM 토큰이 필요합니다. 운영에서는 비추천.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "전체 전송 요청 완료")
    })
    @GetMapping("/test-all")
    public String sendAllTestNotification() {
        fcmService.broadcastMessage("테스트 전체 알림", "서버에서 보낸 전체 공지입니다! 🚀");
        return "전체 전송 요청 완료";
    }
}