import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { dietApi } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<any>({
    email: user?.email || '',
    mobile_no: '',
    date_of_birth: '',
    age: '',
    gender: 'Male',
    height: '',
    weight: '',
    activity: 1.2,
    diet_type: 'Veg'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    dietApi.getProfile()
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          setProfile((prev: any) => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await dietApi.updateProfile({
        email: profile.email,
        mobile_no: profile.mobile_no || '',
        date_of_birth: profile.date_of_birth || '',
        age: Number(profile.age) || 25,
        gender: profile.gender,
        height: Number(profile.height) || 170,
        weight: Number(profile.weight) || 70,
        activity: Number(profile.activity),
        diet_type: profile.diet_type
      });
      addToast('Profile updated successfully!', 'success');
      setIsEditing(false);
    } catch (error) {
      addToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calculateBMI = () => {
    const h = Number(profile.height) / 100;
    const w = Number(profile.weight);
    if (h > 0 && w > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return '--';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#242730] text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#242730]">
      <Sidebar />

      <main className="flex-1 md:ml-[260px] pb-[70px] md:pb-0 flex flex-col min-h-screen">
        <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          
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
              <span className="text-[#00d4ff]">&#127947;</span> START WORKOUT
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
              <span className="text-[#00ff88]">&#127822;</span> DIET & WORKOUT PLAN
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
              <span className="text-[#ff4d6d]">&#128200;</span> WORKOUT HISTORY
            </h2>
            <p className="text-gray-400 text-sm mb-4 max-w-md">
              Review your past AI training sessions, form accuracy, and volume progressed.
            </p>
            <span className="text-[#ff4d6d] font-bold text-sm tracking-wider group-hover:underline">VIEW HISTORY &rarr;</span>
          </div>
        </div>

        {/* Right Column - Profile */}
        <div className="w-full lg:w-[400px]">
          <div className="neo-card p-6 sticky top-24">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-orbitron text-xl text-white font-bold tracking-wider flex items-center gap-2">
                <span className="text-[#c084fc]">&#128100;</span> PROFILE
              </h2>
              <button 
                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                disabled={saving}
                className="text-xs font-bold tracking-widest text-[#00d4ff] hover:text-white transition-colors"
              >
                {saving ? 'SAVING...' : (isEditing ? 'SAVE' : 'EDIT')}
              </button>
            </div>

            {/* Profile Content */}
            <div className="space-y-5">
              
              {/* BMI Widget */}
              <div className="bg-black/30 rounded-xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold tracking-wider mb-1">CURRENT BMI</p>
                  <p className="font-orbitron text-2xl font-bold text-white">{calculateBMI()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold tracking-wider mb-1">WEIGHT</p>
                  <p className="font-orbitron text-lg font-bold text-gray-300">{profile.weight || '--'} kg</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">EMAIL</label>
                  {isEditing ? (
                    <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  ) : (
                    <p className="text-sm text-gray-300">{profile.email || 'Not set'}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">MOBILE NO.</label>
                  {isEditing ? (
                    <input type="text" value={profile.mobile_no} onChange={e => setProfile({...profile, mobile_no: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                  ) : (
                    <p className="text-sm text-gray-300">{profile.mobile_no || 'Not set'}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">DATE OF BIRTH</label>
                    {isEditing ? (
                      <input type="date" value={profile.date_of_birth} onChange={e => setProfile({...profile, date_of_birth: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white" style={{colorScheme: 'dark'}} />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.date_of_birth || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">GENDER</label>
                    {isEditing ? (
                      <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white">
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-300">{profile.gender}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">HEIGHT (CM)</label>
                    {isEditing ? (
                      <input type="number" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.height || '--'} cm</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">WEIGHT (KG)</label>
                    {isEditing ? (
                      <input type="number" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white" />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.weight || '--'} kg</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
  );
}
