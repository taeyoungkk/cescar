#!/usr/bin/env python3
"""
Jetson ROS2 Node Entry Point
Pi에서 오는 odom 데이터를 수신하고 SLAM에 연동합니다.

실행: python run_ros2.py
환경: ROS2 Humble (또는 호환 버전)

필수 조건:
- Pi와 Jetson이 같은 네트워크에 있어야 함
- 같은 ROS_DOMAIN_ID 사용 (기본값: 0)
- Pi에서 main_ros2.py가 실행 중이어야 함
"""
import signal
import sys

import rclpy
from rclpy.executors import MultiThreadedExecutor

from app.ros2.odom_subscriber import OdomSubscriberNode


def signal_handler(sig, frame):
    """Ctrl+C 핸들러"""
    print("\n[*] Shutting down ROS2 nodes...")
    rclpy.shutdown()
    sys.exit(0)


def main():
    """메인 함수"""
    print("=" * 50)
    print("  Jetson ROS2 Node")
    print("=" * 50)
    print("  Subscribed Topics:")
    print("    - /odom (from Pi)")
    print("=" * 50)
    print()
    
    # 시그널 핸들러 등록
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # ROS2 초기화
    rclpy.init()
    
    # 노드 생성
    odom_node = OdomSubscriberNode()
    
    # Multi-threaded executor (필요시 다른 노드 추가 가능)
    executor = MultiThreadedExecutor()
    executor.add_node(odom_node)
    
    print("[*] Waiting for /odom from Pi...")
    print("[*] Press Ctrl+C to exit")
    print()
    
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        odom_node.destroy_node()
        rclpy.shutdown()
        print("[*] ROS2 nodes stopped")


if __name__ == '__main__':
    main()
