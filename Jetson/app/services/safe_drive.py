#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import LaserScan
import math

class SafeDrive(Node):
    def __init__(self):
        super().__init__('safe_drive')
        self.publisher_ = self.create_publisher(Twist, '/cmd_vel', 10)
        self.subscription = self.create_subscription(
            LaserScan,
            '/scan',
            self.scan_callback,
            10)
        
        # Parameters
        self.safe_distance = 0.8  # Safe distance in meters (starts slowing)
        self.stop_distance = 0.5  # Emergency stop/turn distance
        self.linear_speed = 0.4
        self.angular_speed = 0.5
        
        self.get_logger().info("Safe Drive Node Started - Moving Forward with Obstacle Avoidance")

    def scan_callback(self, msg):
        # Find points in the front sector (-30 to +30 degrees)
        # We assume standard REP-103: x forward, so 0 angle is forward.
        
        front_ranges = []
        angle_min = msg.angle_min
        angle_inc = msg.angle_increment
        
        for i, dist in enumerate(msg.ranges):
            # Check for invalid values
            if dist == float('inf') or math.isnan(dist) or dist < msg.range_min or dist > msg.range_max:
                continue
                
            angle = angle_min + i * angle_inc
            # Normalize angle to [-pi, pi]
            while angle > math.pi: angle -= 2*math.pi
            while angle < -math.pi: angle += 2*math.pi
            
            # Check if within frontal cone (e.g. +/- 30 degrees = 0.52 rad)
            if abs(angle) < 0.52:
                front_ranges.append(dist)
        
        twist = Twist()
        
        if not front_ranges:
            # No obstacles seen in range (or everything infinite)
            min_dist = 999.9
        else:
            min_dist = min(front_ranges)
            
        # Control Logic
        if min_dist < self.stop_distance:
            # Danger close: Stop and turn
            twist.linear.x = 0.0
            twist.angular.z = self.angular_speed  # Rotate
            self.get_logger().info(f"Obstacle detected ({min_dist:.2f}m)! Turning...", throttle_duration_sec=1.0)
            
        elif min_dist < self.safe_distance:
            # Proximity warning: Slow down
            twist.linear.x = self.linear_speed * 0.3
            twist.angular.z = 0.0
            self.get_logger().info(f"Approaching obstacle ({min_dist:.2f}m)...", throttle_duration_sec=1.0)
            
        else:
            # Clear path: Go forward coolly
            twist.linear.x = self.linear_speed
            twist.angular.z = 0.0
            
        self.publisher_.publish(twist)

def main(args=None):
    rclpy.init(args=args)
    safe_drive = SafeDrive()
    try:
        rclpy.spin(safe_drive)
    except KeyboardInterrupt:
        pass
    finally:
        # Stop on exit
        stop_twist = Twist()
        if safe_drive.publisher_:
            safe_drive.publisher_.publish(stop_twist)
        safe_drive.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
