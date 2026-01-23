package com.ssafy.backend.domain.device.application;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class JetsonStatusService {

    private final String EMQX_API_URL = "http://localhost:18083/api/v5/clients/";

    public boolean isJetsonOnline(String clientId) {
        RestTemplate restTemplate = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth("bdad3b84eb0fec45", "BlodPLv9BiKEPkJrImPhYzlgwc0I8tgDPBoxHa0sczIF");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    EMQX_API_URL + clientId, HttpMethod.GET, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                Map body = response.getBody();
                System.out.println(body);
                return (boolean) body.get("connected");
            }
        } catch (HttpClientErrorException.NotFound e) {
            // 404 에러 발생 시: 클라이언트 정보가 없으므로 오프라인(false) 반환
            System.out.println("EMQX: 해당 클라이언트를 찾을 수 없습니다 (Offline 처리): " + clientId);
            return false;
        } catch (HttpClientErrorException.Unauthorized e) {
            System.out.println("EMQX: 권한을 확인해 주세요");
            return false;
        }
        catch (Exception e) {
            System.err.println("EMQX API 호출 중 에러 발생: " + e.getMessage());
            e.printStackTrace(); // 상세 에러 원인 출력
            return false;
        }
        return false;
    }
}