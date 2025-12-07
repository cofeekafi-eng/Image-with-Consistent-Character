import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
// IMPORTANT: Expects process.env.API_KEY to be available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME_IMAGE = 'gemini-2.5-flash-image';
const MODEL_NAME_TEXT = 'gemini-2.5-flash';
const MODEL_NAME_VIDEO = 'veo-3.1-fast-generate-preview';

/**
 * Generates the initial character reference image based on a text description.
 */
export const generateCharacterImage = async (prompt: string): Promise<string> => {
  try {
    const fullPrompt = `Create a character sheet or portrait based on this description. The background should be neutral or simple. Character description: ${prompt}`;
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME_IMAGE,
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let base64Image = '';

    // Iterate through parts to find the image
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          break; 
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image data found in response");
    }

    return base64Image;

  } catch (error: any) {
    console.error("Gemini API Error (Character):", error);
    throw new Error(error.message || "Failed to generate character");
  }
};

/**
 * Generates a new scene using one or more character reference images.
 * Accepts an array of references: { name: string, base64: string }
 */
export const generateSceneImage = async (
  references: { name: string, base64: string }[], 
  scenePrompt: string
): Promise<string> => {
  try {
    const parts: any[] = [];
    let promptContext = "Generate a scene based on the following description. ";

    if (references.length > 0) {
      promptContext += "Use the provided reference images for character consistency:\n";
      
      // Add each reference image to the content parts
      for (const ref of references) {
        const cleanBase64 = ref.base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64,
          },
        });
        promptContext += `- Reference for character "${ref.name}" is provided above.\n`;
      }
      
      promptContext += `\nSCENE DESCRIPTION: ${scenePrompt}\n`;
      promptContext += `IMPORTANT: Maintain the facial features and appearance of the characters as depicted in their reference images.`;
    } else {
      promptContext += `\nSCENE DESCRIPTION: ${scenePrompt}`;
    }

    parts.push({ text: promptContext });

    const response = await ai.models.generateContent({
      model: MODEL_NAME_IMAGE,
      contents: {
        parts: parts,
      },
       config: {
        imageConfig: {
          aspectRatio: "16:9", // Cinematic aspect ratio for scenes
        }
      }
    });

    let base64Image = '';

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image data found in scene response");
    }

    return base64Image;

  } catch (error: any) {
    console.error("Gemini API Error (Scene):", error);
    throw new Error(error.message || "Failed to generate scene");
  }
};

/**
 * Analyzes a long script or story and breaks it down into individual scene prompts.
 * Accepts a list of known character names to tag scenes.
 */
export const analyzeScript = async (scriptText: string, knownCharacters: string[] = []): Promise<string[]> => {
  try {
    let systemPrompt = "You are an expert storyboard artist and script visualizer.";
    
    let charContext = "";
    if (knownCharacters.length > 0) {
      charContext = `\nKNOWN CHARACTERS: ${knownCharacters.join(', ')}.`;
    }

    let userPrompt = `Analyze the following story/script. Break it down into distinct visual scenes. For each scene, write a detailed, standalone image generation prompt.
    ${charContext}
    
    Guidelines:
    1. Each prompt must be descriptive (lighting, angle, action, environment).
    2. If the text contains dialogue, convert the context of that dialogue into a visual action.
    3. IMPORTANT: If any of the "KNOWN CHARACTERS" appear in the scene, strictly prefix the prompt with their names in brackets, e.g., "[John] John enters the dark room" or "[John, Mary] John and Mary talking in the park".
    4. If no known characters are present, do not use brackets.
    5. Output strictly a JSON list of strings.
    `;

    userPrompt += `\n\nScript:\n${scriptText.substring(0, 100000)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME_TEXT,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];

    return JSON.parse(text) as string[];

  } catch (error: any) {
    console.error("Gemini API Error (Script Analysis):", error);
    throw new Error(error.message || "Failed to analyze script");
  }
};

/**
 * Animates a static image using Veo.
 */
export const animateImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    // Re-initialize to ensure we pick up any fresh API keys selected by the user
    const freshAi = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    // Clean base64 just in case
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    let operation = await freshAi.models.generateVideos({
      model: MODEL_NAME_VIDEO,
      prompt: prompt,
      image: {
        imageBytes: cleanBase64,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await freshAi.operations.getVideosOperation({operation: operation});
    }

    if (operation.error) {
       throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) {
        throw new Error("No video URI received from API.");
    }

    // Fetch the actual video blob using the key
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        throw new Error("Failed to download generated video.");
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Gemini API Error (Animation):", error);
    throw new Error(error.message || "Failed to animate scene");
  }
};