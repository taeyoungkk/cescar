#!/usr/bin/env python3
"""
ROS2 기반 Pi Motor Controller
MQTT 대신 ROS2 토픽으로 통신.

실행: python main_ros2.py
"""
from app.ros2.pi_node import main

if __name__ == '__main__':
    main()
