import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { Button, Card, Input } from './ui';
import { Star, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

export const ReviewModal = ({ 
  barberId, 
  isOpen, 
  onClose 
}: { 
  barberId: string; 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Add review
        const reviewRef = doc(collection(db, 'barbers', barberId, 'reviews'));
        transaction.set(reviewRef, {
          customerId: user.uid,
          customerName: user.displayName || 'Anonymous Subject',
          rating,
          comment,
          createdAt: new Date().toISOString()
        });

        // 2. Update barber averages
        const barberRef = doc(db, 'barbers', barberId);
        const barberSnap = await transaction.get(barberRef);
        
        if (barberSnap.exists()) {
          const data = barberSnap.data();
          const currentCount = data.reviewCount || 0;
          const currentRating = data.rating || 0;
          
          const newCount = currentCount + 1;
          const newRating = ((currentRating * currentCount) + rating) / newCount;
          
          transaction.update(barberRef, {
            rating: parseFloat(newRating.toFixed(1)),
            reviewCount: newCount
          });
        }
      });
      
      onClose();
    } catch (err) {
      console.error("Review Submission Error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white p-8 space-y-10 shadow-2xl border-[4px] border-zinc-900"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase tracking-tighter">Feedback Interface</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button 
                key={s} 
                onClick={() => setRating(s)}
                className="transition-transform active:scale-90"
              >
                <Star 
                  size={32} 
                  className={s <= rating ? 'fill-zinc-900 text-zinc-900' : 'text-stone-200'}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tactical Observations (Optional)</label>
            <Input 
              value={comment} 
              onChange={e => setComment(e.target.value)}
              placeholder="How was the engagement?"
              className="h-24 py-3 placeholder:italic"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="w-full h-14 bg-zinc-900"
          >
            {submitting ? 'Streaming Data...' : 'Finalize Transmission'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
