import json
import math
import time
import threading
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from nav_msgs.msg import Odometry
from geometry_msgs.msg import TransformStamped, Quaternion
from tf2_ros import TransformBroadcaster
import paho.mqtt.client as mqtt

# config에서 settings 가져오기
# 실행 환경에 따라 경로 문제가 생길 수 있으므로 try-except 처리 또는 절대경로 유의
try:
    from app.core.config import settings
except ImportError:
    # 단독 실행 시 경로 문제 발생 가능성 대비
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))
    from app.core.config import settings


def euler_to_quaternion(roll, pitch, yaw):
    """
    Convert Euler angles to Quaternion.
    """
    qx = math.sin(roll/2) * math.cos(pitch/2) * math.cos(yaw/2) - math.cos(roll/2) * math.sin(pitch/2) * math.sin(yaw/2)
    qy = math.cos(roll/2) * math.sin(pitch/2) * math.cos(yaw/2) + math.sin(roll/2) * math.cos(pitch/2) * math.sin(yaw/2)
    qz = math.cos(roll/2) * math.cos(pitch/2) * math.sin(yaw/2) - math.sin(roll/2) * math.sin(pitch/2) * math.cos(yaw/2)
    qw = math.cos(roll/2) * math.cos(pitch/2) * math.cos(yaw/2) + math.sin(roll/2) * math.sin(pitch/2) * math.sin(yaw/2)
    return Quaternion(x=qx, y=qy, z=qz, w=qw)


class MqttOdomBridge(Node):
    def __init__(self):
        super().__init__('mqtt_odom_bridge')
        
        # 파라미터 로드
        self.wheelbase = settings.WHEELBASE_M
        self.frame_id_odom = settings.FRAME_ID_ODOM
        self.frame_id_base = settings.FRAME_ID_BASE
        
        self.get_logger().info(f"Initialized MqttOdomBridge with wheelbase={self.wheelbase}")
        
        # ROS2 Publishers
        odom_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        self.odom_pub = self.create_publisher(Odometry, '/odom', odom_qos)
        self.tf_broadcaster = TransformBroadcaster(self)
        
        # 상태 변수 (적분용)
        self.x = 0.0
        self.y = 0.0
        self.theta = 0.0
        self.last_loop_time = time.time()
        
        # 입력 변수 (from MQTT)
        self.current_v = 0.0
        self.current_steer = 0.0
        self.last_msg_time = 0.0
        
        # MQTT Client 설정
        self.mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_message = self.on_mqtt_message
        
        try:
            self.mqtt_client.connect(settings.MQTT_BROKER, settings.MQTT_PORT, 60)
            self.mqtt_client.loop_start()
            self.get_logger().info(f"Connected to MQTT Broker {settings.MQTT_BROKER}:{settings.MQTT_PORT}")
        except Exception as e:
            self.get_logger().error(f"Failed to connect to MQTT: {e}")
            
        # 20Hz Timer 시작
        self.timer = self.create_timer(0.05, self.timer_callback)

    def on_mqtt_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.get_logger().info("MQTT Connected successfully")
            client.subscribe(settings.TOPIC_SENSORS_ODOM)
            self.get_logger().info(f"Subscribed to {settings.TOPIC_SENSORS_ODOM}")
        else:
            self.get_logger().error(f"MQTT Connection failed with code {rc}")

    def on_mqtt_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
            self.current_v = float(payload.get("v_mps", 0.0))
            self.current_steer = float(payload.get("steer_rad", 0.0))
            self.last_msg_time = time.time()
        except Exception as e:
            self.get_logger().warning(f"Failed to process message: {e}")

    def timer_callback(self):
        current_time_sys = time.time()
        dt = current_time_sys - self.last_loop_time
        self.last_loop_time = current_time_sys
        
        # dt clamp (너무 크면 무시하거나 제한)
        if dt > 0.2:
            dt = 0.2
        elif dt <= 0:
            return
            
        # Watchdog: 0.5초 이상 데이터 없으면 정지
        if (current_time_sys - self.last_msg_time) > 0.5:
            v_to_use = 0.0
            steer_to_use = 0.0
            # 로그는 너무 자주 찍히지 않게 조절 필요하지만 일단 생략
        else:
            v_to_use = self.current_v
            steer_to_use = self.current_steer
            
        # Ackermann Kinematics
        if abs(steer_to_use) > 0.001 and abs(v_to_use) > 0.001:
            w = (v_to_use * math.tan(steer_to_use)) / self.wheelbase
        else:
            w = 0.0
            
        # Odom Integration
        self.theta += w * dt
        # Normalize theta
        self.theta = math.atan2(math.sin(self.theta), math.cos(self.theta))
        
        self.x += v_to_use * math.cos(self.theta) * dt
        self.y += v_to_use * math.sin(self.theta) * dt
        
        self.publish_odom(v_to_use, w)

    def publish_odom(self, v, w):
        current_time = self.get_clock().now().to_msg()
        
        # 1. Publish /odom
        odom_msg = Odometry()
        odom_msg.header.stamp = current_time
        odom_msg.header.frame_id = self.frame_id_odom
        odom_msg.child_frame_id = self.frame_id_base
        
        # Pose
        odom_msg.pose.pose.position.x = self.x
        odom_msg.pose.pose.position.y = self.y
        odom_msg.pose.pose.position.z = 0.0
        odom_msg.pose.pose.orientation = euler_to_quaternion(0, 0, self.theta)
        
        # Twist
        odom_msg.twist.twist.linear.x = v
        odom_msg.twist.twist.angular.z = w
        
        self.odom_pub.publish(odom_msg)
        
        # 2. Broadcast TF (odom -> base_link)
        t = TransformStamped()
        t.header.stamp = current_time
        t.header.frame_id = self.frame_id_odom
        t.child_frame_id = self.frame_id_base
        
        t.transform.translation.x = self.x
        t.transform.translation.y = self.y
        t.transform.translation.z = 0.0
        t.transform.rotation = odom_msg.pose.pose.orientation
        
        self.tf_broadcaster.sendTransform(t)


def main(args=None):
    rclpy.init(args=args)
    node = MqttOdomBridge()
    
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.mqtt_client.loop_stop()
        node.mqtt_client.disconnect()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
