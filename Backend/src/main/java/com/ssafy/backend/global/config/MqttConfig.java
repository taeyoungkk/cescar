package com.ssafy.backend.global.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.IntegrationComponentScan;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.channel.PublishSubscribeChannel;
import org.springframework.integration.config.EnableIntegration;
import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import java.nio.charset.StandardCharsets;

@Slf4j
@Configuration
@EnableIntegration
@IntegrationComponentScan(basePackages = "com.ssafy.backend")
public class MqttConfig {

    @Value("${mqtt.broker.url}")
    private String brokerUrl;

    @Value("${mqtt.username}")
    private String username;

    @Value("${mqtt.password}")
    private String password;

    @Value("${mqtt.inbound.topic}")
    private String inboundTopic;

    private MqttClient mqttClient;
    private MqttClient outClient;

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        return mapper;
    }

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new PublishSubscribeChannel();
    }

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    private MqttConnectOptions getMqttConnectOptions() {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setUserName(username);
        options.setPassword(password.toCharArray());
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setKeepAliveInterval(60);
        return options;
    }

    @PostConstruct
    public void initMqttClient() throws MqttException {
        String clientId = "DirectPaho_" + System.currentTimeMillis();
        mqttClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());

        mqttClient.setCallback(new MqttCallback() {
            @Override
            public void connectionLost(Throwable cause) {
                log.error("❌ MQTT Connection Lost: {}", cause.getMessage());
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                Message<byte[]> springMessage = MessageBuilder.withPayload(message.getPayload())
                        .setHeader("mqtt_receivedTopic", topic)
                        .build();

                // 1. 페이로드를 byte[]에서 String으로 변환 (인코딩 주의)
                String payloadString = new String((byte[]) springMessage.getPayload(), StandardCharsets.UTF_8);

// 2. 헤더 정보 가져오기
                String receivedTopic = (String) springMessage.getHeaders().get("mqtt_receivedTopic");

// 3. 로그 출력 (f-string 스타일이 아니므로 + 결합 또는 printf 사용)
                System.out.println("==========================================");
                System.out.println("📬 Spring Message Arrived!");
                System.out.println("📍 Topic: " + receivedTopic);
                System.out.println("📝 Payload: " + payloadString);
                System.out.println("⚙️ Headers: " + springMessage.getHeaders());
                System.out.println("==========================================");

                mqttInboundChannel().send(springMessage);
                log.debug("📬 [MQTT -> CHANNEL] Forwarded: {}", topic);
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
            }
        });
        System.out.println(inboundTopic);
        mqttClient.connect(getMqttConnectOptions());
        mqttClient.subscribe(inboundTopic, 0);

        log.info("🔥 [MQTT] Inbound Client Started (ID: {}, Topic: {})", clientId, inboundTopic);
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() throws MqttException {
        String clientId = "SpringOut_" + System.currentTimeMillis();
        outClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());
        outClient.connect(getMqttConnectOptions());

        log.info("🚀 [MQTT] Outbound Client Started (ID: {})", clientId);

        return message -> {
            try {
                String topic = (String) message.getHeaders().get("mqtt_topic");
                if (topic == null)
                    topic = "default/topic";

                MqttMessage mqttMessage = new MqttMessage(message.getPayload().toString().getBytes());
                mqttMessage.setQos(0);
                outClient.publish(topic, mqttMessage);
            } catch (Exception e) {
                log.error("❌ MQTT Publish Failed", e);
            }
        };
    }

    @PreDestroy
    public void cleanup() {
        try {
            if (mqttClient != null && mqttClient.isConnected()) {
                mqttClient.disconnect();
                mqttClient.close();
            }
            if (outClient != null && outClient.isConnected()) {
                outClient.disconnect();
                outClient.close();
            }
        } catch (MqttException e) {
            log.error("❌ MQTT Cleanup Failed", e);
        }
    }
}