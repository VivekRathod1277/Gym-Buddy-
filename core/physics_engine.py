import json
import numpy as np
import mediapipe as mp

class PhysicsEngine:
    def __init__(self, blueprint_path):
        """
        Initializes the dynamic tracking engine using a JSON blueprint.
        """
        with open(blueprint_path, 'r') as f:
            self.blueprint = json.load(f)
        
        # Internal state
        self.current_state = "start"  # We assume we begin at the start phase
        self.reps = 0
        self.faults = []
        self.reference_landmarks = None # Used for tracking initial positions (e.g. tracking shoulder swing)
        self.current_view = "unknown"
        
        self.mp_pose = mp.solutions.pose

    def calculate_angle(self, a, b, c):
        """
        Calculates the angle between three points.
        """
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians*180.0/np.pi)
        
        if angle > 180.0:
            angle = 360 - angle
            
        return angle

    def parse_landmarks(self, landmarks):
        """
        Converts MediaPipe landmarks into a dictionary based on names.
        Includes x, y, and visibility.
        """
        parsed = {}
        for lm_name in dir(self.mp_pose.PoseLandmark):
            if not lm_name.startswith('_'):
                idx = getattr(self.mp_pose.PoseLandmark, lm_name).value
                parsed[lm_name] = [landmarks[idx].x, landmarks[idx].y, landmarks[idx].visibility]
        return parsed

    def evaluate_frame(self, landmarks):
        """
        Evaluates the current frame against the JSON rules.
        """
        parsed = self.parse_landmarks(landmarks)
        
        # 0. Visibility Check - DISABLED to reduce voice lag
        visibility_fault = None
                
        # 0.5 Camera Angle Auto-Detect
        # Using Euclidean distance allows robust camera angle tracking regardless of if body is vertical or horizontal
        shoulder_width = np.linalg.norm(np.array(parsed['LEFT_SHOULDER'][:2]) - np.array(parsed['RIGHT_SHOULDER'][:2]))
        torso_length = np.linalg.norm(np.array(parsed['LEFT_SHOULDER'][:2]) - np.array(parsed['LEFT_HIP'][:2]))
        
        if torso_length > 0.01:
            ratio = shoulder_width / torso_length
            if ratio > 0.3:
                self.current_view = "front"
            else:
                self.current_view = "side"

        if self.reference_landmarks is None:
            self.reference_landmarks = parsed
            return None # Wait for first full frame
            
        # 1. Rep counting logic
        primary_joints = self.blueprint['target_joints']['primary']
        a_name, b_name, c_name = primary_joints
        
        a = parsed[a_name]
        b = parsed[b_name]
        c = parsed[c_name]
        
        angle = self.calculate_angle(a, b, c)
        
        # State machine
        start_cfg = self.blueprint['phases']['start']
        end_cfg = self.blueprint['phases']['end']
        
        if self.current_state == "start":
            if start_cfg['type'] == 'greater_than':
                if angle > start_cfg['angle'] - start_cfg['threshold']:
                    # Reached start, wait to go to end
                    pass
            # Check if traversing to end
            if end_cfg['type'] == 'less_than':
                if angle < end_cfg['angle'] + end_cfg['threshold']:
                    self.current_state = "end"
        
        elif self.current_state == "end":
            # Check if traversing back to start
            if start_cfg['type'] == 'greater_than':
                if angle > start_cfg['angle'] - start_cfg['threshold']:
                    self.current_state = "start"
                    self.reps += 1
                    # reset reference at start of a new rep
                    self.reference_landmarks = parsed
        
        # 2. Form faults evaluation
        active_fault = None
        for fault in self.blueprint['form_faults']:
            # View filtering
            if 'view' in fault and fault['view'] != self.current_view:
                continue
                
            # Phase filtering
            if 'active_phases' in fault and self.current_state not in fault['active_phases']:
                continue
                
            if fault['type'] == 'joint_movement_x':
                joint_name = fault['joint']
                current_x = parsed[joint_name][0]
                ref_x = self.reference_landmarks[joint_name][0]
                diff = abs(current_x - ref_x)
                
                if diff > fault['threshold']:
                    active_fault = fault['feedback_message']
                    if fault['name'] not in self.faults:
                        self.faults.append(fault['name'])
                    self.reference_landmarks = parsed
                    
            elif fault['type'] == 'joint_movement_y':
                joint_name = fault['joint']
                current_y = parsed[joint_name][1]
                ref_y = self.reference_landmarks[joint_name][1]
                diff = abs(current_y - ref_y)
                
                if diff > fault['threshold']:
                    active_fault = fault['feedback_message']
                    if fault['name'] not in self.faults:
                        self.faults.append(fault['name'])
                    self.reference_landmarks = parsed
                    
            elif fault['type'] == 'distance_ratio':
                j1_a, j1_b = fault['joints_1']
                j2_a, j2_b = fault['joints_2']
                dist1 = np.linalg.norm(np.array(parsed[j1_a][:2]) - np.array(parsed[j1_b][:2]))
                dist2 = np.linalg.norm(np.array(parsed[j2_a][:2]) - np.array(parsed[j2_b][:2]))
                
                condition = fault.get('condition', 'less_than')
                ratio_val = dist1 / dist2 if dist2 > 0 else 0
                
                is_fault = False
                if condition == 'less_than' and ratio_val < fault['threshold']:
                    is_fault = True
                elif condition == 'greater_than' and ratio_val > fault['threshold']:
                    is_fault = True
                    
                if is_fault:
                    active_fault = fault['feedback_message']
                    if fault['name'] not in self.faults:
                        self.faults.append(fault['name'])
                    self.reference_landmarks = parsed
            
            elif fault['type'] == 'angle_range':
                a_name, b_name, c_name = fault['joints']
                f_angle = self.calculate_angle(parsed[a_name][:2], parsed[b_name][:2], parsed[c_name][:2])
                
                is_fault = False
                if 'min_angle' in fault and f_angle < fault['min_angle']:
                    is_fault = True
                if 'max_angle' in fault and f_angle > fault['max_angle']:
                    is_fault = True
                    
                if is_fault:
                    active_fault = fault['feedback_message']
                    if fault['name'] not in self.faults:
                        self.faults.append(fault['name'])
                    self.reference_landmarks = parsed
                    
            elif fault['type'] == 'segment_angle':
                PointA, PointB = fault['joints']
                a = np.array(parsed[PointA][:2])
                b = np.array(parsed[PointB][:2])
                
                axis = fault.get('axis', 'vertical')
                if axis == 'vertical':
                    c = np.array([a[0], a[1] + 0.1])
                else: 
                    c = np.array([a[0] + 0.1, a[1]])
                    
                s_angle = self.calculate_angle(b, a, c)
                
                is_fault = False
                if 'min_angle' in fault and s_angle < fault['min_angle']:
                    is_fault = True
                if 'max_angle' in fault and s_angle > fault['max_angle']:
                    is_fault = True
                    
                if is_fault:
                    active_fault = fault['feedback_message']
                    if fault['name'] not in self.faults:
                        self.faults.append(fault['name'])
                    self.reference_landmarks = parsed
        return {
            "angle": angle,
            "reps": self.reps,
            "state": self.current_state,
            "active_fault": active_fault or visibility_fault
        }

    def get_session_data(self):
        """
        Export final data for ML or DB analysis.
        """
        return {
            "exercise": self.blueprint['exercise_name'],
            "total_reps": self.reps,
            "faults_recorded": self.faults
        }
