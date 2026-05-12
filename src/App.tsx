import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Calendar, 
  User, 
  Settings, 
  Star, 
  LogOut, 
  Plus, 
  ChevronRight, 
  Clock, 
  CheckCircle2,
  X,
  History,
  Trash2,
  Edit2,
  Save,
  ChevronLeft,
  Filter,
  Sparkles,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Button, Card, Input, Badge } from './components/ui';
import { db } from './lib/firebase';
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc, 
  onSnapshot,
  query, 
  where, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Service, BarberProfile, Booking, UserRole } from './types';
import { formatCurrency, cn } from './lib/utils';
import { format, addMinutes, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { QueueScreen } from './screens/QueueScreen';
import { BarberQueueScreen } from './screens/BarberQueueScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { BookingScreen } from './screens/BookingScreen';
import { BarberListScreen } from './screens/BarberListScreen';
import { AISuggestionScreen } from './screens/AISuggestionScreen';
import { BookingHistoryScreen } from './screens/BookingHistoryScreen';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, role }: { activeTab: string, setActiveTab: (t: string) => void, role: UserRole }) => {
  const tabs = role === 'customer' 
    ? [
        { id: 'barbers', label: 'Barbers', icon: User },
        { id: 'queue', label: 'Queue', icon: Clock },
        { id: 'book', label: 'Special', icon: Scissors },
        { id: 'profile', label: 'Systems', icon: Settings },
      ]
    : [
        { id: 'barber-queue', label: 'Terminal', icon: Clock },
        { id: 'analytics', label: 'Metrics', icon: Calendar },
        { id: 'profile', label: 'Systems', icon: User },
      ];

  const clientTabsWithAI = role === 'customer' ? [
    ...tabs.slice(0, -1),
    { id: 'ai', label: 'Counsel', icon: Sparkles },
    tabs[tabs.length - 1]
  ] : tabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-4 pb-10 flex justify-around items-center z-50">
      {clientTabsWithAI.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all text-[10px] font-bold uppercase tracking-[0.2em]",
              isActive ? "text-zinc-900" : "text-stone-300"
            )}
          >
            <div className={cn(
              "w-8 h-8 flex items-center justify-center transition-all",
              isActive ? "bg-zinc-900 text-white" : "bg-stone-50"
            )}>
              <Icon size={14} />
            </div>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Views ---

const Landing = () => {
  const { signIn, signingIn } = useAuth();
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-8 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12 max-w-sm"
      >
        <div className="space-y-4">
          <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center mx-auto shadow-2xl">
            <Scissors className="text-white" size={32} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tighter uppercase text-slate-900">The Sharp Edge</h1>
            <p className="text-[10px] text-stone-500 uppercase tracking-[0.3em] font-bold">Professional Grooming Systems</p>
          </div>
        </div>
        <Button 
          onClick={signIn} 
          disabled={signingIn}
          size="lg" 
          className="w-full h-16 shadow-xl"
        >
          {signingIn ? 'Authorizing...' : 'Enter System'}
        </Button>
      </motion.div>
    </div>
  );
};

const RoleSelection = () => {
  const { updateRole } = useAuth();
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-8 text-center space-y-12">
      <div className="space-y-2">
        <h2 className="text-xl font-bold uppercase tracking-tight text-zinc-900">Select Interface</h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Authentication Successful</p>
      </div>
      <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
        <button 
          onClick={() => updateRole('customer')}
          className="group relative bg-white p-8 border border-stone-200 text-left hover:border-zinc-900 transition-all shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <User size={24} className="text-zinc-900" />
            <div className="w-6 h-px bg-stone-200 group-hover:w-10 group-hover:bg-zinc-900 transition-all" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-widest">Client Portal</h3>
          <p className="text-[10px] text-stone-400 uppercase mt-1">Book services</p>
        </button>
        <button 
          onClick={() => updateRole('barber')}
          className="group relative bg-white p-8 border border-stone-200 text-left hover:border-zinc-900 transition-all shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <Scissors size={24} className="text-zinc-900" />
            <div className="w-6 h-px bg-stone-200 group-hover:w-10 group-hover:bg-zinc-900 transition-all" />
          </div>
          <h3 className="font-bold text-xs uppercase tracking-widest">Barber Console</h3>
          <p className="text-[10px] text-stone-400 uppercase mt-1">Manage operations</p>
        </button>
      </div>
    </div>
  );
};

