import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { dietApi } from '@/lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateName } = useAuth();
  const { addToast } = useToast();

  const [profile, setProfile] = useState<any>({
    name: user?.name || '',
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProfile((prev: any) => ({ ...prev, name: user?.name || '', email: user?.email || '' }));
      setLoading(true);
      dietApi.getProfile()
        .then((data) => {
          if (data && Object.keys(data).length > 0) {
            setProfile((prev: any) => ({ ...prev, ...data }));
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setIsEditing(false);
    }
  }, [isOpen, user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (profile.name !== user?.name) {
        await updateName(profile.name);
      }
      
      await dietApi.updateProfile({
        email: profile.email,
        mobile_no: profile.mobile_no || '',
        date_of_birth: profile.date_of_birth || '',
        age: Number(profile.age) || 25,
        gender: profile.gender || 'Male',
        height: Number(profile.height) || 170,
        weight: Number(profile.weight) || 70,
        activity: Number(profile.activity) || 1.2,
        diet_type: profile.diet_type || 'Veg'
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

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div 
        className="w-full max-w-lg neo-card flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          background: 'rgba(18, 18, 36, 0.95)',
          animation: 'modalScaleIn 0.3s ease-out'
        }}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="font-orbitron text-xl text-white font-bold tracking-wider flex items-center gap-2">
            <span className="text-[#c084fc]">&#128100;</span> PROFILE
          </h2>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
              disabled={saving || loading}
              className="text-xs font-bold tracking-widest text-[#00d4ff] hover:text-white transition-colors"
            >
              {saving ? 'SAVING...' : (isEditing ? 'SAVE' : 'EDIT')}
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-2 border-[#c084fc] border-t-transparent rounded-full animate-spin-loader" />
            </div>
          ) : (
            <div className="space-y-6">
              
              <div className="bg-black/40 rounded-xl p-5 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-bold tracking-wider mb-1">CURRENT BMI</p>
                  <p className="font-orbitron text-3xl font-bold text-white">{calculateBMI()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold tracking-wider mb-1">WEIGHT</p>
                  <p className="font-orbitron text-xl font-bold text-[#c084fc]">{profile.weight || '--'} kg</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">NAME</label>
                  {isEditing ? (
                    <input type="text" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" placeholder="e.g., John" />
                  ) : (
                    <p className="text-sm text-gray-300 font-medium">{profile.name || 'Not set'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">EMAIL</label>
                  {isEditing ? (
                    <input type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" disabled />
                  ) : (
                    <p className="text-sm text-gray-300">{profile.email || 'Not set'}</p>
                  )}
                  {isEditing && <p className="text-[10px] text-gray-500 mt-1">Email cannot be changed.</p>}
                </div>
                
                <div>
                  <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">MOBILE NO.</label>
                  {isEditing ? (
                    <input type="text" value={profile.mobile_no} onChange={e => setProfile({...profile, mobile_no: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" />
                  ) : (
                    <p className="text-sm text-gray-300">{profile.mobile_no || 'Not set'}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">DATE OF BIRTH</label>
                    {isEditing ? (
                      <input type="date" value={profile.date_of_birth} onChange={e => setProfile({...profile, date_of_birth: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" style={{colorScheme: 'dark'}} />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.date_of_birth || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">GENDER</label>
                    {isEditing ? (
                      <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors">
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
                      <input type="number" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.height || '--'} cm</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold tracking-wider text-gray-500 mb-1">WEIGHT (KG)</label>
                    {isEditing ? (
                      <input type="number" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#c084fc] outline-none transition-colors" />
                    ) : (
                      <p className="text-sm text-gray-300">{profile.weight || '--'} kg</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalScaleIn {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
