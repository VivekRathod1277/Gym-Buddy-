from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import random
import os
import json
from fpdf import FPDF

from backend.dependencies import get_current_user
from backend.schemas import TokenData
from core.database import (
    get_user_profile,
    update_user_profile,
    save_fitness_record,
    get_fitness_history,
    save_diet_routine,
    save_workout_routine,
    save_workout_exercise,
)

router = APIRouter(prefix="/api/diet", tags=["diet"])

# --- Schemas ---

class ProfileUpdate(BaseModel):
    email: str
    age: int
    gender: str
    height: float
    weight: float
    activity: float
    diet_type: str
    mobile_no: str
    date_of_birth: str

class GeneratePlanRequest(BaseModel):
    age: int
    gender: str
    height: float
    weight: float
    activity: float
    diet_type: str
    goal: str

class GeneratePdfRequest(BaseModel):
    results_json: str

# --- Core Calculation Logic ---

def calculate_bmi(weight: float, height: float) -> float:
    height_m = height / 100
    return round(weight / (height_m ** 2), 1)

def calculate_bmr(weight: float, height: float, age: int, gender: str) -> float:
    if gender.lower() == 'male':
        return 10 * weight + 6.25 * height - 5 * age + 5
    else:
        return 10 * weight + 6.25 * height - 5 * age - 161

