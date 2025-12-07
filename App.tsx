import React, { useState, useEffect } from 'react';
import { CharacterSetup } from './components/CharacterSetup';
import { SceneGenerator } from './components/SceneGenerator';
import { Character, GeneratedScene, GeneratorState, GenerationProgress } from './types';
import { generateCharacterImage, generateSceneImage, animateImage } from './services/gemini';
import { saveCharacterToStorage, loadSavedCharacters, deleteCharacterFromStorage } from './services/storage';

const INITIAL_CHARACTER: Character = {
  id: '1',
  name: '',
  description: '',
  baseImage: null,
};

export default function App() {
  const [character, setCharacter] = useState<Character>(INITIAL_CHARACTER);
  const [scenes, setScenes] = useState<GeneratedScene[]>([]);
  const [status, setStatus] = useState<GeneratorState>(GeneratorState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<Character[]>([]);
  const [animatingSceneIds, setAnimatingSceneIds] = useState<Set<string>>(new Set());

  // Load characters on mount
  useEffect(() => {
    loadSavedCharacters().then(chars => {
      setSavedCharacters(chars);
    });
  }, []);

  const handleCharacterUpdate = (updates: Partial<Character>) => {
    setCharacter(prev => ({ ...prev, ...updates }));
  };

  const handleGenerateCharacter = async () => {
    if (!character.description.trim()) return;
    
    setStatus(GeneratorState.GENERATING_CHARACTER);
    setError(null);

    try {
      const base64Image = await generateCharacterImage(character.description);
      setCharacter(prev => ({
        ...prev,
        baseImage: base64Image
      }));
    } catch (err: any) {
      setError(err.message || "Failed to generate character.");
    } finally {
      setStatus(GeneratorState.IDLE);
    }
  };

  const handleResetCharacter = () => {
    if (scenes.length > 0 && !confirm("This will clear your current workspace and generated scenes. Are you sure?")) {
        return;
    }
    setCharacter({
        id: Date.now().toString(),
        name: '',
        description: '',
        baseImage: null
    });
    setScenes([]);
  };

  const handleSaveCharacter = async () => {
    if (!character.baseImage || !character.name) {
        setError("Character must have a name and an image to be saved.");
        return;
    }
    
    try {
        const updatedList = await saveCharacterToStorage(character);
        setSavedCharacters(updatedList);
    } catch (e: any) {
        setError(e.message || "Failed to save character");
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (confirm("Delete this character from library?")) {
        try {
            const updatedList = await deleteCharacterFromStorage(id);
            setSavedCharacters(updatedList);
        } catch (e: any) {
            setError(e.message || "Failed to delete character");
        }
    }
  };

  const handleLoadCharacter = (c: Character) => {
    if (scenes.length > 0) {
        if (!confirm("Loading a new character will clear current generated scenes. Continue?")) return;
    }
    setCharacter(c);
    setScenes([]);
  };

  const handleGenerateScenes = async (prompts: string[]) => {
    if (prompts.length === 0) return;

    setStatus(GeneratorState.GENERATING_SCENE);
    setError(null);
    setProgress({ current: 0, total: prompts.length });

    let completedCount = 0;

    // Process sequentially to ensure stability
    for (const prompt of prompts) {
      if (!prompt.trim()) continue;

      setProgress({ 
        current: completedCount + 1, 
        total: prompts.length,
        currentPrompt: prompt 
      });

      try {
        // Logic to extract character tags [Name] from prompt
        // Matches [Name] or [Name1, Name2] at start of string
        const tagMatch = prompt.match(/^\[(.*?)\]/);
        const references: { name: string, base64: string }[] = [];
        let finalPrompt = prompt;

        if (tagMatch) {
            // Found tag, e.g. "John, Mary"
            const names = tagMatch[1].split(',').map(n => n.trim());
            
            // Search in saved characters + active character
            const allAvailable = [...savedCharacters];
            if (character.baseImage && character.name) {
                allAvailable.push(character);
            }

            names.forEach(name => {
                const found = allAvailable.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (found && found.baseImage) {
                    references.push({ name: found.name, base64: found.baseImage });
                }
            });

            // Strip the tag from the visual prompt sent to model to avoid confusion, 
            // though keeping it is also fine as the model understands context.
            // Let's keep it in the prompt text but use the references.
        } else {
            // No tag found. Fallback to current active character if exists.
            if (character.baseImage && character.name) {
                references.push({ name: character.name, base64: character.baseImage });
            }
        }

        if (references.length === 0) {
           // Fallback if no references found at all (e.g. tag didn't match any saved char)
           // If we have an active character, use it as last resort
           if (character.baseImage && character.name) {
              references.push({ name: character.name, base64: character.baseImage });
           }
        }
        
        // If we still have no references, we can't do consistent generation, 
        // but we can still generate a generic scene if we wanted.
        // For this app, let's skip or error if consistency is expected.
        if (references.length === 0) {
            throw new Error("No character reference found for this scene.");
        }

        const sceneImageBase64 = await generateSceneImage(references, finalPrompt);
        
        const newScene: GeneratedScene = {
          id: Date.now().toString() + Math.random().toString().slice(2),
          prompt: prompt,
          imageData: sceneImageBase64,
          timestamp: Date.now(),
        };

        setScenes(prev => [...prev, newScene]);
      } catch (err: any) {
        console.error(`Failed to generate scene for: ${prompt}`, err);
        setError(`Failed to generate "${prompt.slice(0, 20)}...": ${err.message}`);
        // We continue to the next one even if one fails
      }
      
      completedCount++;
    }

    setStatus(GeneratorState.IDLE);
    setProgress(null);
  };

  const handleAnimateScene = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    // Check for Paid API Key selection (required for Veo)
    if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            if ((window as any).aistudio.openSelectKey) {
                 await (window as any).aistudio.openSelectKey();
                 // Assume success and proceed, as strict checking can be racy
            }
        }
    }

    setAnimatingSceneIds(prev => {
        const next = new Set(prev);
        next.add(sceneId);
        return next;
    });

    try {
        const videoUrl = await animateImage(scene.imageData, scene.prompt);
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, videoUrl } : s));
    } catch (e: any) {
        console.error(e);
        setError(`Animation failed: ${e.message}`);
    } finally {
        setAnimatingSceneIds(prev => {
            const next = new Set(prev);
            next.delete(sceneId);
            return next;
        });
    }
  };

  return (
    <div className="flex h-screen w-screen bg-dark text-slate-200 font-sans overflow-hidden">
        {/* Mobile Overlay for small screens */}
        <div className="md:hidden fixed inset-0 z-50 bg-dark flex items-center justify-center p-8 text-center">
            <div>
                <h1 className="text-2xl font-bold text-primary mb-4">Desktop Recommended</h1>
                <p className="text-slate-400">Please use a larger screen for the best creative experience.</p>
            </div>
        </div>

        {/* Left Panel: Character */}
        <CharacterSetup 
            character={character}
            onCharacterUpdate={handleCharacterUpdate}
            onGenerate={handleGenerateCharacter}
            status={status}
            onReset={handleResetCharacter}
            savedCharacters={savedCharacters}
            onLoadCharacter={handleLoadCharacter}
            onSaveCharacter={handleSaveCharacter}
            onDeleteCharacter={handleDeleteCharacter}
        />

        {/* Right Panel: Scenes */}
        <SceneGenerator 
            character={character}
            savedCharacters={savedCharacters}
            scenes={scenes}
            onGenerateScenes={handleGenerateScenes}
            onAnimateScene={handleAnimateScene}
            status={status}
            progress={progress}
            animatingSceneIds={animatingSceneIds}
        />

        {/* Error Toast */}
        {error && (
            <div className="fixed top-4 right-4 z-50 bg-red-500/10 border border-red-500 text-red-200 px-4 py-3 rounded-lg shadow-xl backdrop-blur-md max-w-md animate-fadeIn flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                    <h4 className="font-bold text-sm">Alert</h4>
                    <p className="text-xs opacity-90">{error}</p>
                </div>
                <button 
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-white"
                >
                    &times;
                </button>
            </div>
        )}
    </div>
  );
}