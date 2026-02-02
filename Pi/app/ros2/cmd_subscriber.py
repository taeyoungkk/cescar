"""
ROS2 Command Subscriber Node for Raspberry Pi
Jetson에서 오는 /cmd_vel 명령을 받아서 모터 제어.
"""
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from geometry_msgs.msg import Twist
from std_msgs.msg import String

from app.services.control_service import control_service


class CmdVelSubscriberNode(Node):
    """ROS2 Command Velocity Subscriber Node."""
    
    def __init__(self):
        super().__init__('pi_cmd_vel_subscriber')
        
        # QoS 설정
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        
        # cmd_vel 구독 (Jetson에서 발행)
        self._cmd_sub = self.create_subscription(
            Twist,
            '/cmd_vel',
            self._cmd_vel_callback,
            qos
        )
        
        # 모드 구독 (MANUAL/AUTO)
        self._mode_sub = self.create_subscription(
            String,
            '/pi/mode',
            self._mode_callback,
            qos
        )
        
        # Watchdog timer (300ms)
        self._watchdog_timer = self.create_timer(0.3, self._watchdog_callback)
        self._last_cmd_time = self.get_clock().now()
        
        self.get_logger().info('CmdVelSubscriber initialized')
    
    def _cmd_vel_callback(self, msg: Twist) -> None:
        """cmd_vel 콜백 - 모터 제어."""
        self._last_cmd_time = self.get_clock().now()
        
        # Twist -> throttle/steering 변환
        linear_x = msg.linear.x   # m/s
        angular_z = msg.angular.z  # rad/s
        
        # 간단한 변환 (나중에 튜닝 필요)
        # linear_x: -1 ~ 1 범위로 정규화 (최대 속도 기준)
        max_speed = 0.5  # m/s (추정)
        throttle = max(-1.0, min(1.0, linear_x / max_speed))
        
        # angular_z: -1 ~ 1 범위로 정규화 (최대 각속도 기준)
        max_angular = 1.0  # rad/s
        steering = max(-1.0, min(1.0, angular_z / max_angular))
        
        # control_service로 전달
        control_service.handle_command(throttle, steering)
        
        self.get_logger().debug(f'cmd_vel: linear={linear_x:.2f}, angular={angular_z:.2f}')
    
    def _mode_callback(self, msg: String) -> None:
        """모드 변경 콜백."""
        mode = msg.data.upper()
        if mode in ['MANUAL', 'AUTO']:
            control_service.set_mode(mode)
            self.get_logger().info(f'Mode changed to: {mode}')
    
    def _watchdog_callback(self) -> None:
        """Watchdog - 명령이 없으면 정지."""
        now = self.get_clock().now()
        elapsed = (now - self._last_cmd_time).nanoseconds / 1e6  # ms
        
        if elapsed > 300:  # 300ms 이상 명령 없음
            control_service.handle_command(0.0, 0.0)  # 정지


def main(args=None):
    """메인."""
    rclpy.init(args=args)
    node = CmdVelSubscriberNode()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
