package com.ssafy.backend.domain.car.ws;

public interface CarStatusWsBroadcaster {
    void broadcastToRoom(String roomId, String jsonPayload);
}
