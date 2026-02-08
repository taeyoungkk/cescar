"""
ROS2 LiDAR Subscriber for Jetson

YDLidar 드라이버에서 발행하는 /scan 토픽을 구독하여
patrol_service에 데이터 전달.
"""

import math
import threading
from typing import Optional, Callable, List
from dataclasses import dataclass

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy, DurabilityPolicy
from sensor_msgs.msg import LaserScan


@dataclass
class ScanData:
    """LiDAR 스캔 데이터 구조"""
    timestamp: float
    ranges: List[float]
    angle_min: float
    angle_max: float
    angle_increment: float
    range_min: float
    range_max: float


class LidarSubscriberNode(Node):
    """
    ROS2 LiDAR Subscriber Node.
    YDLidar 드라이버에서 발행하는 /scan 토픽을 구독합니다.
    """
    
    def __init__(self, node_name: str = 'jetson_lidar_subscriber'):
        super().__init__(node_name)
        
        self._latest_scan: Optional[ScanData] = None
        self._lock = threading.Lock()
        self._callbacks: List[Callable[[ScanData], None]] = []
        self._scan_count = 0
        
        # QoS 설정 (LiDAR 센서에 맞춤 - Best Effort 권장)
        qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=5,
            durability=DurabilityPolicy.VOLATILE
        )
        
        # Subscriber
        self._scan_sub = self.create_subscription(
            LaserScan,
            '/scan',
            self._scan_callback,
            qos
        )
        
        self.get_logger().info('LidarSubscriber initialized - waiting for /scan')
    
    def _scan_callback(self, msg: LaserScan) -> None:
        """LaserScan 메시지 수신 콜백"""
        try:
            # 타임스탬프 추출
            timestamp = msg.header.stamp.sec + msg.header.stamp.nanosec / 1e9
            
            scan = ScanData(
                timestamp=timestamp,
                ranges=list(msg.ranges),
                angle_min=msg.angle_min,
                angle_max=msg.angle_max,
                angle_increment=msg.angle_increment,
                range_min=msg.range_min,
                range_max=msg.range_max
            )
            
            with self._lock:
                self._latest_scan = scan
                self._scan_count += 1
            
            # 등록된 콜백 호출 (patrol_service 등)
            for callback in self._callbacks:
                try:
                    callback(scan)
                except Exception as e:
                    self.get_logger().error(f'Scan callback error: {e}')
            
            # 500번마다 로그 출력
            if self._scan_count % 500 == 0:
                self.get_logger().info(
                    f'Scan #{self._scan_count}: {len(scan.ranges)} points, '
                    f'angle=[{math.degrees(scan.angle_min):.1f}, {math.degrees(scan.angle_max):.1f}]'
                )
                
        except Exception as e:
            self.get_logger().error(f'Scan processing error: {e}')
    
    def get_latest_scan(self) -> Optional[ScanData]:
        """최신 스캔 데이터 반환"""
        with self._lock:
            return self._latest_scan
    
    def register_callback(self, callback: Callable[[ScanData], None]) -> None:
        """스캔 수신 시 호출될 콜백 등록 (patrol_service용)"""
        self._callbacks.append(callback)
        self.get_logger().info(f'Scan callback registered. Total: {len(self._callbacks)}')
    
    def unregister_callback(self, callback: Callable[[ScanData], None]) -> None:
        """콜백 등록 해제"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def is_data_available(self) -> bool:
        """스캔 데이터가 수신된 적 있는지"""
        with self._lock:
            return self._latest_scan is not None
    
    def get_stats(self) -> dict:
        """통계 정보"""
        with self._lock:
            return {
                "scan_count": self._scan_count,
                "data_available": self._latest_scan is not None,
                "last_timestamp": self._latest_scan.timestamp if self._latest_scan else None,
            }


# 싱글톤 인스턴스 (ROS2 초기화 후에 사용)
_lidar_node: Optional[LidarSubscriberNode] = None
_spin_thread: Optional[threading.Thread] = None


def get_lidar_node() -> Optional[LidarSubscriberNode]:
    """LidarSubscriberNode 인스턴스 반환"""
    return _lidar_node


def init_lidar_node() -> LidarSubscriberNode:
    """
    LidarSubscriberNode 초기화 및 spin 시작
    
    Returns:
        초기화된 LidarSubscriberNode
    """
    global _lidar_node, _spin_thread
    
    if _lidar_node is not None:
        return _lidar_node
    
    # ROS2 초기화 (이미 되어있으면 무시)
    if not rclpy.ok():
        rclpy.init()
    
    _lidar_node = LidarSubscriberNode()
    
    # patrol_service 연결
    from app.services.patrol_service import patrol_service
    
    def on_scan(scan: ScanData):
        """스캔 데이터를 patrol_service로 전달"""
        patrol_service.process_lidar_scan(
            ranges=scan.ranges,
            angle_min=scan.angle_min,
            angle_increment=scan.angle_increment
        )
    
    _lidar_node.register_callback(on_scan)
    
    # 백그라운드 스레드에서 spin
    def spin_thread():
        try:
            rclpy.spin(_lidar_node)
        except Exception as e:
            print(f"[LiDAR] Spin error: {e}")
    
    _spin_thread = threading.Thread(target=spin_thread, daemon=True)
    _spin_thread.start()
    
    print("[LiDAR] Subscriber initialized and spinning")
    return _lidar_node


def shutdown_lidar_node():
    """LiDAR 노드 종료"""
    global _lidar_node, _spin_thread
    
    if _lidar_node is not None:
        _lidar_node.destroy_node()
        _lidar_node = None
    
    _spin_thread = None


def main(args=None):
    """테스트용 메인"""
    rclpy.init(args=args)
    
    node = LidarSubscriberNode()
    
    print("[*] Waiting for /scan messages...")
    print("[*] Make sure YDLidar driver is running:")
    print("[*]   ros2 launch ydlidar_ros2_driver ydlidar_launch.py")
    print()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
