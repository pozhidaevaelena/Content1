
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Post, Period, ToneOfVoice, AnalysisData, PostStatus, ContentHistoryItem } from "../types";

const API_KEY = process.env.API_KEY;

export const generateAnalysis = async (niche: string): Promise<AnalysisData> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Проведи глубокий анализ ниши "${niche}" на русском языке. 
  Найди 3 основных конкурентов, актуальные новости и тренды на текущий момент. 
  Определи, какой контент получает больше всего откликов.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const structuredResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Преврати этот анализ в JSON объект с полями: 
    competitors (массив), 
    trends (массив), 
    summary (текст). 
    Анализ: ${response.text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
          trends: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
        },
        required: ["competitors", "trends", "summary"]
      }
    }
  });

  return JSON.parse(structuredResponse.text);
};

export const generateContentPlan = async (
  niche: string, 
  period: Period, 
  tone: ToneOfVoice, 
  analysis: AnalysisData,
  history: ContentHistoryItem[] = []
): Promise<Post[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const days = period === Period.WEEK ? 7 : 30;

  // Filter history to current niche to be more specific, or use all for global variety
  const relevantHistory = history.filter(h => h.niche.toLowerCase() === niche.toLowerCase()).map(h => h.title);
  const historyPrompt = relevantHistory.length > 0 
    ? `ВАЖНО: Никогда не повторяй темы и заголовки, которые уже использовались ранее: ${relevantHistory.join(', ')}. Создай абсолютно новый и свежий контент.`
    : "";

  const prompt = `Создай контент-план на ${days} дней для ниши "${niche}" в стиле "${tone}".
  Учитывай тренды: ${analysis.trends.join(', ')}.
  ${historyPrompt}
  Для каждого дня придумай уникальный пост, Reels или Story.
  Верни результат как JSON массив объектов.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["Post", "Reels", "Story"] },
            content: { type: Type.STRING },
            script: { type: Type.STRING },
            day: { type: Type.NUMBER }
          },
          required: ["title", "type", "content", "day"]
        }
      }
    }
  });

  const rawPosts = JSON.parse(response.text);
  return rawPosts.map((p: any, index: number) => ({
    ...p,
    id: Math.random().toString(36).substr(2, 9),
    date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'),
    status: PostStatus.PENDING,
    editCount: 0,
    imageUrl: `https://picsum.photos/seed/${Math.random()}/800/600`
  }));
};

export const editPostContent = async (post: Post, feedback: string): Promise<Post> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `Отредактируй пост "${post.title}" на основе обратной связи: "${feedback}". 
  Учти предыдущий контент: ${post.content}. 
  Верни обновленный JSON объект с полями content и script.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          script: { type: Type.STRING }
        },
        required: ["content"]
      }
    }
  });

  const updated = JSON.parse(response.text);
  return {
    ...post,
    content: updated.content,
    script: updated.script || post.script,
    editCount: post.editCount + 1,
    status: PostStatus.PENDING
  };
};
