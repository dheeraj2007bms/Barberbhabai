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
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Button, Card, Input, Badge } from './components/ui';
import { db } from './lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Service, BarberProfile, Booking, UserRole } from './types';
import { formatCurrency, cn } from './lib/utils';
import { format, addMinutes, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, role }: { activeTab: string, setActiveTab: (t: string) => void, role: UserRole }) => {
  const tabs = role === 'customer' 
    ? [
        { id: 'book', label: 'Book', icon: Scissors },
        { id: 'bookings', label: 'Schedule', icon: Calendar },
        { id: 'profile', label: 'Systems', icon: User },
      ]
    : [
        { id: 'schedule', label: 'Active', icon: Calendar },
        { id: 'manage', label: 'Services', icon: Scissors },
        { id: 'profile', label: 'Systems', icon: User },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-4 pb-10 flex justify-around items-center z-50">
      {tabs.map((tab) => {
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
  const { signIn } = useAuth();
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
        <Button onClick={signIn} size="lg" className="w-full h-16 shadow-xl">
          Enter System
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

const CustomerBooking = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<{
    service: Service | null,
    barber: BarberProfile | null,
    time: Date | null
  }>({ service: null, barber: null, time: null });

  const { profile, user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      const sSnap = await getDocs(collection(db, 'services'));
      const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      
      // If no services, add some defaults
      if (sData.length === 0) {
        const defaults = [
          { name: 'Skin Fade', price: 35, durationMinutes: 45, category: 'Haircut', description: 'Precision fade with grooming' },
          { name: 'Beard Sculpt', price: 20, durationMinutes: 30, category: 'Beard', description: 'Sharp lines and detailing' },
          { name: 'Executive Package', price: 60, durationMinutes: 90, category: 'Combo', description: 'Premium cut and detailed shave' },
        ];
        for (const s of defaults) {
          await addDoc(collection(db, 'services'), s);
        }
        const freshSnap = await getDocs(collection(db, 'services'));
        setServices(freshSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      } else {
        setServices(sData);
      }

      const bSnap = await getDocs(collection(db, 'barbers'));
      const bData = bSnap.docs.map(d => ({ id: d.id, ...d.data() } as BarberProfile));
      setBarbers(bData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleBooking = async () => {
    if (!selection.service || !selection.barber || !selection.time || !user) return;
    
    const startTimeToken = Timestamp.fromDate(selection.time);
    const endTimeToken = Timestamp.fromDate(addMinutes(selection.time, selection.service.durationMinutes));

    try {
      await addDoc(collection(db, 'bookings'), {
        customerId: user.uid,
        barberId: selection.barber.userId,
        serviceId: selection.service.id,
        serviceName: selection.service.name,
        barberName: selection.barber.displayName || 'Marcus',
        customerName: profile?.displayName || 'Client',
        startTime: startTimeToken,
        endTime: endTimeToken,
        status: 'pending',
        totalPrice: selection.service.price,
        createdAt: serverTimestamp(),
      });
      alert('APPOINTMENT INITIALIZED');
      setStep(1);
      setSelection({ service: null, barber: null, time: null });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center font-bold uppercase tracking-widest text-[10px]">Synchronizing...</div>;

  return (
    <div className="pb-32">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-xl font-bold uppercase tracking-tight">Book Service</h2>
        <div className="text-[8px] font-bold uppercase border border-stone-200 px-2 py-0.5 text-stone-400">
          Module {step}/3
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <h3 className="text-[10px] uppercase font-bold text-stone-400 mb-4 tracking-widest">Select Grooming Routine</h3>
            <div className="grid grid-cols-2 gap-3">
              {services.map(s => (
                <div 
                  key={s.id} 
                  className={cn(
                    "cursor-pointer p-4 border transition-all",
                    selection.service?.id === s.id 
                      ? "bg-zinc-900 border-zinc-900 text-white" 
                      : "bg-white border-stone-200 text-slate-900"
                  )}
                  onClick={() => { setSelection({ ...selection, service: s }); setStep(2); }}
                >
                  <p className={cn("text-[9px] uppercase font-bold mb-1", selection.service?.id === s.id ? "text-white/60" : "text-stone-400")}>{s.name}</p>
                  <p className="text-sm font-bold">{formatCurrency(s.price)}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="px-1 border border-stone-200">
                Back
              </Button>
              <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Assign Specialist</h3>
            </div>
            
            <div className="flex flex-wrap gap-6 px-2">
              {barbers.map(b => (
                <div 
                  key={b.id}
                  className={cn(
                    "cursor-pointer flex flex-col items-center transition-all",
                    selection.barber?.id === b.id ? "opacity-100" : "opacity-40"
                  )}
                  onClick={() => { setSelection({ ...selection, barber: b }); setStep(3); }}
                >
                  <div className={cn(
                    "w-16 h-16 rounded-full border-2 bg-stone-50 flex items-center justify-center mb-2 overflow-hidden",
                    selection.barber?.id === b.id ? "border-zinc-900" : "border-transparent"
                  )}>
                    {b.photoURL ? <img src={b.photoURL} alt={b.displayName} className="w-full h-full object-cover" /> : <User size={24} className="text-stone-200" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest leading-none mt-1">{b.displayName || 'Barber'}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="px-1 border border-stone-200">
                Back
              </Button>
              <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Temporal Slot</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {[9, 10, 11, 12, 14, 15, 16, 17].map(hour => {
                const time = addMinutes(startOfDay(new Date()), hour * 60);
                const isSelected = selection.time?.getTime() === time.getTime();
                return (
                  <div 
                    key={hour}
                    className={cn(
                      "cursor-pointer py-3 text-center text-[10px] font-bold border transition-all",
                      isSelected ? "bg-zinc-900 border-zinc-900 text-white" : "bg-stone-50 border-stone-100 text-slate-400"
                    )}
                    onClick={() => setSelection({ ...selection, time })}
                  >
                    {format(time, 'HH:mm')}
                  </div>
                );
              })}
            </div>

            <div className="pt-8 space-y-4">
              <div className="border border-zinc-900 p-6 flex justify-between items-end relative overflow-hidden bg-white">
                <div className="relative z-10 space-y-2">
                  <p className="text-[8px] font-bold uppercase text-stone-400 tracking-[0.2em]">Summary</p>
                  <h4 className="text-xl font-bold uppercase tracking-tighter">{selection.service?.name}</h4>
                  <div className="flex gap-4 text-[9px] font-bold uppercase text-stone-500 tracking-widest">
                    <span>{selection.service?.durationMinutes}m</span>
                    <span className="w-px h-2 bg-stone-200 my-auto" />
                    <span>{selection.barber?.displayName || 'Barber'}</span>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-[8px] font-bold uppercase text-zinc-300 tracking-[0.2em]">Charge</p>
                  <p className="text-2xl font-bold text-zinc-900">{formatCurrency(selection.service?.price || 0)}</p>
                </div>
                {/* Geometric accent */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-stone-50 -translate-y-12 translate-x-12 rotate-45" />
              </div>

              <Button 
                disabled={!selection.time} 
                onClick={handleBooking} 
                size="lg" 
                className="w-full h-18 text-sm"
              >
                Confirm Appointment
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BookingsList = ({ role }: { role: UserRole }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      const field = role === 'customer' ? 'customerId' : 'barberId';
      const q = query(
        collection(db, 'bookings'), 
        where(field, '==', user.uid),
        orderBy('startTime', 'desc')
      );
      const snap = await getDocs(q);
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
      setLoading(false);
    };
    fetchBookings();
  }, [user, role]);

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'bookings', id), { 
      status, 
      updatedAt: serverTimestamp() 
    });
    setBookings(bookings.map(b => b.id === id ? { ...b, status: status as any } : b));
  };

  if (loading) return <div className="p-8 text-center font-bold uppercase tracking-widest text-[10px]">Accessing Schedule...</div>;

  return (
    <div className="pb-32 space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight">{role === 'customer' ? 'My Schedule' : `Console: ${profile?.displayName || 'Barber'}`}</h2>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">
            {format(new Date(), 'EEEE, MMM do')}
          </p>
        </div>
        <div className="h-10 w-10 flex items-center justify-center border border-stone-200 font-bold text-xs uppercase bg-white">
          {bookings.length}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Temporal Invariants</h3>
        {bookings.map(b => (
          <Card key={b.id} className={cn(
            "p-0 border-none bg-transparent flex items-center gap-4 transition-all pl-4",
            b.status === 'confirmed' ? "border-l-4 border-zinc-900" : "border-l-4 border-stone-200"
          )}>
            <div className="w-12 text-[10px] font-bold text-slate-900 shrink-0">
               {format(b.startTime.toDate(), 'HH:mm')}
            </div>
            <div className="flex-1 py-1">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-tight">{role === 'customer' ? b.barberName : b.customerName}</h4>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  b.status === 'confirmed' ? "bg-green-500" : 
                  b.status === 'pending' ? "bg-yellow-500" : 
                  b.status === 'cancelled' ? "bg-red-500" : "bg-stone-300"
                )} />
              </div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">{b.serviceName}</p>
            </div>
            
            <div className="pr-4 flex gap-2">
              {role === 'barber' && b.status === 'pending' && (
                <button onClick={() => updateStatus(b.id, 'confirmed')} className="text-[8px] font-bold uppercase tracking-widest text-zinc-900 border border-zinc-200 px-2 py-1 hover:bg-zinc-900 hover:border-zinc-900 hover:text-white transition-all">
                  Conf
                </button>
              )}
              {role === 'barber' && b.status === 'confirmed' && (
                <button onClick={() => updateStatus(b.id, 'completed')} className="text-[8px] font-bold uppercase tracking-widest text-zinc-900 border border-zinc-200 px-2 py-1 hover:bg-zinc-900 hover:border-zinc-900 hover:text-white transition-all">
                  Done
                </button>
              )}
            </div>
          </Card>
        ))}

        {bookings.length === 0 && (
          <div className="text-center py-20 border border-dashed border-stone-200">
            <p className="text-stone-300 text-[10px] font-bold uppercase tracking-widest">No Active Nodes</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileView = () => {
  const { profile, logout } = useAuth();
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
  const [activeTab, setActiveTab] = useState(profile?.role === 'customer' ? 'book' : 'schedule');

  return (
    <div className="min-h-screen bg-stone-100 text-slate-900 font-sans selection:bg-zinc-900 selection:text-white">
      <div className="max-w-md mx-auto p-8 pt-16 h-full pb-24">
        <div className="bg-white border-[10px] border-zinc-900 shadow-2xl min-h-[700px] flex flex-col">
          {/* Status bar mock */}
          <div className="h-6 bg-zinc-900 w-full flex justify-center items-end pb-1 shrink-0">
            <div className="w-16 h-2 bg-black rounded-full shadow-inner"></div>
          </div>
          
          <div className="p-8 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'book' && (
                <motion.div key="book" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <CustomerBooking />
                </motion.div>
              )}
              {activeTab === 'schedule' && (
                <motion.div key="schedule" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <BookingsList role="barber" />
                </motion.div>
              )}
              {activeTab === 'bookings' && (
                <motion.div key="bookings" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <BookingsList role="customer" />
                </motion.div>
              )}
              {activeTab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <ProfileView />
                </motion.div>
              )}
              {activeTab === 'manage' && (
                <motion.div key="manage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-20 text-center text-[10px] font-bold uppercase tracking-widest text-stone-300">
                  Services: Module Offline
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
