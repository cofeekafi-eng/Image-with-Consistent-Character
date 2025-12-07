import React, { useState, useEffect, useRef } from 'react';
import { Character, GeneratedScene, GeneratorState, GenerationProgress } from '../types';
import { Spinner } from './Spinner';
import { analyzeScript } from '../services/gemini';

interface SceneGeneratorProps {
  character: Character;
  savedCharacters: Character[]; // Added prop
  scenes: GeneratedScene[];
  onGenerateScenes: (prompts: string[]) => void;
  onAnimateScene: (sceneId: string) => void;
  status: GeneratorState;
  progress: GenerationProgress | null;
  animatingSceneIds: Set<string>;
}

type InputMode = 'single' | 'batch' | 'story';

export const SceneGenerator: React.FC<SceneGeneratorProps> = ({
  character,
  savedCharacters,
  scenes,
  onGenerateScenes,
  onAnimateScene,
  status,
  progress,
  animatingSceneIds
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [storyInput, setStoryInput] = useState('');
  const [selectedCastIds, setSelectedCastIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<InputMode>('single');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const isGenerating = status === GeneratorState.GENERATING_SCENE;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [scenes, isGenerating, progress]);

  // Pre-select current active character if available
  useEffect(() => {
    if (character.id && character.name) {
       // Optional: Auto-select active character. 
    }
  }, [character.id]);

  const toggleCastMember = (id: string) => {
    const newSet = new Set(selectedCastIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCastIds(newSet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    if (mode === 'single') {
      if (promptInput.trim()) {
        onGenerateScenes([promptInput]);
        setPromptInput('');
      }
    } else if (mode === 'batch') {
      const prompts = promptInput
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      if (prompts.length > 0) {
        onGenerateScenes(prompts);
        setPromptInput('');
      }
    }
  };

  const handleAnalyzeStory = async () => {
    if (!storyInput.trim()) return;
    setIsAnalyzing(true);
    try {
        // Collect names of selected cast
        const selectedNames: string[] = [];
        
        // Include current active character if it has a name
        if (character.name) selectedNames.push(character.name);

        // Include selected saved characters
        savedCharacters.forEach(c => {
            if (selectedCastIds.has(c.id) && c.name && c.name !== character.name) {
                selectedNames.push(c.name);
            }
        });

        const prompts = await analyzeScript(storyInput, selectedNames);
        
        if (prompts && prompts.length > 0) {
            setPromptInput(prompts.join('\n'));
            setMode('batch');
        }
    } catch (error) {
        console.error(error);
        alert("Failed to analyze story. Please try again.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  // Helper to parse batch prompts for preview
  const getBatchPrompts = () => {
    return promptInput.split('\n').filter(p => p.trim().length > 0);
  };
  const batchPrompts = getBatchPrompts();

  if (!character.baseImage && savedCharacters.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center text-3xl">
            👋
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to CharConsistent AI</h2>
          <p className="text-slate-400">
            To get started, please create your character in the left panel. 
            Once your character is defined, you can generate consistent scenes featuring them here.
          </p>
        </div>
      </div>
    );
  }

  // Combine active character (if exists) with saved characters for the cast list
  const availableCast = [...savedCharacters];
  // If active character is not in saved list (is new), add it temporarily for selection UI
  if (character.baseImage && character.name && !availableCast.find(c => c.id === character.id)) {
      availableCast.unshift(character);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 flex justify-between items-center backdrop-blur-sm bg-dark/80 absolute top-0 left-0 right-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-white">Scene Gallery</h2>
          <p className="text-slate-400 text-sm">
             {character.name ? (
                <>Starring: <span className="text-primary font-medium">{character.name}</span></>
             ) : (
                "Select a character to begin"
             )}
          </p>
        </div>
        <div className="flex items-center gap-4">
           {isGenerating && progress && (
             <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-600">
               <Spinner className="w-4 h-4 text-primary" />
               <div className="text-xs">
                 <span className="text-slate-300">Generating {progress.current} / {progress.total}</span>
                 {progress.currentPrompt && (
                   <div className="text-slate-500 truncate max-w-[150px]">{progress.currentPrompt}</div>
                 )}
               </div>
             </div>
           )}
           <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-mono text-slate-400 border border-slate-700 hidden sm:block">
            Model: gemini-2.5-flash
          </div>
        </div>
      </div>

      {/* Gallery Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 pt-24 pb-72" 
      >
        {scenes.length === 0 && !isGenerating && (
           <div className="h-full flex flex-col items-center justify-center opacity-50">
             <p className="text-slate-500 mb-2">No scenes yet.</p>
             <p className="text-sm text-slate-600">Type a prompt or paste a script below.</p>
           </div>
        )}

        {scenes.map((scene) => (
          <div key={scene.id} className="bg-surface rounded-2xl overflow-hidden border border-slate-700 shadow-xl max-w-4xl mx-auto animate-fadeIn group">
            <div className="aspect-video bg-black relative flex items-center justify-center">
              {scene.videoUrl ? (
                <video 
                  src={scene.videoUrl} 
                  controls 
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                />
              ) : (
                <>
                  <img 
                    src={`data:image/png;base64,${scene.imageData}`} 
                    alt={scene.prompt}
                    className={`w-full h-full object-contain transition-opacity duration-300 ${animatingSceneIds.has(scene.id) ? 'opacity-50 blur-sm' : ''}`}
                  />
                  {animatingSceneIds.has(scene.id) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                      <Spinner className="w-10 h-10 text-secondary mb-2" />
                      <span className="text-white font-bold text-shadow bg-black/50 px-3 py-1 rounded-full text-sm">Animating...</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                ✨
              </div>
              <div className="flex-1">
                <p className="text-slate-300 italic">"{scene.prompt}"</p>
                <div className="flex gap-4 mt-2 items-center">
                    <p className="text-xs text-slate-500 font-mono">
                    Generated {new Date(scene.timestamp).toLocaleTimeString()}
                    </p>
                    {scene.videoUrl && <span className="text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded border border-secondary/30">Video Ready</span>}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                 {!scene.videoUrl && (
                     <button
                        onClick={() => onAnimateScene(scene.id)}
                        disabled={animatingSceneIds.has(scene.id)}
                        className="bg-slate-700 hover:bg-secondary text-white text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Animate this scene"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Animate
                     </button>
                 )}

                 <a 
                    href={scene.videoUrl || `data:image/png;base64,${scene.imageData}`}
                    download={scene.videoUrl ? `scene-${scene.id}.mp4` : `scene-${scene.id}.png`}
                    className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
                    title={scene.videoUrl ? "Download Video" : "Download Image"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </a>
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="bg-surface/50 rounded-2xl p-8 max-w-4xl mx-auto border border-dashed border-slate-700 flex flex-col items-center justify-center py-12 animate-pulse">
            <Spinner className="w-8 h-8 text-secondary mb-4" />
            <p className="text-slate-300">Painting scene {progress ? `${progress.current} of ${progress.total}` : ''}...</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-surface border-t border-slate-700 absolute bottom-0 left-0 right-0 z-20 shadow-2xl">
        <div className="max-w-4xl mx-auto p-4">
          
          {/* Mode Tabs */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto">
             <button
               type="button"
               onClick={() => setMode('single')}
               className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap ${mode === 'single' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
               Single Prompt
             </button>
             <button
               type="button"
               onClick={() => setMode('batch')}
               className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${mode === 'batch' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <span>Batch / Bulk</span>
               <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded uppercase tracking-wide">Pro</span>
             </button>
             <button
               type="button"
               onClick={() => setMode('story')}
               className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${mode === 'story' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
             >
               <span>Story Mode</span>
               <span className="text-[10px] bg-secondary/20 text-secondary px-1.5 rounded uppercase tracking-wide">Beta</span>
             </button>
          </div>

          <div className="relative">
            {mode === 'single' && (
              // Single Mode Input
              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={character.name ? `Describe what ${character.name} is doing...` : "Describe a scene..."}
                  className="w-full bg-dark border border-slate-600 rounded-xl pl-4 pr-32 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent shadow-inner"
                  disabled={isGenerating}
                />
                 <button
                  type="submit"
                  disabled={isGenerating || !promptInput.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-secondary hover:bg-purple-600 text-white px-6 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? <Spinner className="w-4 h-4" /> : <span>Paint</span>}
                </button>
              </form>
            )}

            {mode === 'batch' && (
              // Batch Mode Input
              <form onSubmit={handleSubmit} className="space-y-3">
                 {/* Queue Visualization */}
                 {batchPrompts.length > 0 && (
                   <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {batchPrompts.map((p, idx) => (
                        <div key={idx} className="flex-shrink-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 max-w-[200px] whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-2">
                           <span className="bg-slate-700 text-slate-400 w-4 h-4 rounded-full flex items-center justify-center text-[10px]">{idx + 1}</span>
                           <span>{p}</span>
                        </div>
                      ))}
                      <div className="flex-shrink-0 text-xs text-slate-500 self-center px-2">
                        {batchPrompts.length} images queued
                      </div>
                   </div>
                 )}

                 <div className="relative">
                    <textarea
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder={`Paste multiple prompts here.\nUse [CharacterName] at the start to specify a character.\nExample:\n[John] John walking in the rain\n[Mary] Mary driving a car`}
                      className="w-full bg-dark border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent shadow-inner min-h-[120px] resize-none font-mono text-sm leading-relaxed"
                      disabled={isGenerating}
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button
                        type="submit"
                        disabled={isGenerating || batchPrompts.length === 0}
                        className="bg-secondary hover:bg-purple-600 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                      >
                        {isGenerating ? <Spinner className="w-4 h-4" /> : <span>Generate {batchPrompts.length > 0 ? `${batchPrompts.length} Scenes` : 'Batch'}</span>}
                      </button>
                    </div>
                 </div>
              </form>
            )}

            {mode === 'story' && (
                // Story Mode Input
                <div className="space-y-3">
                    <div className="flex gap-3 h-[250px]">
                        <div className="flex-1 flex flex-col">
                            <label className="text-xs text-slate-400 block mb-1">Story / Script (Max ~50k words)</label>
                            <textarea
                                value={storyInput}
                                onChange={(e) => setStoryInput(e.target.value)}
                                placeholder="Paste your full story or script here..."
                                className="flex-1 w-full bg-dark border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-inner resize-none font-mono text-sm leading-relaxed"
                                disabled={isAnalyzing}
                            />
                        </div>
                        <div className="w-1/3 flex flex-col gap-3">
                             <div className="flex-1 flex flex-col overflow-hidden">
                                <label className="text-xs text-slate-400 block mb-1">Select Cast Members</label>
                                <div className="flex-1 bg-dark border border-slate-600 rounded-lg p-2 overflow-y-auto">
                                   {availableCast.length === 0 ? (
                                      <p className="text-xs text-slate-500 text-center mt-4">No characters available.</p>
                                   ) : (
                                      <div className="grid grid-cols-2 gap-2">
                                         {availableCast.map(c => (
                                            <div 
                                              key={c.id}
                                              onClick={() => toggleCastMember(c.id)}
                                              className={`cursor-pointer rounded-md border p-1 flex flex-col items-center gap-1 transition-all ${selectedCastIds.has(c.id) ? 'border-primary bg-primary/10' : 'border-slate-700 hover:border-slate-500'}`}
                                            >
                                               <div className="w-8 h-8 rounded-full overflow-hidden bg-black">
                                                  {c.baseImage && (
                                                     <img src={`data:image/png;base64,${c.baseImage}`} className="w-full h-full object-cover" />
                                                  )}
                                               </div>
                                               <span className="text-[10px] text-center truncate w-full">{c.name}</span>
                                            </div>
                                         ))}
                                      </div>
                                   )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Selected characters will be identified in the script.
                                </p>
                             </div>
                             <button
                                type="button"
                                onClick={handleAnalyzeStory}
                                disabled={isAnalyzing || !storyInput.trim()}
                                className="mt-auto bg-primary hover:bg-indigo-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                             >
                                {isAnalyzing ? <Spinner className="w-4 h-4" /> : <span>Analyze & Extract</span>}
                             </button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};