def get_weekly_diet(goal: str, diet_type: str, gender: str = 'Male') -> dict:
    options = {
        'fat loss': {
            'veg': {
                'breakfast': ['Oats with berries', 'Moong Dal Chilla', 'Smoothie Bowl', 'Besan Poha', 'Greek Yogurt with Nuts'],
                'lunch': ['Quinoa Salad', 'Paneer & Veggie Wrap', 'Lentil Soup with Brown Rice', 'Soya Chunks Stir-fry', 'Mixed Bean Salad'],
                'dinner': ['Roasted Vegetables', 'Paneer Tikka with Salad', 'Dal Khichdi (Light)', 'Vegetable Clear Soup', 'Mushroom Sauté']
            },
            'eggitarian': {
                'breakfast': ['Boiled Eggs & Toast', 'Egg White Omelet', 'Scrambled Eggs with Spinach', 'Protein Pancakes', 'Poached Eggs on Rye'],
                'lunch': ['Egg Curry (Light)', 'Egg Salad Wrap', 'Lentil Soup with Boiled Eggs', 'Soya Chunks with Egg Bhurji', 'Quinoa & Egg Bowl'],
                'dinner': ['Omelet with Veggies', 'Egg Bhurji (No Butter)', 'Boiled Eggs with Roasted Veggies', 'Egg Clear Soup', 'Mushroom & Egg Sauté']
            },
            'non-veg': {
                'breakfast': ['Boiled Eggs & Toast', 'Chicken Sausage & Eggs', 'Scrambled Eggs with Spinach', 'Protein Pancakes', 'Turkey Bacon & Eggs'],
                'lunch': ['Grilled Chicken Salad', 'Chicken Tikka Wrap', 'Tuna Salad', 'Baked Fish with Greens', 'Turkey Breast Sandwich'],
                'dinner': ['Chicken Stir-fry', 'Grilled Chicken & Broccoli', 'Salmon with Asparagus', 'Lean Beef Stir-fry', 'Baked Tilapia']
            },
            'vegan': {
                'breakfast': ['Oats with Almond Milk', 'Tofu Scramble', 'Green Smoothie Bowl', 'Vegan Protein Pancakes', 'Chia Seed Pudding'],
                'lunch': ['Lentil & Quinoa Bowl', 'Chickpea Salad Wrap', 'Vegan Buddha Bowl', 'Soya Chunks Stir-fry', 'Black Bean Salad'],
                'dinner': ['Roasted Vegetables & Tofu', 'Vegan Dal Soup', 'Zucchini Noodles with Pesto', 'Mushroom Sauté', 'Stuffed Bell Peppers']
            }
        },
        'muscle gain': {
            'veg': {
                'breakfast': ['Paneer Paratha', 'Protein Smoothie with Oats', 'Peanut Butter Toast & Milk', 'Sprouted Salad & Paneer', 'Tofu Scramble'],
                'lunch': ['Dal Makhani & Brown Rice', 'Paneer Butter Masala (Mod) & Roti', 'Soya Chunk Pulao', 'Chickpea Curry & Quinoa', 'Rajma Chawal'],
                'dinner': ['Paneer Bhurji & Roti', 'Lentil Pasta', 'Tofu & Veggie Stir-fry', 'Stuffed Mushrooms & Paneer', 'Vegetable Stew & Bread']
            },
            'eggitarian': {
                'breakfast': ['Whole Eggs Omelet (3-4 eggs)', 'Protein Smoothie with Eggs', 'French Toast with Honey', 'Egg & Cheese Sandwich', 'Protein Oats with Egg Whites'],
                'lunch': ['Egg Curry & Rice', 'Egg Fried Rice (High Protein)', 'Boiled Eggs & Quinoa', 'Lentil Curry with Eggs', 'Rajma & Egg Bowl'],
                'dinner': ['Egg Bhurji & Roti', 'Lentil Pasta with Boiled Eggs', 'Scrambled Eggs & Avocado Toast', 'Stuffed Mushrooms & Eggs', 'Vegetable Stew & Eggs']
            },
            'non-veg': {
                'breakfast': ['Whole Eggs Omelet (3-4 eggs)', 'Chicken Sausage & Eggs', 'Beef Hash & Eggs', 'Egg & Turkey Bacon Sandwich', 'Protein Oats with Egg Whites'],
                'lunch': ['Chicken Breast & Rice', 'Chicken Fried Rice (High Protein)', 'Beef Burrito', 'Grilled Fish & Sweet Potato', 'Lamb Chops & Veggies'],
                'dinner': ['Steak & Mashed Potatoes', 'Chicken Pasta', 'Grilled Salmon & Rice', 'Turkey Burger (No Bun)', 'Lean Pork Chops & Veggies']
            },
            'vegan': {
                'breakfast': ['Vegan Protein Smoothie', 'Tofu Scramble & Toast', 'Peanut Butter Oats', 'Chickpea Flour Chilla', 'Tempeh Bacon & Beans'],
                'lunch': ['Lentil Curry & Quinoa', 'Tofu & Broccoli Stir-fry', 'Soya Chunk Pulao', 'Vegan Meatballs & Pasta', 'Black Bean & Corn Bowl'],
                'dinner': ['Vegan Mac & Cheese', 'Seitan Stir-fry', 'Tempeh & Veggie Skewers', 'Stuffed Sweet Potatoes', 'Hearty Veg & Bean Stew']
            }
        },
        'maintenance': {
            'veg': {
                'breakfast': ['Poha with Peanuts', 'Vegetable Upma', 'Fruit & Yogurt Parfait', 'Aloo Paratha (Light Oil)', 'Idli with Sambar'],
                'lunch': ['Roti, Dal, and Mixed Veg', 'Veg Pulao with Raita', 'Paneer Wrap', 'Chhole & Rice', 'Kadhi Pakora & Rice'],
                'dinner': ['Vegetable Khichdi', 'Roti with Sabzi', 'Dal Soup with Toast', 'Mixed Veg Salad', 'Grilled Paneer Salad']
            },
            'eggitarian': {
                'breakfast': ['Egg Sandwich', 'Boiled Eggs with Fruit', 'Masala Omelet', 'French Toast', 'Poha with Boiled Eggs'],
                'lunch': ['Egg Curry & Roti', 'Egg Fried Rice', 'Boiled Egg Salad', 'Dal & Rice with Eggs', 'Egg Bhurji & Toast'],
                'dinner': ['Egg Wrap', 'Scrambled Eggs & Veggies', 'Egg & Noodle Soup', 'Roti with Egg Curry', 'Boiled Eggs & Salad']
            },
            'non-veg': {
                'breakfast': ['Chicken Sausage & Toast', 'Egg Sandwich', 'Bacon & Eggs', 'Chicken Wrap', 'Turkey & Cheese Croissant'],
                'lunch': ['Chicken Curry & Rice', 'Fish Tikka & Roti', 'Chicken Salad', 'Beef Stir-fry & Noodles', 'Turkey Sandwich'],
                'dinner': ['Grilled Chicken & Veggies', 'Fish Curry & Rice', 'Chicken Soup & Toast', 'Roast Chicken', 'Steak & Salad']
            },
            'vegan': {
                'breakfast': ['Vegan Banana Bread', 'Oatmeal with Fruits', 'Vegan Smoothie', 'Tofu Sandwich', 'Vegan Pancakes'],
                'lunch': ['Vegan Wrap', 'Quinoa & Veggies', 'Lentil Soup & Bread', 'Vegan Pasta', 'Chickpea Salad'],
                'dinner': ['Vegan Burger', 'Tofu Stir-fry', 'Vegetable Curry & Rice', 'Vegan Pizza (No Cheese)', 'Roasted Veggies & Hummus']
            }
        }
    }
    
    # Default to maintenance if not found
    pool = options.get(goal.lower(), options['fat loss']).get(diet_type.lower(), options['fat loss']['veg'])
    
    weekly_plan = {}
    for i in range(1, 8):
        weekly_plan[f"Day {i}"] = {
            'breakfast': random.choice(pool['breakfast']),
            'lunch': random.choice(pool['lunch']),
            'dinner': random.choice(pool['dinner'])
        }
        
        # Add a gender-specific macro/micronutrient tip
        if gender.lower() == 'female':
            weekly_plan[f"Day {i}"]['tip'] = "Include iron-rich greens like spinach and Vitamin C for absorption."
        else:
            weekly_plan[f"Day {i}"]['tip'] = "Focus on lean protein density to preserve muscle mass."
            
    return weekly_plan

