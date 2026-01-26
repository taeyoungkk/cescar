package com.ssafy.backend.global.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
// Spring Core & Context
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Spring Integration Core
import org.springframework.integration.annotation.IntegrationComponentScan;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.channel.PublishSubscribeChannel;
import org.springframework.integration.config.EnableIntegration;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

// Spring Integration MQTT
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.outbound.MqttPahoMessageHandler;

@Configuration
@EnableIntegration
// MqttGateway 인터페이스가 있는 패키지 경로를 정확히 입력하세요.
@IntegrationComponentScan(basePackages = "com.ssafy.backend.infrastructure.mqtt")
public class MqttConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // 1. 날짜/시간 관련 데이터를 제대로 처리하기 위한 모듈 등록 (필수!)
        mapper.registerModule(new JavaTimeModule());

        // 2. JSON에는 데이터가 있는데 DTO에는 해당 필드가 없어도 에러 내지 않도록 설정
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        return mapper;
    }

    // 1. 메시지 통로 (Channel) 정의
    @Bean
    public MessageChannel mqttOutboundChannel() {
        return new DirectChannel();
    }

    // 2. MQTT 연결 설정 (Factory)
    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();

        // EMQX 브로커 주소 (Docker로 띄운 경우 localhost:1883)
        options.setServerURIs(new String[] { "tcp://localhost:1883" });
        options.setUserName("bdad3b84eb0fec45"); // API Key와 별개로 MQTT 계정이 있다면 입력
        options.setPassword("BlodPLv9BiKEPkJrImPhYzlgwc0I8tgDPBoxHa0sczIF".toCharArray());
        options.setCleanSession(true);
        options.setKeepAliveInterval(60);

        factory.setConnectionOptions(options);
        return factory;
    }

    // 3. 메시지 핸들러 (실제로 브로커에 전송하는 역할)
    @Bean
    @ServiceActivator(inputChannel = "mqttOutboundChannel") // 위에서 만든 채널과 연결
    public MessageHandler mqttOutbound() {
        // "spring-server-out"은 브로커에서 식별할 클라이언트 ID입니다.
        MqttPahoMessageHandler messageHandler = new MqttPahoMessageHandler("spring-server-out", mqttClientFactory());

        messageHandler.setAsync(true);
        messageHandler.setDefaultTopic("jetson/command"); // 기본 토픽 설정
        return messageHandler;
    }

    @Bean
    public MessageChannel mqttInboundChannel() {
        return new PublishSubscribeChannel();
    }

    @Bean
    public MessageProducer inbound() {
        // "robot/+/status"와 "robot/+/detection" 모두 구독
        MqttPahoMessageDrivenChannelAdapter adapter = new MqttPahoMessageDrivenChannelAdapter("serverClient",
                mqttClientFactory(),
                "robot/+/status", "robot/+/detection", "robot/robot-01/detection", "robot/robot-01/status");
        adapter.setCompletionTimeout(5000);
        adapter.setConverter(new DefaultPahoMessageConverter());
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInboundChannel()); // 이제 서비스에서 이 채널을 구독합니다.
        return adapter;
    }
}