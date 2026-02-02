"""
ROS2 Main Node for Raspberry Pi
Odom Publisher + Cmd Subscriber를 하나의 노드로 통합.
"""
import math
import signal
import sys
from typing import Optional

import rclpy
from rclpy.node import Node
from rclpy.executors import MultiThreadedExecutor
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist, Quaternion, TransformStamped
from std_msgs.msg import String
from tf2_ros import TransformBroadcaster

from app.controllers.encoder_controller import EncoderController
from app.services.control_service import control_service
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


class PiRos2Node(Node):
    """
    Raspberry Pi ROS2 통합 노드.
    - /odom 발행 (엔코더 기반)
    - /cmd_vel 구독 (모터 제어)
    - /pi/mode 구독 (MANUAL/AUTO)
    """
    
    def __init__(self, encoder: Optional[EncoderController] = None):
        super().__init__('pi_motor_controller')
        
        self._encoder = encoder
        self._steering = control_service._steer  # 조향 컨트롤러
        self._wheelbase = settings.WHEELBASE_M
        
        # Odom 상태
        self._x = 0.0
        self._y = 0.0
        self._theta = 0.0
        self._last_odom_time = self.get_clock().now()
        
        # QoS
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        
        # === Publishers ===
        self._odom_pub = self.create_publisher(Odometry, '/odom', qos)
        self._tf_broadcaster = TransformBroadcaster(self)
        
        # === Subscribers ===
        self._cmd_sub = self.create_subscription(
            Twist, '/cmd_vel', self._cmd_vel_callback, qos
        )
        self._mode_sub = self.create_subscription(
            String, '/pi/mode', self._mode_callback, qos
        )
        
        # === Timers ===
        # Odom 발행 (20Hz)
        self._odom_timer = self.create_timer(0.05, self._odom_callback)
        # Watchdog (10Hz 체크)
        self._watchdog_timer = self.create_timer(0.1, self._watchdog_callback)
        
        self._last_cmd_time = self.get_clock().now()
        
        self.get_logger().info('=== Pi ROS2 Node Started ===')
        self.get_logger().info(f'  Publishing: /odom')
        self.get_logger().info(f'  Subscribing: /cmd_vel, /pi/mode')
        if encoder:
            self.get_logger().info(f'  Encoder: GPIO{settings.ENCODER_PIN_A}, GPIO{settings.ENCODER_PIN_B}')
    
    def _odom_callback(self) -> None:
        """Odom 발행 콜백 (20Hz)."""
        if not self._encoder:
            return
        
        now = self.get_clock().now()
        dt = (now - self._last_odom_time).nanoseconds / 1e9
        
        if dt <= 0:
            return
        
        self._last_odom_time = now
        
        # 엔코더 업데이트
        self._encoder.update()
        v = self._encoder.speed
        
        # 조향각
        if self._steering:
            steer_deg = self._steering.last_angle - 115.0
            steer_rad = math.radians(steer_deg)
        else:
            steer_rad = 0.0
        
        # 각속도 (Ackermann)
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
        
        # Odometry 메시지
        odom = Odometry()
        odom.header.stamp = now.to_msg()
        odom.header.frame_id = 'odom'
        odom.child_frame_id = 'base_link'
        
        odom.pose.pose.position.x = self._x
        odom.pose.pose.position.y = self._y
        odom.pose.pose.position.z = 0.0
        odom.pose.pose.orientation = euler_to_quaternion(0, 0, self._theta)
        
        odom.twist.twist.linear.x = v
        odom.twist.twist.angular.z = w
        
        self._odom_pub.publish(odom)
        
        # TF broadcast
        t = TransformStamped()
        t.header.stamp = now.to_msg()
        t.header.frame_id = 'odom'
        t.child_frame_id = 'base_link'
        t.transform.translation.x = self._x
        t.transform.translation.y = self._y
        t.transform.rotation = euler_to_quaternion(0, 0, self._theta)
        self._tf_broadcaster.sendTransform(t)
    
    def _cmd_vel_callback(self, msg: Twist) -> None:
        """cmd_vel 콜백."""
        self._last_cmd_time = self.get_clock().now()
        
        linear_x = msg.linear.x
        angular_z = msg.angular.z
        
        # 정규화 (최대값 기준)
        max_speed = 0.5  # m/s
        max_angular = 1.0  # rad/s
        
        throttle = max(-1.0, min(1.0, linear_x / max_speed))
        steering = max(-1.0, min(1.0, angular_z / max_angular))
        
        control_service.handle_command(throttle, steering)
    
    def _mode_callback(self, msg: String) -> None:
        """모드 변경 콜백."""
        mode = msg.data.upper()
        if mode in ['MANUAL', 'AUTO']:
            control_service.set_mode(mode)
            self.get_logger().info(f'Mode: {mode}')
    
    def _watchdog_callback(self) -> None:
        """Watchdog 체크."""
        now = self.get_clock().now()
        elapsed_ms = (now - self._last_cmd_time).nanoseconds / 1e6
        
        if elapsed_ms > settings.WATCHDOG_MS:
            control_service.handle_command(0.0, 0.0)
        
        # control_service watchdog도 호출
        control_service.tick()
    
    @staticmethod
    def _normalize_angle(angle: float) -> float:
        while angle > math.pi:
            angle -= 2 * math.pi
        while angle < -math.pi:
            angle += 2 * math.pi
        return angle
    
    def cleanup(self) -> None:
        """정리."""
        control_service.cleanup()
        if self._encoder:
            self._encoder.cleanup()
        self.get_logger().info('Cleanup complete')


# 전역 노드 참조 (시그널 핸들러용)
_node: Optional[PiRos2Node] = None


def signal_handler(sig, frame):
    """Ctrl+C 핸들러."""
    print("\n[*] Shutting down...")
    if _node:
        _node.cleanup()
    rclpy.shutdown()
    sys.exit(0)


def main(args=None):
    """메인 함수."""
    global _node
    
    print("=" * 50)
    print("  Raspberry Pi ROS2 Motor Controller")
    print("=" * 50)
    print(f"  Encoder: GPIO{settings.ENCODER_PIN_A}, GPIO{settings.ENCODER_PIN_B}")
    print(f"  Wheelbase: {settings.WHEELBASE_M}m")
    print(f"  Watchdog: {settings.WATCHDOG_MS}ms")
    print("=" * 50)
    
    # ROS2 초기화
    rclpy.init(args=args)
    
    # 시그널 핸들러
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 엔코더 초기화
    try:
        encoder = EncoderController(
            pin_a=settings.ENCODER_PIN_A,
            pin_b=settings.ENCODER_PIN_B,
            ppr=settings.ENCODER_PPR,
            wheel_diameter_m=settings.WHEEL_DIAMETER_M,
        )
        print("[*] Encoder: ENABLED")
    except Exception as e:
        print(f"[!] Encoder failed: {e}")
        encoder = None
    
    # 노드 생성
    _node = PiRos2Node(encoder=encoder)
    
    print("\n[*] ROS2 Node running... (Ctrl+C to exit)\n")
    
    try:
        rclpy.spin(_node)
    except KeyboardInterrupt:
        pass
    finally:
        _node.cleanup()
        _node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
