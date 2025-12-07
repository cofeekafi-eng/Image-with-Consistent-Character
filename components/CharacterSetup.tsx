import React, { useState, useRef } from 'react';
import { Character, GeneratorState } from '../types';
import { Spinner } from './Spinner';

interface CharacterSetupProps {
  character: Character;
  onCharacterUpdate: (updates: Partial<Character>) => void;
  onGenerate: () => void;
  status: GeneratorState;
  onReset: () => void;
  savedCharacters: Character[];
  onLoadCharacter: (c: Character) => void;
  onSaveCharacter: () => void;
  onDeleteCharacter: (id: string) => void;
}

export const CharacterSetup: React.FC<CharacterSetupProps> = ({
  character,
  onCharacterUpdate,
  onGenerate,
  status,
  onReset,
  savedCharacters,
  onLoadCharacter,
  onSaveCharacter,
  onDeleteCharacter
}) => {
  const [mode, setMode] = useState<'generate' | 'upload'>('generate');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGenerating = status === GeneratorState.GENERATING_CHARACTER;
  const hasImage = !!character.baseImage;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        // Strip data url prefix to get pure base64 which is what the app expects
        const base64 = result.split(',')[1];
        onCharacterUpdate({ baseImage: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-slate-700 w-full md:w-96 flex-shrink-0 z-10 shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Character Studio
        </h2>
        <p className="text-slate-400 text-sm mt-1">Define your protagonist.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Active Character Display */}
         {hasImage && (
            <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-end">
                     <label className="text-xs font-bold text-primary uppercase tracking-wider">Active Character</label>
                     <button onClick={onReset} className="text-xs text-red-400 hover:text-red-300">New</button>
                </div>
                
                <div className="relative group rounded-xl overflow-hidden border-2 border-primary shadow-lg shadow-primary/20 aspect-square">
                    <img 
                    src={`data:image/png;base64,${character.baseImage}`} 
                    alt="Base Character" 
                    className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4">
                        <h3 className="text-white font-bold text-lg">{character.name}</h3>
                    </div>
                </div>
                
                <button
                    onClick={onSaveCharacter}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save to Cast List
                </button>
            </div>
         )}

         {/* Cast / Library Section - Always visible if has items */}
         {savedCharacters.length > 0 && (
            <div className={`space-y-3 ${!hasImage ? 'mb-8' : 'pt-6 border-t border-slate-700'}`}>
                <h3 className="text-sm font-bold text-slate-300 flex justify-between items-center">
                    Cast / Saved Characters
                    <span className="text-xs text-slate-500 font-normal">{savedCharacters.length}</span>
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {savedCharacters.map(c => (
                        <div 
                            key={c.id} 
                            className={`relative group cursor-pointer rounded-lg overflow-hidden border transition-all ${character.id === c.id ? 'border-primary ring-1 ring-primary' : 'border-slate-600 hover:border-slate-400'}`}
                            onClick={() => onLoadCharacter(c)}
                        >
                            <div className="aspect-square bg-black/40">
                                <img src={`data:image/png;base64,${c.baseImage}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={c.name} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 text-[10px] text-center text-white truncate">
                                {c.name}
                            </div>
                             <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onDeleteCharacter(c.id); 
                                }}
                                className="absolute top-0 right-0 z-30 bg-red-600 hover:bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-bl-xl shadow-md transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Delete Character"
                            >
                                <span className="font-bold text-sm leading-none">&times;</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
         )}

        {/* Creation Form (Only if no active character) */}
        {!hasImage && (
            <div className="space-y-6 animate-fadeIn">
                 {/* Input Mode Toggle */}
                <div className="flex bg-dark rounded-lg p-1 border border-slate-700">
                    <button
                        onClick={() => setMode('generate')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-all ${mode === 'generate' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Generate AI
                    </button>
                    <button
                        onClick={() => setMode('upload')}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-all ${mode === 'upload' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        Upload Image
                    </button>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Name</label>
                    <input
                        type="text"
                        value={character.name}
                        onChange={(e) => onCharacterUpdate({ name: e.target.value })}
                        placeholder="e.g. Cyberpunk Samurai"
                        className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                        disabled={isGenerating}
                    />
                </div>

                {/* Conditional Input based on Mode */}
                {mode === 'generate' && (
                    <div className="space-y-2 animate-fadeIn">
                        <label className="text-sm font-medium text-slate-300">Visual Description</label>
                        <textarea
                            value={character.description}
                            onChange={(e) => onCharacterUpdate({ description: e.target.value })}
                            placeholder="Detailed description of appearance (hair, eyes, clothing, style)..."
                            className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary transition-all h-32 resize-none"
                            disabled={isGenerating}
                        />
                    </div>
                )}

                {mode === 'upload' && (
                    <div className="space-y-2 animate-fadeIn">
                        <label className="text-sm font-medium text-slate-300">Reference Image</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-32 border-2 border-dashed border-slate-700 rounded-lg bg-dark/50 hover:bg-dark hover:border-slate-500 transition-all cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-slate-300"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-sm">Click to upload</span>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            accept="image/*" 
                            className="hidden" 
                        />
                        <p className="text-xs text-slate-500">Upload a clear image of your character's face/body.</p>
                    </div>
                )}

                {/* Create/Upload Preview Placeholder */}
                 <div className="border-2 border-dashed border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center bg-dark/50 text-slate-500">
                    {isGenerating ? (
                    <div className="flex flex-col items-center animate-pulse">
                        <Spinner className="w-8 h-8 text-primary mb-2" />
                        <span className="text-sm">Creating {character.name || 'Character'}...</span>
                    </div>
                    ) : (
                    <span className="text-sm">Preview will appear here</span>
                    )}
                </div>
            </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-700 bg-surface">
        {!hasImage && mode === 'generate' && (
          <button
            onClick={onGenerate}
            disabled={isGenerating || !character.description.trim()}
            className={`w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-all transform ${
              isGenerating || !character.description.trim()
                ? 'bg-slate-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-primary to-secondary hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isGenerating ? 'Generating...' : 'Create Character Reference'}
          </button>
        )}
      </div>
    </div>
  );
};