import { GoogleGenerativeAI } from "@google/generative-ai";
import { Post, Period, ToneOfVoice, AnalysisData, PostStatus, ContentHistoryItem } from "../types";

// Важно: переменная должна начинаться с VITE_ и читаться через import.meta.env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || '');

export const generateAnalysis = async (niche: string): Promise<AnalysisData> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `Проведи глубокий анализ ниши "${niche}" на русском языке. 
  Найди 3 основных конкурентов, актуальные новости и тренды на текущий момент. 
  Определи, какой контент получает больше всего откликов.
  
  Ответ должен быть в формате JSON:
  {
    "competitors": ["конкурент1", "конкурент2", "конкурент3"],
    "trends": ["тренд1", "тренд2", "тренд3"],
    "summary": "текст с анализом"
  }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Извлекаем JSON из ответа
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Не удалось распарсить JSON ответ от Gemini');
  }
  
  return JSON.parse(jsonMatch[0]);
};

export const generateContentPlan = async (
  niche: string, 
  period: Period, 
  tone: ToneOfVoice, 
  analysis: AnalysisData,
  history: ContentHistoryItem[] = []
): Promise<Post[]> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const days = period === Period.WEEK ? 7 : 30;

  const relevantHistory = history.filter(h => h.niche.toLowerCase() === niche.toLowerCase()).map(h => h.title);
  const historyPrompt = relevantHistory.length > 0 
    ? `ВАЖНО: Никогда не повторяй темы и заголовки, которые уже использовались ранее: ${relevantHistory.join(', ')}. Создай абсолютно новый и свежий контент.`
    : "";

  const prompt = `Создай контент-план на ${days} дней для ниши "${niche}" в стиле "${tone}".
  Учитывай тренды: ${analysis.trends.join(', ')}.
  ${historyPrompt}
  Для каждого дня придумай уникальный пост, Reels или Story.
  
  Верни ТОЛЬКО JSON массив без пояснений:
  [
    {
      "title": "заголовок",
      "type": "Post" | "Reels" | "Story",
      "content": "текст поста",
      "script": "сценарий (если Reels)",
      "day": 1
    }
  ]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Извлекаем JSON из ответа
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Не удалось распарсить JSON ответ от Gemini');
  }
  
  const rawPosts = JSON.parse(jsonMatch[0]);
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
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  const prompt = `Отредактируй пост "${post.title}" на основе обратной связи: "${feedback}". 
  Учти предыдущий контент: ${post.content}.
  
  Верни ТОЛЬКО JSON объект без пояснений:
  {
    "content": "обновленный текст поста",
    "script": "обновленный сценарий (если есть)"
  }`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Не удалось распарсить JSON ответ от Gemini');
  }
  
  const updated = JSON.parse(jsonMatch[0]);
  return {
    ...post,
    content: updated.content,
    script: updated.script || post.script,
    editCount: post.editCount + 1,
    status: PostStatus.PENDING
  };
};