def _ex(name: str, sets: int, reps: str, rest: str, notes: str='') -> dict:
    return {'name': name, 'sets': sets, 'reps': reps, 'rest': rest, 'notes': notes}

def get_weekly_workout(goal: str, gender: str = 'Male') -> dict:
    if goal.lower() == 'fat loss':
        plans = {
            'Day 1': {
                'type': 'HIIT Cardio', 'focus': 'Full Body Fat Burn', 'duration': '40 min', 'color': '#f43f5e',
                'exercises': [
                    _ex('Burpees', 4, '15 reps', '30s', 'Explosive jump at top, land softly'),
                    _ex('Mountain Climbers', 4, '20 each leg', '30s', 'Keep hips level, fast pace'),
                    _ex('Jumping Jacks', 3, '40 reps', '20s', 'Full arm extension overhead'),
                    _ex('High Knees', 4, '30s', '30s', 'Drive knees above waist height'),
                    _ex('Jump Rope', 3, '60s', '30s', 'Stay light on your toes'),
                ]
            },
            'Day 2': {
                'type': 'Upper Body Strength', 'focus': 'Chest, Shoulders, Triceps', 'duration': '45 min', 'color': '#6366f1',
                'exercises': [
                    _ex('Push-ups', 4, '15 reps', '45s', 'Full ROM, chest touches floor'),
                    _ex('Pike Push-ups', 3, '12 reps', '45s', 'Targets shoulders, hips high'),
                    _ex('Tricep Dips (Chair)', 3, '12 reps', '45s', 'Elbows close to body'),
                    _ex('Diamond Push-ups', 3, '10 reps', '45s', 'Hands form a diamond shape'),
                    _ex('Plank Hold', 3, '60s', '30s', 'Straight line head to heel'),
                ]
            },
            'Day 3': {
                'type': 'Active Recovery', 'focus': 'Mobility and Flexibility', 'duration': '30 min', 'color': '#22c55e',
                'exercises': [
                    _ex('Brisk Walk', 1, '20 min', '-', 'Maintain conversational pace'),
                    _ex('Hip Flexor Stretch', 2, '60s each side', '-', 'Lunge position, push hips forward'),
                    _ex('Cat-Cow Stretch', 2, '10 reps', '-', 'Slow and controlled breathing'),
                    _ex('Pigeon Pose', 2, '60s each side', '-', 'Hold and breathe deeply'),
                    _ex("Child's Pose", 2, '60s', '-', 'Relax entire back'),
                ]
            },
            'Day 4': {
                'type': 'HIIT Cardio', 'focus': 'Speed and Agility', 'duration': '40 min', 'color': '#f43f5e',
                'exercises': [
                    _ex('Sprint Intervals', 6, '30s on / 30s off', '-', 'Max effort on, walk during off'),
                    _ex('Box Jumps', 4, '12 reps', '45s', 'Land with soft knees, step down'),
                    _ex('Lateral Shuffles', 4, '30s', '30s', 'Stay low, quick feet'),
                    _ex('Jump Squats', 4, '15 reps', '45s', 'Explode upward, land quietly'),
                    _ex('Plank to Downdog', 3, '10 reps', '30s', 'Controlled transition'),
                ]
            },
            'Day 5': {
                'type': 'Lower Body Strength', 'focus': 'Glutes, Quads, Hamstrings', 'duration': '45 min', 'color': '#6366f1',
                'exercises': [
                    _ex('Hip Thrusts / Glute Bridges', 4, '20 reps', '30s', 'Squeeze glutes at top, hold 1s'),
                    _ex('Bodyweight Squats', 4, '20 reps', '45s', 'Knees track over toes, depth below parallel'),
                    _ex('Reverse Lunges', 3, '12 each leg', '45s', 'Back knee hovers above floor'),
                    _ex('Lateral Band Walks', 3, '15 each way', '45s', 'Great for glute medius activation'),
                    _ex('Calf Raises', 3, '20 reps', '30s', 'Full extension at top, pause'),
                ] if gender.lower() == 'female' else [
                    _ex('Bodyweight Squats', 4, '20 reps', '45s', 'Knees track over toes, depth below parallel'),
                    _ex('Reverse Lunges', 3, '12 each leg', '45s', 'Back knee hovers above floor'),
                    _ex('Glute Bridges', 4, '20 reps', '30s', 'Squeeze glutes at top, hold 1s'),
                    _ex('Wall Sit', 3, '60s', '45s', 'Thighs parallel to floor'),
                    _ex('Calf Raises', 3, '20 reps', '30s', 'Full extension at top, pause'),
                ]
            },
            'Day 6': {
                'type': 'Full Body Circuit', 'focus': 'Endurance and Strength', 'duration': '50 min', 'color': '#f97316',
                'exercises': [
                    _ex('Burpee + Push-up', 4, '10 reps', '45s', 'Add push-up at the bottom of each burpee'),
                    _ex('Squat + Overhead Press', 3, '12 reps', '45s', 'Use dumbbells or water bottles'),
                    _ex('Renegade Row', 3, '10 each side', '45s', 'Keep hips square to floor'),
                    _ex('Jumping Lunges', 3, '10 each leg', '45s', 'Explosive switch, land softly'),
                    _ex('Plank + Shoulder Tap', 3, '10 each side', '30s', 'Minimal hip rotation'),
                ]
            },
            'Day 7': {
                'type': 'Rest Day', 'focus': 'Recovery', 'duration': '-', 'color': '#94a3b8',
                'exercises': [
                    _ex('Complete Rest', 1, '-', '-', 'Let your muscles repair and grow'),
                    _ex('Optional Light Walk', 1, '20-30 min', '-', 'Fresh air, low intensity only'),
                    _ex('Foam Rolling', 1, '10-15 min', '-', 'Focus on sore muscle groups'),
                ]
            },
        }
    elif goal.lower() == 'muscle gain':
        plans = {
            'Day 1': {
                'type': 'Chest and Triceps', 'focus': 'Upper Body Push', 'duration': '60 min', 'color': '#6366f1',
                'exercises': [
                    _ex('Bench Press', 4, '8-10 reps', '90s', 'Full ROM, controlled descent, drive through chest'),
                    _ex('Incline Dumbbell Press', 3, '10-12 reps', '75s', 'Elbows at 45 degrees, squeeze at top'),
                    _ex('Cable Chest Fly', 3, '12-15 reps', '60s', 'Slight bend in elbows, feel the stretch'),
                    _ex('Tricep Rope Pushdown', 3, '12-15 reps', '45s', 'Flare hands at bottom of movement'),
                    _ex('Overhead Tricep Extension', 3, '12 reps', '45s', 'Keep elbows pointing forward'),
                ]
            },
            'Day 2': {
                'type': 'Back and Biceps', 'focus': 'Upper Body Pull', 'duration': '60 min', 'color': '#06b6d4',
                'exercises': [
                    _ex('Deadlift', 4, '6-8 reps', '120s', 'Neutral spine, drive through heels'),
                    _ex('Pull-ups / Lat Pulldown', 3, '8-10 reps', '90s', 'Full extension at bottom'),
                    _ex('Seated Cable Row', 3, '10-12 reps', '75s', 'Pull elbows back, squeeze scapula'),
                    _ex('Dumbbell Bicep Curl', 3, '12 reps', '60s', 'Supinate at top, no swinging'),
                    _ex('Hammer Curl', 3, '12 reps', '45s', 'Targets brachialis and forearms'),
                ]
            },
            'Day 3': {
                'type': 'Rest / Active Recovery', 'focus': 'Mobility', 'duration': '20-30 min', 'color': '#22c55e',
                'exercises': [
                    _ex('Light Walk or Cycle', 1, '20 min', '-', 'Keep heart rate low, recover actively'),
                    _ex('Thoracic Spine Stretch', 2, '60s', '-', 'Use foam roller on upper back'),
                    _ex('Lat Stretch', 2, '60s each side', '-', 'Doorframe or band stretch'),
                    _ex('Wrist and Forearm Stretch', 2, '60s', '-', 'Important after heavy pulling days'),
                ]
            },
            'Day 4': {
                'type': 'Legs', 'focus': 'Quads, Hamstrings, Glutes, Calves', 'duration': '65 min', 'color': '#f97316',
                'exercises': [
                    _ex('Barbell Squat', 4, '8-10 reps', '120s', 'Depth below parallel, chest up, brace core'),
                    _ex('Romanian Deadlift', 3, '10-12 reps', '90s', 'Hinge at hips, feel hamstring stretch'),
                    _ex('Hip Thrusts', 4, '10-12 reps', '90s', 'Heavy load, focus on glute contraction'),
                    _ex('Bulgarian Split Squats', 3, '10 each leg', '75s', 'Great for lower body symmetry'),
                    _ex('Leg Curl', 3, '12-15 reps', '60s', 'Slow eccentric, squeeze at top'),
                ] if gender.lower() == 'female' else [
                    _ex('Barbell Squat', 4, '8-10 reps', '120s', 'Depth below parallel, chest up, brace core'),
                    _ex('Romanian Deadlift', 3, '10-12 reps', '90s', 'Hinge at hips, feel hamstring stretch'),
                    _ex('Leg Press', 3, '12-15 reps', '75s', 'Feet shoulder-width, full ROM'),
                    _ex('Leg Curl', 3, '12-15 reps', '60s', 'Slow eccentric, squeeze at top'),
                    _ex('Standing Calf Raise', 4, '15-20 reps', '45s', 'Full extension, hold 1s at top'),
                ]
            },
            'Day 5': {
                'type': 'Shoulders and Abs', 'focus': 'Deltoids and Core', 'duration': '55 min', 'color': '#a855f7',
                'exercises': [
                    _ex('Overhead Press (BB/DB)', 4, '8-10 reps', '90s', 'Full lockout overhead, no lower-back arch'),
                    _ex('Lateral Raise', 3, '12-15 reps', '60s', 'Lead with elbows, slight forward lean'),
                    _ex('Face Pull', 3, '15 reps', '45s', 'Targets rear delts and external rotators'),
                    _ex('Cable Crunch', 3, '15-20 reps', '45s', 'Round through the abs, chin to chest'),
                    _ex('Hanging Leg Raise', 3, '12 reps', '60s', 'Slow and controlled on the way down'),
                ]
            },
            'Day 6': {
                'type': 'Full Body Power', 'focus': 'Compound Strength', 'duration': '60 min', 'color': '#f43f5e',
                'exercises': [
                    _ex('Power Clean', 4, '5 reps', '120s', 'Explosive hip drive, catch in rack position'),
                    _ex('Front Squat', 3, '8 reps', '90s', 'Elbows high, upright torso'),
                    _ex('Weighted Pull-up', 3, '6-8 reps', '90s', 'Add belt weight for progression'),
                    _ex('Dumbbell Row', 3, '10 each side', '60s', 'Elbow past torso, full stretch'),
                    _ex("Farmer's Carry", 3, '30m walk', '60s', 'Heavy load, tight core, tall posture'),
                ]
            },
            'Day 7': {
                'type': 'Rest Day', 'focus': 'Recovery', 'duration': '-', 'color': '#94a3b8',
                'exercises': [
                    _ex('Complete Rest', 1, '-', '-', 'Muscles grow during recovery, not training'),
                    _ex('Protein and Nutrition Focus', 1, '-', '-', 'Hit your calorie and protein targets today'),
                    _ex('Optional Stretch / Foam Roll', 1, '15 min', '-', 'Light work only, no loading'),
                ]
            },
        }
    else:
        plans = {
            'Day 1': {
                'type': 'Moderate Cardio', 'focus': 'Aerobic Base', 'duration': '35 min', 'color': '#06b6d4',
                'exercises': [
                    _ex('Jogging', 1, '20 min', '-', 'Conversational pace, nasal breathing'),
                    _ex('Cycling', 1, '15 min', '-', 'Moderate resistance'),
                    _ex('Cool-down Walk', 1, '5 min', '-', 'Gradual heart rate drop'),
                ]
            },
            'Day 2': {
                'type': 'Upper Body', 'focus': 'Push and Pull Balance', 'duration': '40 min', 'color': '#6366f1',
                'exercises': [
                    _ex('Push-ups', 3, '12 reps', '45s', 'Chest to floor, full range'),
                    _ex('Dumbbell Row', 3, '12 each side', '45s', 'Squeeze at top'),
                    _ex('Shoulder Press', 3, '12 reps', '45s', 'Full lockout overhead'),
                    _ex('Bicep Curl', 2, '12 reps', '30s', 'Slow and controlled'),
                    _ex('Tricep Dip', 2, '12 reps', '30s', 'Elbows stay close to body'),
                ]
            },
            'Day 3': {
                'type': 'Active Recovery', 'focus': 'Mobility', 'duration': '25 min', 'color': '#22c55e',
                'exercises': [
                    _ex('Yoga Flow', 1, '20 min', '-', 'Sun salutations and hip openers'),
                    _ex('Deep Breathing', 1, '5 min', '-', 'Box breathing for recovery'),
                ]
            },
            'Day 4': {
                'type': 'Lower Body', 'focus': 'Legs and Glutes', 'duration': '40 min', 'color': '#f97316',
                'exercises': [
                    _ex('Squats', 3, '15 reps', '45s', 'Below parallel, knees track toes'),
                    _ex('Lunges', 3, '12 each leg', '45s', 'Alternate legs, upright torso'),
                    _ex('Glute Bridge', 3, '15 reps', '30s', 'Squeeze glutes at top, hold 1s'),
                    _ex('Step-ups', 3, '12 each leg', '30s', 'Full hip extension at top'),
                    _ex('Calf Raises', 2, '20 reps', '30s', 'Single leg for more challenge'),
                ]
            },
            'Day 5': {
                'type': 'Core and Flexibility', 'focus': 'Stability', 'duration': '30 min', 'color': '#a855f7',
                'exercises': [
                    _ex('Plank', 3, '45s', '30s', 'Perfect straight line, no sagging hips'),
                    _ex('Side Plank', 3, '30s each side', '30s', 'Hip off the floor'),
                    _ex('Dead Bug', 3, '10 each side', '30s', 'Lower back pressed to floor'),
                    _ex('Bird Dog', 3, '10 each side', '30s', 'Opposite arm and leg extend'),
                    _ex('Full Body Stretch', 1, '10 min', '-', 'Hold each stretch for 30 seconds'),
                ]
            },
            'Day 6': {
                'type': 'Sports / Recreation', 'focus': 'Fun and Active', 'duration': '45+ min', 'color': '#06b6d4',
                'exercises': [
                    _ex('Football / Badminton / Swimming', 1, '45 min', '-', 'Enjoy your favourite sport'),
                    _ex('Hiking', 1, 'Optional', '-', 'Great low-impact cardio option'),
                ]
            },
            'Day 7': {
                'type': 'Rest Day', 'focus': 'Recovery', 'duration': '-', 'color': '#94a3b8',
                'exercises': [
                    _ex('Complete Rest', 1, '-', '-', 'Well-deserved rest day'),
                    _ex('Hydration Focus', 1, '-', '-', 'Drink 2.5 to 3 litres of water today'),
                ]
            },
        }
    return plans


class FitnessPDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'AI Fitness Studio - 7-Day Weekly Plan', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()} | Generated on {datetime.now().strftime("%Y-%m-%d")}', 0, 0, 'C')


def generate_pdf(data: dict) -> str:
    pdf = FitnessPDF()
    pdf.add_page()
    pdf.set_font('Arial', '', 12)

    # User Stats
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font('Arial', 'B', 14)
    pdf.cell(0, 10, 'Your Fitness Summary', 0, 1, 'L', True)
    pdf.set_font('Arial', '', 12)
    pdf.cell(0, 10, f'Goal: {data["goal"]}', 0, 1)
    pdf.cell(0, 10, f'BMI: {data["bmi"]}', 0, 1)
    pdf.cell(0, 10, f'Daily Target: {data["calories"]} kcal', 0, 1)
    pdf.cell(0, 10, f'Macros: P: {data["protein"]}g | C: {data["carbs"]}g | F: {data["fats"]}g', 0, 1)
    pdf.ln(10)

    # Weekly Plan
    for i in range(1, 8):
        day_key = f"Day {i}"
        diet = data['weekly_diet'][day_key]
        workout = data['weekly_workout'][day_key]

        if i % 2 == 1 and i > 1:
            pdf.add_page()

        pdf.set_font('Arial', 'B', 14)
        pdf.set_text_color(99, 102, 241) # Primary color
        pdf.cell(0, 10, f'--- {day_key} ---', 0, 1, 'C')
        pdf.set_text_color(0, 0, 0)
        
        # Diet
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, 'Diet Plan:', 0, 1)
        pdf.set_font('Arial', '', 11)
        pdf.multi_cell(0, 8, f"- Breakfast: {diet['breakfast']}")
        pdf.multi_cell(0, 8, f"- Lunch: {diet['lunch']}")
        pdf.multi_cell(0, 8, f"- Dinner: {diet['dinner']}")
        
        # Workout
        pdf.ln(2)
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, f'Workout ({workout["type"]}):', 0, 1)
        pdf.set_font('Arial', '', 11)
        for ex in workout['exercises']:
            pdf.cell(0, 8, f"  * {ex['name']} - {ex['sets']} sets x {ex['reps']}", 0, 1)
        
        pdf.ln(10)

    if not os.path.exists('temp_uploads'):
        os.makedirs('temp_uploads')

    filename = f"temp_uploads/weekly_plan_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    pdf.output(filename)
    return filename

