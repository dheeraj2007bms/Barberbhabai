import React, { useState } from 'react';
import { Button, Card, Input } from '../components/ui';
import { Sparkles, BrainCircuit } from 'lucide-react';
import { motion } from 'motion/react';

export const AISuggestionScreen = () => {
  const [hairType, setHairType] = useState('Thick');
  const [faceShape, setFaceShape] = useState('Oval');
  const [occasion, setOccasion] = useState('Wedding');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const getSuggestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suggest-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hairType, faceShape, occasion })
      });
      const data = await res.json();
      setSuggestion(data.suggestion);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold uppercase tracking-tight">AI Style Counselor</h2>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-relaxed">
          Neural-network driven grooming recommendations based on physiological parameters.
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Hair Texture</label>
            <Input value={hairType} onChange={e => setHairType(e.target.value)} placeholder="Thick, Thin, Curly..." />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Facial Structure</label>
            <Input value={faceShape} onChange={e => setFaceShape(e.target.value)} placeholder="Oval, Square, Round..." />
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase text-stone-400 tracking-widest">Target Context (Occasion)</label>
            <Input value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="Business, Casual, Party..." />
          </div>
        </div>

        <Button 
          onClick={getSuggestion} 
          disabled={loading}
          className="w-full h-16 bg-zinc-900 border-zinc-900"
        >
          <Sparkles size={16} className="mr-2" />
          {loading ? 'Processing Parameters...' : 'Generate Suggestion'}
        </Button>

        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-8 border-none bg-zinc-900 text-white space-y-4 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit size={80} />
              </div>
              <div className="relative z-10">
                <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-stone-500 mb-2">Neural Output</p>
                <div className="text-sm font-bold leading-relaxed whitespace-pre-wrap">
                  {suggestion}
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                 <p className="text-[7px] uppercase tracking-widest text-stone-500 font-bold">Confidence: 94.2%</p>
                 <div className="flex gap-1">
                   <div className="w-1 h-1 bg-green-500 rounded-full" />
                   <div className="w-1 h-1 bg-green-500 rounded-full" />
                 </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};
