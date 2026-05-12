import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BarberProfile } from '../types';
import { Card, Badge, Input } from '../components/ui';
import { Star, User, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const BarberListScreen = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [barbers, setBarbers] = useState<BarberProfile[]>([]);
  const [filteredBarbers, setFilteredBarbers] = useState<BarberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const q = query(collection(db, 'barbers'), where('available', '==', true));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data() as BarberProfile);
        setBarbers(data);
        setFilteredBarbers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBarbers();
  }, []);

  useEffect(() => {
    let result = barbers;
    
    if (searchQuery) {
      result = result.filter(b => 
        b.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.specialties?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (selectedSpecialty) {
      result = result.filter(b => b.specialties?.includes(selectedSpecialty));
    }
    
    setFilteredBarbers(result);
  }, [searchQuery, selectedSpecialty, barbers]);

  const allSpecialties = Array.from(new Set(barbers.flatMap(b => b.specialties || [])));

  if (loading) return <div className="p-8 text-center text-[10px] uppercase font-bold tracking-widest text-stone-300">Scanning Unit Clusters...</div>;

  return (
    <div className="space-y-6 pb-32">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold uppercase tracking-tight">Active Specialists</h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Available Units for Engagement</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
          <Input 
            className="pl-10 h-12 bg-white border-stone-200 text-xs uppercase tracking-widest"
            placeholder="Search Designations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setSelectedSpecialty(null)}
            className={`px-4 py-1.5 text-[8px] font-bold uppercase tracking-widest transition-all border shrink-0 ${
              !selectedSpecialty ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-stone-400 border-stone-100 hover:border-stone-200'
            }`}
          >
            All Sectors
          </button>
          {allSpecialties.map(s => (
            <button 
              key={s}
              onClick={() => setSelectedSpecialty(s)}
              className={`px-4 py-1.5 text-[8px] font-bold uppercase tracking-widest transition-all border shrink-0 ${
                selectedSpecialty === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-stone-400 border-stone-100 hover:border-stone-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
        {filteredBarbers.map((barber) => (
          <motion.div
            key={barber.userId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(barber.userId)}
          >
            <Card className="bg-white border-stone-200 p-6 cursor-pointer hover:border-zinc-900 transition-all flex gap-6 items-center shadow-sm">
              <div className="w-16 h-16 bg-stone-50 border border-stone-100 shrink-0 overflow-hidden">
                {barber.photoURL ? (
                  <img src={barber.photoURL} alt={barber.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={24} className="text-stone-200" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-sm uppercase tracking-tighter">{barber.displayName || 'Unnamed Specialist'}</h3>
                  <div className="flex items-center gap-1">
                    <Star size={10} className="fill-zinc-900 text-zinc-900" />
                    <span className="text-[10px] font-bold">{barber.rating || '5.0'}</span>
                    <span className="text-[8px] text-stone-300">({barber.reviewCount || 0})</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {barber.specialties?.slice(0, 3).map(s => (
                    <Badge key={s} variant="outline" className="text-[7px] py-0 h-4 border-stone-200 bg-stone-50/50">{s}</Badge>
                  ))}
                </div>
                <p className="text-[9px] text-stone-400 italic line-clamp-1">{barber.bio}</p>
              </div>
            </Card>
          </motion.div>
        ))}
        </AnimatePresence>

        {filteredBarbers.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-stone-200 bg-stone-50/20">
            <Filter className="mx-auto text-stone-200 mb-4 opacity-30" size={48} />
            <p className="text-[10px] font-bold text-stone-300 uppercase tracking-[0.2em]">Zero results in target sweep</p>
          </div>
        )}
      </div>
    </div>
  );
};

