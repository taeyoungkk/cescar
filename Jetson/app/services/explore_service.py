
import subprocess
import logging
import shlex
import os
import signal
import threading

logger = logging.getLogger(__name__)

class ExploreService:
    def __init__(self):
        self.process = None

    def start_explore(self):
        if self.process:
            logger.info("Explore service is already running.")
            return

        # [Nav2] Nav2는 항상 켜져있다고 가정 (Lifecycle 관리 제거)

        # 명령어: ros2 run explore_lite explore 
        # 파라미터는 yaml이나 launch 파일로 관리하는게 좋지만, 
        # 여기서는 CLI 인자로 전달 (사용자 환경에 맞게 수정 필요)
        
        # [수정] ROS2 Humble explore_lite 실행 명령어
        # 패키지: explore_lite, 실행파일: explore
        # 필요 파라미터: robot_base_frame, costmap_topic 등
        
        cmd = [
            "ros2", "run", "explore_lite", "explore",
            "--ros-args",
            "-p", "robot_base_frame:=base_link",
            "-p", "costmap_topic:=/global_costmap/costmap",
            "-p", "visualize:=true",
            "-p", "planner_frequency:=0.33",
            "-p", "progress_timeout:=30.0",
            "-p", "potential_scale:=3.0",
            "-p", "orientation_scale:=0.0",
            "-p", "gain_scale:=1.0",
            "-p", "transform_tolerance:=0.3",
            "-p", "min_frontier_size:=0.75",
        ]

        logger.info(f"Starting explore service with command: {' '.join(cmd)}")
        
        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid  # 프로세스 그룹 생성 (종료 시 자식까지 죽이기 위함)
            )
            logger.info(f"Explore service started with PID: {self.process.pid}")
            
            # 비동기 로그 모니터링 시작
            threading.Thread(target=self._monitor_process, daemon=True).start()
            
        except Exception as e:
            logger.error(f"Failed to start explore service: {e}")
            self.process = None

    def _monitor_process(self):
        """탐험 프로세스 로그 모니터링"""
        if not self.process:
            return
            
        try:
            # stdout 읽기
            for line in iter(self.process.stdout.readline, b''):
                if line:
                    decoded = line.decode(errors='replace').strip()
                    logger.debug(f"[EXPLORE] {decoded}")
        except Exception as e:
            logger.error(f"Error monitoring explore process: {e}") 
            
    def stop_explore(self):
        # [Nav2] Nav2 Lifecycle은 건드리지 않음 (항상 켜둠)
        
        if self.process:
            logger.info("Stopping explore service and all child processes...")
            
            try:
                # 프로세스 그룹 전체에 SIGINT 전송 (Nav2 노드 등 자식 프로세스까지 전달)
                # os.setsid로 생성했으므로 killpg 사용 가능
                pgid = os.getpgid(self.process.pid)
                os.killpg(pgid, signal.SIGINT)
                
                # 종료 대기 (최대 1초)
                try:
                    self.process.wait(timeout=1.0)
                except subprocess.TimeoutExpired:
                    logger.warning("Explore service SIGINT timeout, forcing SIGKILL.")
                    os.killpg(pgid, signal.SIGKILL)
                    self.process.wait(timeout=0.5)
                    
            except ProcessLookupError:
                logger.info("Process already terminated.")
            except Exception as e:
                logger.error(f"Error stopping explore service: {e}")
            
            self.process = None
            logger.info("Explore service stopped.")
        else:
            logger.info("Explore service is not running or already stopped.")

explore_service = ExploreService()
