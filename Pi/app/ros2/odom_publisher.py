"""
ROS2 Odometry Publisher Node for Raspberry Pi
엔코더 데이터를 ROS2 /odom 토픽으로 발행.
"""
import math
import time
import threading
from typing import Optional

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Quaternion, TransformStamped
from tf2_ros import TransformBroadcaster

from app.controllers.encoder_controller import EncoderController
from app.core.config import settings


def euler_to_quaternion(roll: float, pitch: float, yaw: float) -> Quaternion:
    """오일러 각도를 쿼터니언으로 변환."""
    cy = math.cos(yaw * 0.5)
    sy = math.sin(yaw * 0.5)
    cp = math.cos(pitch * 0.5)
    sp = math.sin(pitch * 0.5)
    cr = math.cos(roll * 0.5)
    sr = math.sin(roll * 0.5)
    
    q = Quaternion()
    q.w = cr * cp * cy + sr * sp * sy
    q.x = sr * cp * cy - cr * sp * sy
    q.y = cr * sp * cy + sr * cp * sy
    q.z = cr * cp * sy - sr * sp * cy
    return q


class OdomPublisherNode(Node):
    """ROS2 Odometry Publisher Node."""
    
    def __init__(
        self,
        encoder: Optional[EncoderController] = None,
        steering=None,  # SteeringServo 인스턴스
        wheelbase: float = 0.16,
        publish_hz: float = 20.0,
    ):
        super().__init__('pi_odom_publisher')
        
        self._encoder = encoder
        self._steering = steering
        self._wheelbase = wheelbase
        
        # 상태
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        self._last_time = self.get_clock().now()
        
        # QoS 설정 (Jetson과 맞춤)
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        
        # Publisher
        self._odom_pub = self.create_publisher(Odometry, '/odom', qos)
        
        # TF Broadcaster (odom -> base_link)
        self._tf_broadcaster = TransformBroadcaster(self)
        
        # Timer (20Hz)
        self._timer = self.create_timer(1.0 / publish_hz, self._timer_callback)
        
        self.get_logger().info(f'OdomPublisher initialized (Hz={publish_hz})')
    
    def set_encoder(self, encoder: EncoderController) -> None:
        """엔코더 연결."""
        self._encoder = encoder
    
    def set_steering(self, steering) -> None:
        """조향 컨트롤러 연결."""
        self._steering = steering
    
    def _timer_callback(self) -> None:
        """타이머 콜백 - odom 계산 및 발행."""
        now = self.get_clock().now()
        dt = (now - self._last_time).nanoseconds / 1e9
        
        if dt <= 0:
            return
        
        self._last_time = now
        
        # 엔코더에서 속도 가져오기
        if self._encoder:
            self._encoder.update()
            v = self._encoder.speed
        else:
            v = 0.0
        
        # 조향각 가져오기
        if self._steering:
            steer_deg = self._steering.last_angle - 115.0  # center 기준
            steer_rad = math.radians(steer_deg)
        else:
            steer_rad = 0.0
        
        # Ackermann 모델로 각속도 계산
        if abs(steer_rad) > 0.001 and abs(v) > 0.001:
            turning_radius = self._wheelbase / math.tan(steer_rad)
            w = v / turning_radius
        else:
            w = 0.0
        
        # 위치 업데이트
        self._theta += w * dt
        self._theta = self._normalize_angle(self._theta)
        self._x += v * math.cos(self._theta) * dt
        self._y += v * math.sin(self._theta) * dt
        
        # Odometry 메시지 생성
        odom_msg = Odometry()
        odom_msg.header.stamp = now.to_msg()
        odom_msg.header.frame_id = 'odom'
        odom_msg.child_frame_id = 'base_link'
        
        # Position
        odom_msg.pose.pose.position.x = self._x
        odom_msg.pose.pose.position.y = self._y
        odom_msg.pose.pose.position.z = 0.0
        odom_msg.pose.pose.orientation = euler_to_quaternion(0, 0, self._theta)
        
        # Velocity
        odom_msg.twist.twist.linear.x = v
        odom_msg.twist.twist.linear.y = 0.0
        odom_msg.twist.twist.angular.z = w
        
        # Publish
        self._odom_pub.publish(odom_msg)
        
        # TF broadcast (odom -> base_link)
        t = TransformStamped()
        t.header.stamp = now.to_msg()
        t.header.frame_id = 'odom'
        t.child_frame_id = 'base_link'
        t.transform.translation.x = self._x
        t.transform.translation.y = self._y
        t.transform.translation.z = 0.0
        t.transform.rotation = euler_to_quaternion(0, 0, self._theta)
        
        self._tf_broadcaster.sendTransform(t)
    
    @staticmethod
    def _normalize_angle(angle: float) -> float:
        """각도를 -π ~ π로 정규화."""
        while angle > math.pi:
            angle -= 2 * math.pi
        while angle < -math.pi:
            angle += 2 * math.pi
        return angle
    
    def reset(self) -> None:
        """위치 리셋."""
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        if self._encoder:
            self._encoder.reset()
        self.get_logger().info('Odom reset')


def main(args=None):
    """테스트용 메인."""
    rclpy.init(args=args)
    
    # 엔코더 초기화
    encoder = EncoderController(
        pin_a=settings.ENCODER_PIN_A,
        pin_b=settings.ENCODER_PIN_B,
        ppr=settings.ENCODER_PPR,
        wheel_diameter_m=settings.WHEEL_DIAMETER_M,
    )
    
    node = OdomPublisherNode(encoder=encoder)
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        encoder.cleanup()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
