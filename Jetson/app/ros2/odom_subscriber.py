"""
ROS2 Odometry Subscriber for Jetson
Pi에서 ROS2로 발행하는 /odom 토픽을 구독하여 SLAM에서 사용.
"""
import math
import threading
from dataclasses import dataclass
from typing import Optional, Callable, List

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from nav_msgs.msg import Odometry


@dataclass
class OdomData:
    """Odometry 데이터 구조"""
    timestamp: float
    x: float        # 위치 x (m)
    y: float        # 위치 y (m)
    theta: float    # 방향 yaw (rad)
    v: float        # 선속도 (m/s)
    w: float        # 각속도 (rad/s)


def quaternion_to_yaw(q) -> float:
    """쿼터니언에서 yaw 각도 추출"""
    # yaw = atan2(2*(w*z + x*y), 1 - 2*(y^2 + z^2))
    siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
    cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
    return math.atan2(siny_cosp, cosy_cosp)


class OdomSubscriberNode(Node):
    """
    ROS2 Odometry Subscriber Node.
    Pi에서 발행하는 /odom 토픽을 구독합니다.
    """
    
    def __init__(self, node_name: str = 'jetson_odom_subscriber'):
        super().__init__(node_name)
        
        self._latest_odom: Optional[OdomData] = None
        self._lock = threading.Lock()
        self._callbacks: List[Callable[[OdomData], None]] = []
        self._odom_count = 0
        
        # QoS 설정 (Pi와 맞춤)
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        
        # Subscriber
        self._odom_sub = self.create_subscription(
            Odometry,
            '/odom',
            self._odom_callback,
            qos
        )
        
        self.get_logger().info('OdomSubscriber initialized - waiting for /odom')
    
    def _odom_callback(self, msg: Odometry) -> None:
        """Odometry 메시지 수신 콜백"""
        try:
            # 타임스탬프 추출
            timestamp = msg.header.stamp.sec + msg.header.stamp.nanosec / 1e9
            
            # 쿼터니언에서 yaw 추출
            theta = quaternion_to_yaw(msg.pose.pose.orientation)
            
            odom = OdomData(
                timestamp=timestamp,
                x=msg.pose.pose.position.x,
                y=msg.pose.pose.position.y,
                theta=theta,
                v=msg.twist.twist.linear.x,
                w=msg.twist.twist.angular.z,
            )
            
            with self._lock:
                self._latest_odom = odom
                self._odom_count += 1
            
            # 등록된 콜백 호출 (SLAM 등)
            for callback in self._callbacks:
                try:
                    callback(odom)
                except Exception as e:
                    self.get_logger().error(f'Odom callback error: {e}')
            
            # 100번마다 로그 출력
            if self._odom_count % 100 == 0:
                self.get_logger().info(
                    f'Odom #{self._odom_count}: x={odom.x:.3f}, y={odom.y:.3f}, '
                    f'theta={odom.theta:.3f}'
                )
                
        except Exception as e:
            self.get_logger().error(f'Odom processing error: {e}')
    
    def get_latest_odom(self) -> Optional[OdomData]:
        """최신 odom 데이터 반환"""
        with self._lock:
            return self._latest_odom
    
    def get_position(self) -> tuple:
        """현재 위치 (x, y, theta) 반환"""
        with self._lock:
            if self._latest_odom:
                return (
                    self._latest_odom.x,
                    self._latest_odom.y,
                    self._latest_odom.theta
                )
            return (0.0, 0.0, 0.0)
    
    def get_velocity(self) -> tuple:
        """현재 속도 (v, w) 반환"""
        with self._lock:
            if self._latest_odom:
                return (self._latest_odom.v, self._latest_odom.w)
            return (0.0, 0.0)
    
    def register_callback(self, callback: Callable[[OdomData], None]) -> None:
        """odom 수신 시 호출될 콜백 등록 (SLAM용)"""
        self._callbacks.append(callback)
        self.get_logger().info(f'Callback registered. Total: {len(self._callbacks)}')
    
    def unregister_callback(self, callback: Callable[[OdomData], None]) -> None:
        """콜백 등록 해제"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def is_data_available(self) -> bool:
        """odom 데이터가 수신된 적 있는지"""
        with self._lock:
            return self._latest_odom is not None
    
    def get_stats(self) -> dict:
        """통계 정보"""
        with self._lock:
            return {
                "odom_count": self._odom_count,
                "data_available": self._latest_odom is not None,
                "last_timestamp": self._latest_odom.timestamp if self._latest_odom else None,
            }


# 싱글톤 인스턴스 (ROS2 초기화 후에 사용)
_odom_node: Optional[OdomSubscriberNode] = None


def get_odom_node() -> Optional[OdomSubscriberNode]:
    """OdomSubscriberNode 인스턴스 반환"""
    return _odom_node


def init_odom_node() -> OdomSubscriberNode:
    """OdomSubscriberNode 초기화"""
    global _odom_node
    if _odom_node is None:
        _odom_node = OdomSubscriberNode()
    return _odom_node


def main(args=None):
    """테스트용 메인"""
    rclpy.init(args=args)
    
    node = OdomSubscriberNode()
    
    print("[*] Waiting for /odom messages from Pi...")
    print("[*] Make sure Pi is running main_ros2.py")
    print("[*] Both devices should have same ROS_DOMAIN_ID (default: 0)")
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
