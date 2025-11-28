import { GoogleGenAI, Type } from "@google/genai";
import { LevelTheme } from "../types";

// Helper to safely get API key
const getApiKey = () => (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : '';

export const generateLevelMission = async (levelNumber: number, vehicleName: string): Promise<LevelTheme> => {
  const fallback: LevelTheme = {
    title: `Level ${levelNumber}`,
    description: "Deliver as many packages as possible! Avoid the stray animals.",
    environmentColor: "bg-indigo-900", // More colorful fallback
    primaryObstacle: "Stray Dogs"
  };

  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("No API_KEY found. Using fallback level data.");
    return fallback;
  }

  try {
    // Initialize the API client inside the function to avoid top-level crashes
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a funny, high-stakes, 1-sentence delivery mission briefing for level ${levelNumber} of a game. 
      The player is driving a ${vehicleName}. 
      Enemies include dogs, cats, angry pedestrians, and kids.
      Also pick a VIBRANT, colorful dark CSS background color class for the road (e.g. bg-indigo-900, bg-violet-950, bg-fuchsia-950, bg-blue-950, bg-emerald-900) and identify the primary threat.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "A catchy 3-5 word mission title" },
            description: { type: Type.STRING, description: "One sentence funny briefing" },
            environmentColor: { type: Type.STRING, description: "Tailwind CSS class for background color" },
            primaryObstacle: { type: Type.STRING, description: "Name of the main enemy this level" }
          },
          required: ["title", "description", "environmentColor", "primaryObstacle"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as LevelTheme;
    }
    return fallback;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return fallback;
  }
};