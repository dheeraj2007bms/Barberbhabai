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
  Filter
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

const CustomerBooking = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selection, setSelection] = useState<{
    service: Service | null,
    barber: BarberProfile | null,
    date: Date | null,
    time: Date | null
  }>({ service: null, barber: null, date: new Date(), time: null });
  const [availableSlots, setAvailableSlots] = useState<Date[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { profile, user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      const sSnap = await getDocs(collection(db, 'services'));
      const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      
      if (sData.length === 0) {
        const defaults = [
          { name: 'Skin Fade', price: 150, durationMinutes: 45, category: 'Haircut', description: 'Precision fade with grooming' },
          { name: 'Beard Sculpt', price: 100, durationMinutes: 30, category: 'Beard', description: 'Sharp lines and detailing' },
          { name: 'Executive Package', price: 450, durationMinutes: 90, category: 'Combo', description: 'Premium cut and detailed shave' },
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
      setBarbers(bData.filter(b => b.available));
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selection.barber && selection.date && selection.service) {
      fetchAvailableSlots();
    }
  }, [selection.barber, selection.date, selection.service]);

  const fetchAvailableSlots = async () => {
    if (!selection.barber || !selection.date || !selection.service) return;
    setLoadingSlots(true);

    const dayName = format(selection.date, 'eeee').toLowerCase();
    
    // Fallback defaults if workingHours is missing (for older accounts)
    const defaultHours = {
      monday: { start: '09:00', end: '17:00', enabled: true },
      tuesday: { start: '09:00', end: '17:00', enabled: true },
      wednesday: { start: '09:00', end: '17:00', enabled: true },
      thursday: { start: '09:00', end: '17:00', enabled: true },
      friday: { start: '09:00', end: '17:00', enabled: true },
      saturday: { start: '10:00', end: '14:00', enabled: true },
      sunday: { start: '10:00', end: '14:00', enabled: false },
    };

    const config = selection.barber.workingHours?.[dayName] || (defaultHours as any)[dayName];

    if (!config || !config.enabled) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }

    try {
      // Fetch existing bookings for this barber on this day
      const dayStart = startOfDay(selection.date);
      const dayEnd = endOfDay(selection.date);
      const q = query(
        collection(db, 'bookings'),
        where('barberId', '==', selection.barber.userId),
        where('startTime', '>=', Timestamp.fromDate(dayStart)),
        where('startTime', '<=', Timestamp.fromDate(dayEnd)),
        where('status', 'in', ['pending', 'confirmed'])
      );
      const snap = await getDocs(q);
      const existingBookings = snap.docs.map(d => d.data() as Booking);

      // Generate slots
      const slots: Date[] = [];
      const [startH, startM] = config.start.split(':').map(Number);
      const [endH, endM] = config.end.split(':').map(Number);
      
      let currentSlot = addMinutes(dayStart, startH * 60 + startM);
      const endTime = addMinutes(dayStart, endH * 60 + endM);

      while (isBefore(currentSlot, endTime)) {
        const slotEnd = addMinutes(currentSlot, selection.service.durationMinutes);
        
        // Check if slot overlaps with existing bookings
        const isConflict = existingBookings.some(b => {
          const bStart = b.startTime.toDate();
          const bEnd = b.endTime.toDate();
          return (isBefore(currentSlot, bEnd) && isAfter(slotEnd, bStart));
        });

        // Check if slot is in the past (only if selected date is today)
        const isToday = selection.date.toDateString() === new Date().toDateString();
        const isPast = isToday && isBefore(currentSlot, new Date());

        if (!isConflict && !isPast && !isAfter(slotEnd, endTime)) {
          slots.push(currentSlot);
        }
        currentSlot = addMinutes(currentSlot, 30); // 30min increments
      }

      setAvailableSlots(slots);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlots(false);
    }
  };

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
        barberName: selection.barber.displayName || 'Barber',
        customerName: profile?.displayName || 'Client',
        startTime: startTimeToken,
        endTime: endTimeToken,
        status: 'pending',
        totalPrice: selection.service.price,
        createdAt: serverTimestamp(),
      });
      setShowSuccess(true);
      // Logic for background confirmation email would trigger here
    } catch (err) {
      console.error(err);
    }
  };

  const resetBooking = () => {
    setShowSuccess(false);
    setStep(1);
    setSelection({ service: null, barber: null, date: new Date(), time: null });
  };

  const categories = ['All', ...Array.from(new Set(services.map(s => s.category)))];
  const filteredServices = selectedCategory === 'All' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  // Add this state inside CustomerBooking
  const [viewingBarber, setViewingBarber] = useState<BarberProfile | null>(null);

  if (showSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-10"
      >
        <div className="relative">
          <div className="w-24 h-24 bg-zinc-900 flex items-center justify-center mx-auto shadow-2xl relative z-10">
            <CheckCircle2 className="text-white" size={48} />
          </div>
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-zinc-900/10 rounded-full"
          />
        </div>
        
        <div className="space-y-3">
          <h2 className="text-2xl font-bold uppercase tracking-tighter">Mission Successful</h2>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.3em] max-w-[200px] mx-auto leading-relaxed">
            Temporal node synchronized. Your arrival is expected.
          </p>
        </div>

        <div className="w-full max-w-xs bg-white border border-stone-100 p-6 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-stone-50 pb-3">
            <span className="text-[8px] font-bold uppercase text-stone-300 tracking-widest text-left">Specialist</span>
            <span className="text-[10px] font-bold uppercase text-zinc-900">{selection.barber?.displayName}</span>
          </div>
          <div className="flex justify-between items-center border-b border-stone-50 pb-3">
            <span className="text-[8px] font-bold uppercase text-stone-300 tracking-widest text-left">Temporal Node</span>
            <span className="text-[10px] font-bold uppercase text-zinc-900">{selection.time ? format(selection.time, 'HH:mm | MMM d') : ''}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-bold uppercase text-stone-300 tracking-widest text-left">Objective</span>
            <span className="text-[10px] font-bold uppercase text-zinc-900">{selection.service?.name}</span>
          </div>
        </div>

        <div className="space-y-4 w-full max-w-xs">
          <div className="flex items-center justify-center gap-2 text-stone-400">
            <Clock size={10} />
            <span className="text-[8px] font-bold uppercase tracking-widest italic">Confirmation Email Pending...</span>
          </div>
          <Button onClick={resetBooking} className="w-full h-14 shadow-lg border-stone-200">
            Return to Portal
          </Button>
        </div>
      </motion.div>
    );
  }

  if (viewingBarber) {
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 pb-32">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setViewingBarber(null)} className="px-1 border border-stone-200">
            <ChevronLeft size={16} />
          </Button>
          <h2 className="text-xl font-bold uppercase tracking-tight">Barber Module</h2>
        </div>

        <div className="space-y-8">
          <div className="flex gap-6 items-start">
            <div className="w-24 h-24 border-2 border-zinc-900 shrink-0 bg-stone-50 p-1">
              {viewingBarber.photoURL ? (
                <img src={viewingBarber.photoURL} alt={viewingBarber.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={32} className="text-stone-200" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold uppercase tracking-tighter leading-none">{viewingBarber.displayName}</h3>
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={10} className="fill-zinc-900 text-zinc-900" />
                <span className="text-[10px] font-bold">{viewingBarber.rating || '5.0'}</span>
                <span className="text-[10px] text-stone-300">({viewingBarber.reviewCount || 0} reviews)</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {viewingBarber.specialties?.map(s => (
                  <Badge key={s} variant="outline" className="text-[7px] py-0 h-4">{s}</Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 border-b border-stone-100 pb-1">Professional Bio</h4>
            <p className="text-xs text-stone-500 leading-relaxed italic">{viewingBarber.bio || 'No mission objective defined.'}</p>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 border-b border-stone-100 pb-1">Standard Uptime</h4>
            <div className="text-[9px] uppercase font-bold text-stone-400 space-y-1">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                const config = viewingBarber.workingHours?.[day];
                return (
                  <div key={day} className="flex justify-between items-center py-1 border-b border-stone-50">
                    <span className={config?.enabled ? 'text-stone-600' : 'text-stone-200'}>{day}</span>
                    <span>{config?.enabled ? `${config.start} - ${config.end}` : 'OFFLINE'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Button 
            className="w-full h-16 shadow-xl"
            onClick={() => {
              setSelection({ ...selection, barber: viewingBarber });
              setViewingBarber(null);
              setStep(3);
            }}
          >
            Select This Unit
          </Button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center font-bold uppercase tracking-widest text-[10px]">Synchronizing...</div>;

  return (
    <div className="pb-32">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2">
           {step > 1 && (
             <button onClick={() => setStep(step - 1)} className="p-1 hover:bg-stone-100 transition-colors">
               <ChevronLeft size={18} />
             </button>
           )}
           <h2 className="text-xl font-bold uppercase tracking-tight">Book Service</h2>
        </div>
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
            className="space-y-6"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1 text-[9px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap",
                    selectedCategory === cat ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-stone-200 text-stone-400"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Select Routine</h3>
            <div className="grid grid-cols-2 gap-3">
              {filteredServices.map(s => (
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
                  <p className={cn("text-[8px] uppercase tracking-tighter mt-1", selection.service?.id === s.id ? "text-white/40" : "text-stone-300")}>{s.durationMinutes}m</p>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <div className="col-span-2 py-10 text-center border border-dashed border-stone-200 text-stone-300 text-[10px] uppercase font-bold tracking-widest">
                  No Services Found
                </div>
              )}
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
            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Assign Specialist</h3>
            <div className="flex flex-wrap gap-6 px-2">
              {barbers.map(b => (
                <div 
                  key={b.id}
                  className={cn(
                    "cursor-pointer flex flex-col items-center transition-all",
                    selection.barber?.id === b.id ? "opacity-100" : "opacity-40"
                  )}
                  onClick={() => setViewingBarber(b)}
                >
                  <div className={cn(
                    "w-16 h-16 rounded-full border-2 bg-stone-50 flex items-center justify-center mb-2 overflow-hidden",
                    selection.barber?.id === b.id ? "border-zinc-900" : "border-transparent"
                  )}>
                    {b.photoURL ? <img src={b.photoURL} alt={b.displayName} className="w-full h-full object-cover" /> : <User size={24} className="text-stone-200" />}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest leading-none mt-1">{b.displayName || 'Barber'}</span>
                  <div className="flex items-center gap-1 mt-1 text-stone-400">
                    <Star size={8} className="fill-stone-400" />
                    <span className="text-[8px] font-bold">{b.rating || '5.0'}</span>
                    <span className="text-[8px] opacity-40 ml-0.5">({b.reviewCount || 0})</span>
                  </div>
                  <div className="mt-1 w-4 h-0.5 bg-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <div className="space-y-4">
              <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Temporal Node</h3>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                  const date = addMinutes(startOfDay(new Date()), offset * 24 * 60);
                  const isSelected = selection.date?.toDateString() === date.toDateString();
                  return (
                    <button
                      key={offset}
                      onClick={() => setSelection({ ...selection, date, time: null })}
                      className={cn(
                        "flex flex-col items-center min-w-[50px] p-2 border transition-all",
                        isSelected ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-stone-200 text-stone-400"
                      )}
                    >
                      <span className="text-[8px] uppercase font-bold tracking-tighter opacity-70">{format(date, 'eee')}</span>
                      <span className="text-xs font-bold">{format(date, 'd')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {loadingSlots ? (
                <div className="col-span-4 py-12 text-center bg-stone-50 border border-dashed border-stone-100 flex flex-col items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-stone-300 border-t-zinc-900 rounded-full animate-spin" />
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Refining Temporal Map...</p>
                </div>
              ) : (
                <>
                  {availableSlots.map(slot => {
                    const isSelected = selection.time?.getTime() === slot.getTime();
                    const slotEnd = addMinutes(slot, selection.service?.durationMinutes || 30);
                    return (
                      <div 
                        key={slot.getTime()}
                        className={cn(
                          "cursor-pointer py-2 px-1 text-center border transition-all",
                          isSelected ? "bg-zinc-900 border-zinc-900 text-white" : "bg-stone-50 border-stone-100 text-slate-400"
                        )}
                        onClick={() => setSelection({ ...selection, time: slot })}
                      >
                        <p className="text-[9px] font-bold tracking-tight">{format(slot, 'HH:mm')}</p>
                        <p className={cn("text-[7px] font-medium opacity-50", isSelected ? "text-white" : "text-stone-300")}>
                          {format(slotEnd, 'HH:mm')}
                        </p>
                      </div>
                    );
                  })}
                  {availableSlots.length === 0 && (
                    <div className="col-span-4 py-12 text-center bg-stone-50 border border-dashed border-stone-100 px-6">
                      <p className="text-zinc-900 text-[10px] uppercase font-bold tracking-widest mb-1">Null Capacity detected</p>
                      <p className="text-stone-400 text-[8px] uppercase tracking-tighter leading-relaxed">
                        The selected unit is currently offline for this temporal node. Try another date or specialist.
                      </p>
                    </div>
                  )}
                </>
              )}
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
                    <span className="w-px h-2 bg-stone-200 my-auto" />
                    <span>{selection.time ? format(selection.time, 'MMM d, HH:mm') : 'Unassigned'}</span>
                  </div>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-[8px] font-bold uppercase text-zinc-300 tracking-[0.2em]">Charge</p>
                  <p className="text-2xl font-bold text-zinc-900">{formatCurrency(selection.service?.price || 0)}</p>
                </div>
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
      await updateDoc(doc(db, 'barbers', user.uid), {
        workingHours: barberProfile.workingHours,
        available: barberProfile.available
      });
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
    const sSnap = await getDocs(collection(db, 'services'));
    setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editingService?.name || !editingService?.price) return;
    
    if (editingService.id) {
      const { id, ...data } = editingService;
      await updateDoc(doc(db, 'services', id), data);
    } else {
      await addDoc(collection(db, 'services'), {
        ...editingService,
        category: editingService.category || 'General'
      });
    }
    setEditingService(null);
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete service?')) {
      await deleteDoc(doc(db, 'services', id));
      fetchServices();
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
      const snap = await getDoc(doc(db, 'barbers', user.uid));
      if (snap.exists()) {
        setProfileData(snap.data() as BarberProfile);
      }
      setLoading(false);
    };
    fetchBarber();
  }, [user]);

  const save = async () => {
    if (!user || !profileData) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'barbers', user.uid), {
        displayName: profileData.displayName || '',
        bio: profileData.bio || '',
        specialties: profileData.specialties || [],
        photoURL: profileData.photoURL || '',
      });
      // Also update the main users collection
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileData.displayName || '',
        photoURL: profileData.photoURL || '',
      });
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

const ProfileView = () => {
  const { profile, logout } = useAuth();
  const [activeSubView, setActiveSubView] = useState<'main' | 'schedule' | 'identity' | 'services'>('main');

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
                <motion.div key="manage" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                  <ServiceManager />
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
