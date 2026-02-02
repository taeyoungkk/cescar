package com.ssafy.backend.global.config;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.beans.factory.annotation.Value;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
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
@RequiredArgsConstructor
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
        String clientId = "SpringIn_" + System.currentTimeMillis();
        mqttClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());

        mqttClient.setCallback(new MqttCallback() {
            @Override
            public void connectionLost(Throwable cause) {
                log.error("[MQTT] Connection Lost: {}", cause.getMessage());
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) {
                try {
                    Message<byte[]> springMessage = MessageBuilder.withPayload(message.getPayload())
                            .setHeader("mqtt_receivedTopic", topic)
                            .build();

                    String payloadString = new String((byte[]) springMessage.getPayload(), StandardCharsets.UTF_8);
                    String receivedTopic = (String) springMessage.getHeaders().get("mqtt_receivedTopic");

                    System.out.println("==========================================");
                    System.out.println("[MQTT] Spring Message Arrived!");
                    System.out.println("[MQTT] Topic: " + receivedTopic);
                    System.out.println("[MQTT] Payload: " + payloadString);
                    System.out.println("[MQTT] Headers: " + springMessage.getHeaders());
                    System.out.println("==========================================");

                    mqttInboundChannel().send(springMessage);
                    log.debug("[MQTT -> CHANNEL] Forwarded: {}", topic);

                } catch (Exception e) {
                    log.error("Error processing MQTT message", e);
                }
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
            }
        });

        mqttClient.connect(getMqttConnectOptions());

        if (inboundTopic != null && !inboundTopic.isBlank()) {
            mqttClient.subscribe(inboundTopic, 0);
        }
        log.info("[MQTT] Client Started. ID: {}, Subscribed to: {}", clientId, inboundTopic);
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel")
    public MessageHandler mqttOutbound() throws MqttException {
        String clientId = "SpringOut_" + System.currentTimeMillis();
        outClient = new MqttClient(brokerUrl, clientId, new MemoryPersistence());
        outClient.connect(getMqttConnectOptions());

        log.info("[MQTT] Outbound Client Started (ID: {})", clientId);

        return message -> {
            try {
                String topic = (String) message.getHeaders().get("mqtt_topic");
                if (topic == null) {
                    topic = "robot/command";
                }

                MqttMessage mqttMessage = new MqttMessage(message.getPayload().toString().getBytes());
                mqttMessage.setQos(0);
                outClient.publish(topic, mqttMessage);
            } catch (Exception e) {
                log.error("[MQTT] Publish Failed", e);
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
            log.error("[MQTT] Cleanup Failed", e);
        }
    }
}
