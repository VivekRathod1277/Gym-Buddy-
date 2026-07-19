import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { dietApi } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function DietPlannerPage() {
  const [formData, setFormData] = useState({
    age: 25,
    gender: 'Male',
    height: 175,
    weight: 70,
    activity: 1.55,
    diet_type: 'Veg',
    goal: 'Fat Loss'
  });
  
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    // Load existing profile if available
    dietApi.getProfile()
      .then((data) => {
        if (data && data.age) {
          setFormData(prev => ({
            ...prev,
            age: data.age,
            gender: data.gender,
            height: data.height,
            weight: data.weight,
            activity: data.activity,
            diet_type: data.diet_type
          }));
        }
      })
      .catch(err => console.error("Error loading profile:", err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['age', 'height', 'weight', 'activity'].includes(name) ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const results = await dietApi.generatePlan(formData);
      // Store results in localStorage to display on the dashboard page
      localStorage.setItem('latestDietPlan', JSON.stringify(results));
      addToast('Plan generated successfully!', 'success');
      navigate('/diet-dashboard');
    } catch (error) {
      addToast('Failed to generate plan', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-32 md:pb-12 px-4 md:px-8 max-w-3xl mx-auto">
      <div className="neo-card p-6 md:p-8">
        <h1 className="font-orbitron text-2xl md:text-3xl text-white font-bold mb-2">
          AI DIET & WORKOUT PLANNER
        </h1>
        <p className="text-gray-400 font-inter mb-8">
          Enter your details below to generate a customized 7-day meal and workout plan.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Age */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">AGE</label>
              <input 
                type="number" 
                name="age" 
                value={formData.age} 
                onChange={handleChange}
                required
                min="10" max="100"
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">GENDER</label>
              <select 
                name="gender" 
                value={formData.gender} 
                onChange={handleChange}
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00d4ff] transition-colors"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            {/* Height */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">HEIGHT (cm)</label>
              <input 
                type="number" 
                name="height" 
                value={formData.height} 
                onChange={handleChange}
                required
                min="100" max="250"
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>

            {/* Weight */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">WEIGHT (kg)</label>
              <input 
                type="number" 
                name="weight" 
                value={formData.weight} 
                onChange={handleChange}
                required
                min="30" max="300"
                step="0.1"
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>

            {/* Activity Level */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">ACTIVITY LEVEL</label>
              <select 
                name="activity" 
                value={formData.activity} 
                onChange={handleChange}
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00d4ff] transition-colors"
              >
                <option value={1.2}>Sedentary (Little or no exercise)</option>
                <option value={1.375}>Lightly active (Light exercise 1-3 days/week)</option>
                <option value={1.55}>Moderately active (Moderate exercise 3-5 days/week)</option>
                <option value={1.725}>Very active (Hard exercise 6-7 days/week)</option>
                <option value={1.9}>Super active (Very hard exercise & physical job)</option>
              </select>
            </div>

            {/* Goal */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">YOUR GOAL</label>
              <select 
                name="goal" 
                value={formData.goal} 
                onChange={handleChange}
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00ff88] transition-colors"
              >
                <option value="Fat Loss">Fat Loss</option>
                <option value="Muscle Gain">Muscle Gain</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            {/* Diet Type */}
            <div className="flex flex-col gap-2">
              <label className="font-inter text-sm text-gray-300 font-semibold tracking-wider">DIET PREFERENCE</label>
              <select 
                name="diet_type" 
                value={formData.diet_type} 
                onChange={handleChange}
                className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white font-inter focus:outline-none focus:border-[#00ff88] transition-colors"
              >
                <option value="Veg">Vegetarian</option>
                <option value="Eggitarian">Eggitarian</option>
              </select>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-8 rounded-xl font-orbitron font-bold text-lg tracking-widest text-black transition-all bg-[#00d4ff] hover:bg-[#00e5ff] shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:shadow-[0_0_25px_rgba(0,212,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'GENERATING...' : 'GENERATE PLAN'}
          </button>
        </form>
      </div>
    </div>
  );
}