const WorkingHoursManager = () => {
  const { user } = useAuth();
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchBarber = async () => {
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        const data = snap.data() as BarberProfile;
        // Default working hours if missing
        if (!data.workingHours) {
          data.workingHours = {
            monday: { start: '09:00', end: '17:00', enabled: true },
            tuesday: { start: '09:00', end: '17:00', enabled: true },
            wednesday: { start: '09:00', end: '17:00', enabled: true },
            thursday: { start: '09:00', end: '17:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '10:00', end: '14:00', enabled: true },
            sunday: { start: '10:00', end: '14:00', enabled: false },
          };
        }
        setBarberProfile(data);
      }
      setLoading(false);
    };
    fetchBarber();
  }, [user]);

  const toggleDay = (day: string) => {
    if (!barberProfile?.workingHours) return;
    const current = barberProfile.workingHours[day];
    setBarberProfile({
      ...barberProfile,
      workingHours: {
        ...barberProfile.workingHours,
        [day]: { ...current, enabled: !current.enabled }
      }
    });
  };

  const updateTime = (day: string, type: 'start' | 'end', value: string) => {
    if (!barberProfile?.workingHours) return;
    const current = barberProfile.workingHours[day];
    setBarberProfile({
      ...barberProfile,
      workingHours: {
        ...barberProfile.workingHours,
        [day]: { ...current, [type]: value }
      }
    });
  };

  const toggleAvailability = () => {
     if (!barberProfile) return;
     const newStatus = !barberProfile.available;
     if (confirm(`Switch system to ${newStatus ? 'OPERATIONAL' : 'MAINTENANCE'} mode?`)) {
       setBarberProfile({
         ...barberProfile,
         available: newStatus
       });
     }
  };

  const save = async () => {
    if (!user || !barberProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), barberProfile as any);
      alert('SYSTEM UPDATED');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-300">Accessing Node Configuration...</div>;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Global Availability</h3>
        <div 
          onClick={toggleAvailability}
          className={cn(
            "p-6 border flex justify-between items-center cursor-pointer transition-all",
            barberProfile?.available ? "bg-zinc-900 border-zinc-900 text-white" : "bg-stone-50 border-stone-200 text-stone-400"
          )}
        >
          <span className="text-xs font-bold uppercase tracking-widest">{barberProfile?.available ? 'Operational' : 'Maintenance Mode'}</span>
          <div className={cn("w-3 h-3 rounded-full", barberProfile?.available ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-stone-200")} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Temporal Constraints</h3>
        <div className="space-y-2">
          {days.map(day => {
            const config = barberProfile?.workingHours?.[day];
            if (!config) return null;
            return (
              <div key={day} className="flex items-center gap-3">
                <button 
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "w-10 h-10 border text-[9px] font-bold uppercase shrink-0 transition-all",
                    config.enabled ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-stone-200 border-stone-100"
                  )}
                >
                  {day.slice(0, 3)}
                </button>
                <div className={cn(
                  "flex-1 flex gap-2 items-center px-4 h-10 border transition-all",
                  config.enabled ? "bg-white border-stone-200" : "bg-white border-transparent opacity-30"
                )}>
                  <input 
                    type="time" 
                    value={config.start} 
                    disabled={!config.enabled}
                    onChange={(e) => updateTime(day, 'start', e.target.value)}
                    className="bg-transparent text-[10px] font-bold focus:outline-none w-full"
                  />
                  <span className="text-[10px] text-stone-300">—</span>
                  <input 
                    type="time" 
                    value={config.end} 
                    disabled={!config.enabled}
                    onChange={(e) => updateTime(day, 'end', e.target.value)}
                    className="bg-transparent text-[10px] font-bold focus:outline-none w-full text-right"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-16 shadow-xl">
        Commit Parameters
      </Button>
    </div>
  );
};

const ServiceManager = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const snap = await getDocs(collection(db, 'services'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingService?.name || !editingService?.price) return;
    
    try {
      if (editingService.id) {
        await updateDoc(doc(db, 'services', editingService.id), editingService as any);
      } else {
        await addDoc(collection(db, 'services'), editingService);
      }
      
      setEditingService(null);
      fetchServices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete service?')) {
      try {
        await deleteDoc(doc(db, 'services', id));
        fetchServices();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) return <div className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-300">Syncing Services...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Service Definitions</h3>
        <Button size="sm" onClick={() => setEditingService({ name: '', price: 0, durationMinutes: 30, category: 'Haircut', description: '' })}>
          <Plus size={14} className="mr-2" /> Node
        </Button>
      </div>

      <div className="space-y-3">
        {services.map(s => (
          <Card key={s.id} className="p-4 border border-stone-200 group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[8px] font-bold uppercase text-stone-400 tracking-[0.2em] mb-1">{s.category}</p>
                <h4 className="text-xs font-bold uppercase tracking-tight">{s.name}</h4>
                <p className="text-[9px] text-stone-300 uppercase mt-1">{s.durationMinutes}m • {formatCurrency(s.price)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingService(s)} className="p-2 text-stone-300 hover:text-zinc-900 transition-colors">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-stone-200 hover:text-red-500 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {editingService && (
          <div className="fixed inset-0 bg-stone-100/80 backdrop-blur-sm z-[60] flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border-[1px] border-zinc-900 p-8 w-full max-w-sm space-y-6 shadow-2xl"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest">Configure Node</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Name</label>
                  <Input 
                    value={editingService.name} 
                    onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Price</label>
                    <Input 
                      type="number"
                      value={editingService.price} 
                      onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Minutes</label>
                    <Input 
                      type="number"
                      value={editingService.durationMinutes} 
                      onChange={e => setEditingService({ ...editingService, durationMinutes: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Category</label>
                  <Input 
                    value={editingService.category} 
                    onChange={e => setEditingService({ ...editingService, category: e.target.value })}
                    placeholder="Haircut, Beard..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingService(null)}>Cancel</Button>
                <Button className="flex-1" onClick={handleSave}>Initialize</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BarberProfileEditor = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<Partial<BarberProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchBarber = async () => {
      try {
        const snap = await getDoc(doc(db, 'barbers', user.uid));
        if (snap.exists()) {
          setProfileData(snap.data() as BarberProfile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBarber();
  }, [user]);

  const save = async () => {
    if (!user || !profileData) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), profileData);
      alert('NODE PERSISTED');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-[10px] font-bold uppercase tracking-widest text-stone-300">Accessing Metadata...</div>;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Identity Parameters</h3>
        
        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Display Name</label>
          <Input 
            value={profileData?.displayName} 
            onChange={e => setProfileData({ ...profileData, displayName: e.target.value })}
            placeholder="Official Designation"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Photo URL</label>
          <Input 
            value={profileData?.photoURL} 
            onChange={e => setProfileData({ ...profileData, photoURL: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Bio / Mission</label>
          <textarea 
            className="w-full border border-stone-200 p-4 text-xs font-bold uppercase tracking-widest focus:border-zinc-900 focus:outline-none min-h-[100px]"
            value={profileData?.bio} 
            onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
          />
        </div>

        {profileData?.rating !== undefined && (
          <div className="p-4 bg-stone-50 border border-stone-100 flex justify-between items-center">
            <span className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Public Standing</span>
            <div className="flex items-center gap-2">
              <Star size={10} className="fill-zinc-900 text-zinc-900" />
              <span className="text-xs font-bold uppercase tracking-tighter">
                {profileData.rating} ({profileData.reviewCount} Reviews)
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Specialties (comma separated)</label>
          <Input 
            value={profileData?.specialties?.join(', ')} 
            onChange={e => setProfileData({ ...profileData, specialties: e.target.value.split(',').map(s => s.trim()) })}
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full h-16 shadow-xl">
        Update Identity
      </Button>
    </div>
  );
};

const NotificationsView = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user]);

  return (
    <div className="space-y-4">
      {notifications.length > 0 ? (
        notifications.map((n) => (
          <Card key={n.id} className={`p-4 border-l-4 ${n.read ? 'border-zinc-200' : 'border-zinc-900 bg-stone-50'}`}>
            <p className="text-[8px] font-bold uppercase tracking-widest text-stone-400 mb-1">{n.type}</p>
            <h4 className="text-sm font-bold uppercase tracking-tight">{n.title}</h4>
            <p className="text-xs text-stone-600 mt-1">{n.message}</p>
          </Card>
        ))
      ) : (
        <p className="text-center text-[10px] uppercase font-bold text-stone-300 py-10">No alerts in sector</p>
      )}
    </div>
  );
};

const ProfileView = () => {
  const { profile, logout } = useAuth();
  const [activeSubView, setActiveSubView] = useState<'main' | 'schedule' | 'identity' | 'services' | 'history' | 'alerts'>('main');

  if (activeSubView === 'alerts') {
    return (
      <div className="space-y-8 h-full">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveSubView('main')} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Active Alerts</h2>
        </div>
        <NotificationsView />
      </div>
    );
  }

  if (activeSubView === 'history') {
    return (
      <div className="space-y-8 h-full">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveSubView('main')} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Mission History</h2>
        </div>
        <BookingHistoryScreen onBack={() => setActiveSubView('main')} />
      </div>
    );
  }

  if (activeSubView === 'schedule' && profile?.role === 'barber') {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveSubView('main')} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Node Schedule</h2>
        </div>
        <WorkingHoursManager />
      </div>
    );
  }

  if (activeSubView === 'identity' && profile?.role === 'barber') {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveSubView('main')} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Node Metadata</h2>
        </div>
        <BarberProfileEditor />
      </div>
    );
  }

  if (activeSubView === 'services' && profile?.role === 'barber') {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveSubView('main')} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Service Nodes</h2>
        </div>
        <ServiceManager />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold uppercase tracking-tight">System Identity</h2>
        <div className="h-0.5 w-12 bg-zinc-900" />
      </div>
      
      <div className="flex flex-col items-center gap-6 py-12 bg-white border border-stone-200 relative overflow-hidden">
        <div className="w-20 h-20 border-2 border-zinc-900 flex items-center justify-center p-1 relative z-10 bg-stone-50">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User size={32} className="text-stone-200" />
          )}
        </div>
        <div className="text-center relative z-10 space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-900">{profile?.displayName || 'TrimTime Node'}</h3>
          <p className="text-stone-400 text-[10px] font-bold uppercase tracking-[0.2em]">{profile?.email}</p>
          <div className="pt-2">
            <span className="text-[8px] font-bold uppercase px-2 py-0.5 border border-stone-200 text-stone-400">{profile?.role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {profile?.role === 'barber' && (
          <div className="p-6 bg-stone-50 border border-stone-200 space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 border-b border-stone-200 pb-2 flex justify-between">
              Live Profile
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Bio</p>
                <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed italic">
                  {profile.bio || 'Mission data not initialized.'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest">Specialties</p>
                <div className="flex flex-wrap gap-1">
                  {(profile.specialties || []).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-white border border-stone-100 text-[8px] font-bold uppercase text-stone-400">
                      {s}
                    </span>
                  ))}
                  {(!profile.specialties || profile.specialties.length === 0) && (
                    <span className="text-[8px] font-bold uppercase text-stone-300">None defined</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {profile?.role === 'barber' && (
          <>
            <Button variant="outline" onClick={() => setActiveSubView('identity')} className="w-full h-14 justify-start px-8">
              System Parameters
            </Button>
            <Button variant="outline" onClick={() => setActiveSubView('schedule')} className="w-full h-14 justify-start px-8">
              Temporal Slots
            </Button>
            <Button variant="outline" onClick={() => setActiveSubView('services')} className="w-full h-14 justify-start px-8">
              Service Buffer
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => setActiveSubView('history')} className="w-full h-14 justify-start px-8">
          <History size={14} className="mr-4" />
          Mission Archive
        </Button>
        {profile?.role === 'barber' && (
          <Button variant="outline" onClick={() => setActiveSubView('alerts')} className="w-full h-14 justify-start px-8">
            <Bell size={14} className="mr-4" />
            Active Alerts
          </Button>
        )}
        <Button variant="outline" className="w-full h-14 justify-start px-8">
          Preferences
        </Button>
        <Button variant="outline" className="w-full h-14 justify-start px-8">
          Archive
        </Button>
        <Button 
          variant="ghost" 
          onClick={logout} 
          className="w-full h-14 justify-start px-8 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Terminate Session
        </Button>
      </div>

      <div className="text-center pt-8 border-t border-stone-100 flex justify-between items-center">
        <p className="text-[8px] font-bold uppercase text-stone-300 tracking-[0.3em]">Operational 1.0.4</p>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-zinc-900" />
          <div className="w-2 h-2 bg-stone-200" />
        </div>
      </div>
    </div>
  );
};

const MainApp = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('barbers');
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'barber') {
      setActiveTab('barber-queue');
    } else {
      setActiveTab('barbers');
    }
  }, [profile]);

  const handleBarberSelect = (id: string) => {
    setSelectedBarberId(id);
    setActiveTab('queue');
  };

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900 font-sans selection:bg-zinc-900 selection:text-white pb-32">
      {/* Container - Phone frame on desktop, full screen on mobile */}
      <div className="md:max-w-md md:mx-auto md:pt-16 h-full">
        <div className="bg-white md:border-[10px] md:border-zinc-900 md:shadow-2xl min-h-screen md:min-h-[700px] flex flex-col">
          {/* Status bar mock - only on desktop frame */}
          <div className="hidden md:flex h-6 bg-zinc-900 w-full justify-center items-end pb-1 shrink-0">
            <div className="w-16 h-2 bg-black rounded-full shadow-inner"></div>
          </div>
          
          <div className="p-6 md:p-8 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'barbers' && (
                <motion.div key="barbers" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <BarberListScreen onSelect={handleBarberSelect} />
                </motion.div>
              )}
              {activeTab === 'queue' && (
                <motion.div key="queue" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <QueueScreen barberId={selectedBarberId} />
                </motion.div>
              )}
              {activeTab === 'barber-queue' && (
                <motion.div key="barber-queue" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <BarberQueueScreen />
                </motion.div>
              )}
              {activeTab === 'book' && (
                <motion.div key="book" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <BookingScreen barberId={selectedBarberId} />
                </motion.div>
              )}
              {activeTab === 'analytics' && (
                <motion.div key="analytics" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <AnalyticsScreen />
                </motion.div>
              )}
              {activeTab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <ProfileView />
                </motion.div>
              )}
              {activeTab === 'ai' && (
                <motion.div key="ai" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <AISuggestionScreen />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} role={profile?.role || 'customer'} />
    </div>
  );
};

// --- Container ---

const InnerApp = () => {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        <Scissors className="text-zinc-300" size={32} />
      </motion.div>
    </div>
  );
  
  if (!user) return <Landing />;
  if (!profile) return <RoleSelection />;
  
  return <MainApp />;
};

export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}
