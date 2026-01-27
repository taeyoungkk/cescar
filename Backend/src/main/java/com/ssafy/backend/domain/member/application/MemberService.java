package com.ssafy.backend.domain.member.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.member.dto.MemberRequest;
import com.ssafy.backend.domain.member.dto.MemberResponse;
import com.ssafy.backend.global.auth.JwtTokenProvider;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final CarRepository carRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * 회원가입 로직
     */
    @Transactional
    public MemberResponse.MemberInfoResponse signup(MemberRequest.SignupRequest request) {
        if (memberRepository.findByEmail(request.email()).isPresent()) {
            throw new CustomException(ErrorCode.ALREADY_REGISTERED_MEMBER);
        }

        Member member = Member.create(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.name(),
                request.nickname());

        Member savedMember = memberRepository.save(member);
        return MemberResponse.MemberInfoResponse.from(savedMember);
    }

    /**
     * 기본 로그인
     */
    @Transactional(readOnly = true)
    public MemberResponse.LoginResponse login(MemberRequest.LoginRequest request) {
        Member member = memberRepository.findByEmail(request.email())
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new CustomException(ErrorCode.WRONG_PASSWORD);
        }

        String accessToken = jwtTokenProvider.createAccessToken(member.getId(), member.getEmail());
        return MemberResponse.LoginResponse.of(accessToken, member);
    }

    /**
     * 내 정보 조회
     */
    @Transactional(readOnly = true)
    public MemberResponse.MemberInfoResponse getMyInfo(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));
        return MemberResponse.MemberInfoResponse.from(member);
    }

    /**
     * 회원 정보 수정
     */
    @Transactional
    public MemberResponse.MemberInfoResponse updateMember(Long memberId, MemberRequest.UpdateMemberRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        member.update(request.name(), request.nickname());

        return MemberResponse.MemberInfoResponse.from(member);
    }

    /**
     * 비밀번호 변경
     */
    @Transactional
    public void changePassword(Long memberId, MemberRequest.ChangePasswordRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (!passwordEncoder.matches(request.currentPassword(), member.getPassword())) {
            throw new CustomException(ErrorCode.WRONG_PASSWORD);
        }

        if (request.currentPassword().equals(request.newPassword())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE, "새 비밀번호는 기존 비밀번호와 달라야 합니다.");
        }

        if (!request.newPassword().equals(request.newPasswordConfirm())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE, "새 비밀번호 확인이 일치하지 않습니다.");
        }

        member.changePassword(passwordEncoder.encode(request.newPassword()));
    }

    /**
     * 회원 탈퇴
     */
    @Transactional
    public void withdraw(Long memberId, MemberRequest.WithdrawRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new CustomException(ErrorCode.WRONG_PASSWORD);
        }

        carRepository.findAll().stream()
                .filter(car -> car.getOwner() != null && car.getOwner().getId().equals(memberId))
                .forEach(car -> car.releaseOwner(member));

        memberRepository.delete(member);
    }
}
