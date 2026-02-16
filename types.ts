
export enum Period {
  WEEK = 'Неделя',
  MONTH = 'Месяц'
}

export enum ToneOfVoice {
  FRIENDLY = 'Дружелюбный',
  CREATIVE = 'Креативный',
  PROFESSIONAL = 'Профессиональный',
  STRICT = 'Строгий',
  HUMOROUS = 'С юмором'
}

export enum PostStatus {
  PENDING = 'На согласовании',
  APPROVED = 'Согласовано',
  EDITING = 'Редактируется',
  PUBLISHED = 'Опубликовано'
}

export interface Post {
  id: string;
  day: number;
  date: string;
  title: string;
  type: 'Post' | 'Reels' | 'Story';
  content: string;
  script?: string;
  imageUrl?: string;
  status: PostStatus;
  editCount: number;
  feedback?: string;
}

export interface AnalysisData {
  competitors: string[];
  trends: string[];
  summary: string;
}

export interface ContentPlan {
  niche: string;
  period: Period;
  tone: ToneOfVoice;
  posts: Post[];
  analysis?: AnalysisData;
}

export interface ContentHistoryItem {
  niche: string;
  title: string;
}
