package com.ssafy.backend.domain.detection.ws;

public interface DetectionWsBroadcaster {
    void broadcastToRoom(String roomId, String jsonPayload);
}