# --- Routes ---

@router.get("/profile")
def get_profile(current_user: TokenData = Depends(get_current_user)):
    profile = get_user_profile(current_user.user_id)
    if profile:
        return profile
    return {}

@router.put("/profile")
def update_profile(data: ProfileUpdate, current_user: TokenData = Depends(get_current_user)):
    success = update_user_profile(
        current_user.user_id,
        data.email,
        data.age,
        data.gender,
        data.height,
        data.weight,
        data.activity,
        data.diet_type,
        data.mobile_no,
        data.date_of_birth
    )
    if success:
        return {"message": "Profile updated successfully"}
    raise HTTPException(status_code=400, detail="Profile update failed")

@router.post("/generate")
def generate_plan(data: GeneratePlanRequest, current_user: TokenData = Depends(get_current_user)):
    try:
        # Fetch current profile to preserve email, mobile_no, date_of_birth
        curr_profile = get_user_profile(current_user.user_id) or {}
        email = curr_profile.get("email", "")
        mobile_no = curr_profile.get("mobile_no", "")
        dob = curr_profile.get("date_of_birth", "")

        # Update user profile
        update_user_profile(
            current_user.user_id,
            email,
            data.age,
            data.gender,
            data.height,
            data.weight,
            data.activity,
            data.diet_type,
            mobile_no,
            dob
        )
        
        bmi = calculate_bmi(data.weight, data.height)
        bmr = calculate_bmr(data.weight, data.height, data.age, data.gender)
        tdee = bmr * data.activity

        if data.goal.lower() == 'fat loss':
            calories = tdee - 500
        elif data.goal.lower() == 'muscle gain':
            calories = tdee + 300
        else:
            calories = tdee

        results = {
            'bmi': bmi,
            'calories': round(calories),
            'protein': round((calories * 0.3) / 4),
            'carbs': round((calories * 0.45) / 4),
            'fats': round((calories * 0.25) / 9),
            'weekly_diet': get_weekly_diet(data.goal, data.diet_type, data.gender),
            'weekly_workout': get_weekly_workout(data.goal, data.gender),
            'goal': data.goal.capitalize(),
            'weight': data.weight,
            'height': data.height
        }

        # Save record
        save_fitness_record(
            user_id=current_user.user_id,
            weight=data.weight,
            height=data.height,
            bmi=bmi,
            calories=round(calories),
            goal=data.goal.capitalize(),
            plan_json=json.dumps(results)
        )

        # Save Diet & Workout Routines
        for day_name, diet in results['weekly_diet'].items():
            save_diet_routine(
                user_id=current_user.user_id,
                day_name=day_name,
                breakfast=diet.get('breakfast', ''),
                lunch=diet.get('lunch', ''),
                dinner=diet.get('dinner', ''),
                tip=diet.get('tip', '')
            )
            
        for day_name, workout in results['weekly_workout'].items():
            workout_routine_id = save_workout_routine(
                user_id=current_user.user_id,
                day_name=day_name,
                workout_type=workout.get('type', ''),
                focus=workout.get('focus', ''),
                duration=workout.get('duration', ''),
                color=workout.get('color', '')
            )
            
            if workout_routine_id:
                for ex in workout.get('exercises', []):
                    save_workout_exercise(
                        workout_routine_id=workout_routine_id,
                        name=ex.get('name', ''),
                        sets=ex.get('sets', 0),
                        reps=ex.get('reps', ''),
                        rest=ex.get('rest', ''),
                        notes=ex.get('notes', '')
                    )

        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error generating plan: {str(e)}")

@router.get("/history")
def get_history(current_user: TokenData = Depends(get_current_user)):
    records = get_fitness_history(current_user.user_id)
    # Parse json for the frontend
    for r in records:
        try:
            r['plan_json'] = json.loads(r['plan_json'])
        except Exception:
            pass
    return records

@router.post("/download_pdf")
def download_pdf(data: GeneratePdfRequest):
    try:
        results = json.loads(data.results_json)
        pdf_path = generate_pdf(results)
        return FileResponse(pdf_path, filename="AI_Fitness_Weekly_Plan.pdf", media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
