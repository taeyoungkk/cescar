package com.ssafy.backend.domain.member.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 회원 관련 요청 DTO
 */
public class MemberRequest {

    /**
     * 회원 가입 요청 (POST /api/members/signup)
     */
    public record SignupRequest(
            @NotBlank(message = "이메일은 필수입니다.") @Email(message = "올바른 이메일 형식이 아닙니다.") String email,

            @NotBlank(message = "비밀번호는 필수입니다.")
            @Size(min = 8, message = "비밀번호는 최소 8자 이상이어야 합니다.")
            @Pattern(
                    regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
                    message = "비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
            )
            String password,

            @NotBlank(message = "이름은 필수입니다.") String name,

            @NotBlank(message = "닉네임은 필수입니다.") String nickname) {
    }

    /**
     * 로그인 요청 (POST /api/members/login)
     */
    public record LoginRequest(
            @NotBlank(message = "이메일은 필수입니다.") String email,

            @NotBlank(message = "비밀번호는 필수입니다.") String password) {
    }

    /**
     * 회원 정보 수정 요청 (PATCH /api/members/me)
     */
    public record UpdateMemberRequest(
            String name,
            String nickname) {
    }

    /**
     * 비밀번호 변경 요청 (PATCH /api/members/me/password)
     */
    public record ChangePasswordRequest(
            @NotBlank(message = "현재 비밀번호는 필수입니다.") String currentPassword,

            @NotBlank(message = "새 비밀번호는 필수입니다.")
            @Size(min = 8, message = "새 비밀번호는 최소 8자 이상이어야 합니다.")
            @Pattern(
                    regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
                    message = "새 비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다."
            )
            String newPassword,

            @NotBlank(message = "새 비밀번호 확인은 필수입니다.") String newPasswordConfirm) {
    }

    /**
     * 회원 탈퇴 요청 (DELETE /api/members/me)
     */
    public record WithdrawRequest(
            @NotBlank(message = "비밀번호는 필수입니다.") String password) {
    }
}
