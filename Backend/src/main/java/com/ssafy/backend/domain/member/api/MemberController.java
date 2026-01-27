package com.ssafy.backend.domain.member.api;

import com.ssafy.backend.domain.car.dto.CarResponse;
import com.ssafy.backend.domain.member.application.MemberService;
import com.ssafy.backend.domain.member.dto.MemberRequest;
import com.ssafy.backend.domain.member.dto.MemberResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Member", description = "회원 관리 API")
@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    /**
     * 1️⃣ 회원가입 API
     * - 이메일/비밀번호/이름/닉네임으로 회원 등록
     * - 중복 이메일은 예외 처리
     */
    @Operation(summary = "회원가입", description = "새로운 회원을 등록합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "성공"),
            @ApiResponse(responseCode = "400", description = "잘못된 입력값"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 이메일")
    })
    @PostMapping("/signup")
    public ResponseEntity<MemberResponse.MemberInfoResponse> signup(
            @Valid @RequestBody MemberRequest.SignupRequest request) {
        MemberResponse.MemberInfoResponse response = memberService.signup(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 2️⃣ 기본 로그인 API
     * - 이메일/비밀번호로 로그인
     * - 로그인 성공 시 JWT 발급
     */
    @Operation(summary = "로그인", description = "이메일과 비밀번호로 로그인합니다.")
    @PostMapping("/login")
    public ResponseEntity<MemberResponse.LoginResponse> login(@Valid @RequestBody MemberRequest.LoginRequest request) {
        MemberResponse.LoginResponse response = memberService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * 3️⃣ 내 정보 조회 API
     * - 현재 로그인한 회원 정보 조회
     */
    @Operation(summary = "내 정보 조회", description = "현재 로그인한 회원의 정보를 조회합니다.")
    @GetMapping("/me")
    public ResponseEntity<MemberResponse.MemberInfoResponse> getMyInfo(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        MemberResponse.MemberInfoResponse response = memberService.getMyInfo(memberId);
        return ResponseEntity.ok(response);
    }

    /**
     * 4️⃣ 회원 정보 수정 API
     * - 이름/닉네임 수정
     */
    @Operation(summary = "회원 정보 수정", description = "이름, 닉네임 등 회원 정보를 수정합니다.")
    @PatchMapping("/me")
    public ResponseEntity<MemberResponse.MemberInfoResponse> updateMember(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Valid @RequestBody MemberRequest.UpdateMemberRequest request) {
        MemberResponse.MemberInfoResponse response = memberService.updateMember(memberId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * 5️⃣ 회원 탈퇴 API
     * - 회원 계정 삭제
     * - 소유 차량 연동 해제
     */
    @Operation(summary = "회원 탈퇴", description = "회원 계정을 삭제하고 연동된 차량 정보를 정리합니다.")
    @DeleteMapping("/me")
    public ResponseEntity<CarResponse.SuccessResponse> withdraw(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
        memberService.withdraw(memberId);
        return ResponseEntity.ok(CarResponse.SuccessResponse.of("회원 탈퇴가 완료되었습니다."));
    }
}
