package com.ssafy.backend.domain.device.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class DeviceStatusRequest {
    private Double cpu_usage;
    private MemoryInfo memory;
    private DiskInfo disk;
    private Double temperature;
    private GpuInfo gpu;
    private BatteryInfo battery;

    @Getter
    @ToString
    public static class MemoryInfo {
        private Long total;
        private Long available;
        private Double percent;
    }

    @Getter
    @ToString
    public static class DiskInfo {
        private Long total;
        private Long used;
        private Double percent;
    }

    @Getter
    @ToString
    public static class GpuInfo {
        private Integer usage;
        private Double temp;
    }

    @Getter
    @ToString
    public static class BatteryInfo {
        private Integer percent;
        private Boolean power_plugged;
        private Long secsleft;
        private String note;
    }
}
