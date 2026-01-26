package com.ssafy.backend.global.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.IntegrationComponentScan;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.config.EnableIntegration;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Configuration
@EnableIntegration
@IntegrationComponentScan(basePackages = "com.ssafy.backend")
public class MqttConfig {

    private MqttClient mqttClient;

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        return mapper;
    }

    @PostConstruct
    public void initMqttClient() throws MqttException {
        String clientId = "DirectPaho_" + System.currentTimeMillis();
        String broker = "tcp://localhost:1883";

        mqttClient = new MqttClient(broker, clientId, new MemoryPersistence());

        MqttConnectOptions options = new MqttConnectOptions();
        options.setUserName("spring_client");
        options.setPassword("qwer1234".toCharArray());
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setKeepAliveInterval(60);

        mqttClient.setCallback(new MqttCallback() {
            @Override
            public void connectionLost(Throwable cause) {
                System.err.println("❌ MQTT 연결 끊김: " + cause.getMessage());
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                System.out.println("\n🎯 ========== DIRECT PAHO MESSAGE ==========");
                System.out.println("📍 Topic: " + topic);
                System.out.println("📦 Payload: " + new String(message.getPayload()));
                System.out.println("📊 QoS: " + message.getQos());
                System.out.println("🎯 ==========================================\n");
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
                // 송신 완료 시 호출
            }
        });

        mqttClient.connect(options);
        mqttClient.subscribe("robot/#", 0);

        System.out.println("\n🔥 [DIRECT PAHO] MQTT 클라이언트 직접 연결 성공!");
        System.out.println("✅ Client ID: " + clientId);
        System.out.println("✅ Subscribed: robot/#");
        System.out.println("===========================================\n");
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
            e.printStackTrace();
        }
    }

    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    private MqttClient outClient;

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() throws MqttException {
        String clientId = "spring-out-" + System.currentTimeMillis();
        outClient = new MqttClient("tcp://localhost:1883", clientId, new MemoryPersistence());

        MqttConnectOptions options = new MqttConnectOptions();
        options.setUserName("spring_client");
        options.setPassword("qwer1234".toCharArray());
        options.setCleanSession(true);

        outClient.connect(options);

        return message -> {
            try {
                String topic = (String) message.getHeaders().get("mqtt_topic");
                if (topic == null)
                    topic = "default/topic";

                MqttMessage mqttMessage = new MqttMessage(message.getPayload().toString().getBytes());
                mqttMessage.setQos(0);
                outClient.publish(topic, mqttMessage);
            } catch (Exception e) {
                e.printStackTrace();
            }
        };
    }
}