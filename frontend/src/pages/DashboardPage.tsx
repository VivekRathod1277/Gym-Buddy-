import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Dumbbell, Apple, LineChart } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  const navigate = useNavigate();


  
  const [loading] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#242730] text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#242730]">
      <Sidebar />

      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 p-4 md:p-8 pt-20 md:pt-24 max-w-7xl mx-auto w-full">
          
          <div className="mb-8">
            <h1 className="font-orbitron text-3xl md:text-4xl text-white font-bold mb-2">
          WELCOME BACK
        </h1>
        <p className="text-gray-400 font-inter text-sm md:text-base">
          What would you like to focus on today?
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column - Features */}
        <div className="flex-1 space-y-6">
          <div 
            onClick={() => navigate('/workout')}
            className="neo-card p-6 md:p-8 cursor-pointer hover:border-[#00d4ff]/50 hover:bg-white/5 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d4ff]/10 rounded-full blur-3xl group-hover:bg-[#00d4ff]/20 transition-all"></div>
            <h2 className="font-orbitron text-2xl text-white font-bold mb-2 flex items-center gap-3">
              <span className="text-[#00d4ff]"><Dumbbell className="w-6 h-6" /></span> START WORKOUT
            </h2>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              Launch the AI biomechanics trainer for real-time form correction and rep tracking.
            </p>
            <span className="text-[#00d4ff] font-bold text-sm tracking-wider group-hover:underline">LAUNCH TRAINER &rarr;</span>
          </div>

          <div 
            onClick={() => navigate('/diet-planner')}
            className="neo-card p-6 md:p-8 cursor-pointer hover:border-[#00ff88]/50 hover:bg-white/5 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00ff88]/10 rounded-full blur-3xl group-hover:bg-[#00ff88]/20 transition-all"></div>
            <h2 className="font-orbitron text-2xl text-white font-bold mb-2 flex items-center gap-3">
              <span className="text-[#00ff88]"><Apple className="w-6 h-6" /></span> DIET & WORKOUT PLAN
            </h2>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              Generate a personalized 7-day meal and workout plan based on your latest fitness metrics.
            </p>
            <span className="text-[#00ff88] font-bold text-sm tracking-wider group-hover:underline">OPEN PLANNER &rarr;</span>
          </div>

          <div 
            onClick={() => navigate('/history')}
            className="neo-card p-6 md:p-8 cursor-pointer hover:border-[#ff4d6d]/50 hover:bg-white/5 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff4d6d]/10 rounded-full blur-3xl group-hover:bg-[#ff4d6d]/20 transition-all"></div>
            <h2 className="font-orbitron text-2xl text-white font-bold mb-2 flex items-center gap-3">
              <span className="text-[#ff4d6d]"><LineChart className="w-6 h-6" /></span> WORKOUT HISTORY
            </h2>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              Review your past AI training sessions, form accuracy, and volume progressed.
            </p>
            <span className="text-[#ff4d6d] font-bold text-sm tracking-wider group-hover:underline">VIEW HISTORY &rarr;</span>
          </div>
        </div>

        </div>
      </div>
  </main>
</div>
  );
}
