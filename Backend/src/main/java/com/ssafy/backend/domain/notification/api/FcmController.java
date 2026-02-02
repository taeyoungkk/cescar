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

    @Operation(summary = "FCM token register",
            description = "Registers a FCM token for the authenticated member.")

    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Token registered"),
            @ApiResponse(responseCode = "400", description = "Invalid request"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })

    @PostMapping("/register")
    public Map<String, Object> registerToken(@RequestBody Map<String, String> request,
                                             @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        String token = request.get("token");
        fcmService.registerToken(memberId, token);
        return Map.of("success", true, "message", "token registered");
    }


    @Operation(summary = "FCM token unregister",
            description = "Unregisters a FCM token for the authenticated member.")

    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Token unregistered")
    })

    @PostMapping("/unregister")
    public Map<String, Object> unregisterToken(@RequestBody Map<String, String> request,
                                               @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        String token = request.get("token");
        fcmService.removeToken(memberId, token);
        return Map.of("success", true, "message", "token unregistered");
    }

    @Operation(summary = "FCM test send",
            description = "Sends a test notification to a single token. Use only in non-production.")

    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Send requested")
    })

    @PostMapping("/test")
    public Map<String, Object> sendTestNotification(@RequestParam String token,
                                                    @RequestParam String title,
                                                    @RequestParam String body) {
        fcmService.sendMessage(token, title, body);
        return Map.of("success", true, "message", "send requested");
    }

    @Operation(summary = "FCM test broadcast",
            description = "Broadcasts a test notification to all tokens. Use only in non-production.")

    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Broadcast requested")
    })

    @GetMapping("/test-all")
    public Map<String, Object> sendAllTestNotification() {
        fcmService.broadcastMessage("Test broadcast", "This is a test broadcast message.");
        return Map.of("success", true, "message", "broadcast requested");
    }
}
