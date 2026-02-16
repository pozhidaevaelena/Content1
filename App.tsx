
import React, { useState, useEffect } from 'react';
import { Post, Period, ToneOfVoice, ContentPlan, PostStatus, ContentHistoryItem } from './types';
import { generateAnalysis, generateContentPlan, editPostContent } from './geminiService';
import { sendToTelegram } from './telegramService';
import WizardForm from './WizardForm';
import PostCard from './PostCard';
import PublishDialog from './PublishDialog';

declare global {
  interface Window {
    Telegram: any;
  }
}

const App: React.FC = () => {
  const [step, setStep] = useState<'form' | 'dashboard' | 'publishing'>('form');
  const [loadingStage, setLoadingStage] = useState<number>(-1);
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [history, setHistory] = useState<ContentHistoryItem[]>([]);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      tg.headerColor = '#0f172a';
      tg.backgroundColor = '#0f172a';
      setIsTelegram(true);
    }

    const savedHistory = localStorage.getItem('cf_content_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error("History load error", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cf_content_history', JSON.stringify(history));
  }, [history]);

  const loadingSteps = [
    "Глубокий анализ ниши и конкурентов...",
    "Проверка истории для исключения дублей...",
    "Поиск актуальных трендов и инфоповодов...",
    "Формирование стратегии и контент-плана...",
    "Генерация сценариев и визуалов..."
  ];

  const handleStartProcess = async (data: { niche: string, period: Period, tone: ToneOfVoice }) => {
    setLoadingStage(0);
    try {
      const analysis = await generateAnalysis(data.niche);
      setLoadingStage(1);
      const posts = await generateContentPlan(data.niche, data.period, data.tone, analysis, history);
      setLoadingStage(3);
      await new Promise(r => setTimeout(r, 1000));
      setLoadingStage(4);
      await new Promise(r => setTimeout(r, 800));

      setPlan({ niche: data.niche, period: data.period, tone: data.tone, posts, analysis });
      
      const newHistoryItems: ContentHistoryItem[] = posts.map(p => ({ niche: data.niche, title: p.title }));
      setHistory(prev => [...prev, ...newHistoryItems]);

      setStep('dashboard');
      setLoadingStage(-1);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (error) {
      console.error("Process error:", error);
      alert("Ошибка генерации. Проверьте соединение и настройки API.");
      setLoadingStage(-1);
    }
  };

  const handleApprove = (postId: string) => {
    if (!plan) return;
    const updatedPosts = plan.posts.map(p => p.id === postId ? { ...p, status: PostStatus.APPROVED } : p);
    setPlan({ ...plan, posts: updatedPosts });
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  };

  const handleEdit = async (postId: string, feedback: string) => {
    if (!plan) return;
    setLoadingStage(3);
    try {
      const postToEdit = plan.posts.find(p => p.id === postId);
      if (postToEdit) {
        const updatedPost = await editPostContent(postToEdit, feedback);
        const updatedPosts = plan.posts.map(p => p.id === postId ? updatedPost : p);
        setPlan({ ...plan, posts: updatedPosts });
      }
    } catch (error) {
      alert("Ошибка при редактировании.");
    } finally {
      setLoadingStage(-1);
    }
  };

  const allApproved = plan?.posts.every(p => p.status === PostStatus.APPROVED);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      if (step === 'dashboard' && allApproved) {
        tg.MainButton.text = "ОПУБЛИКОВАТЬ В TELEGRAM";
        tg.MainButton.show();
        tg.MainButton.onClick(() => setShowPublishDialog(true));
      } else {
        tg.MainButton.hide();
      }
    }
  }, [allApproved, step]);

  const handlePublishConfirm = async (config: { botToken: string, chatId: string }) => {
    if (!plan) return;
    setShowPublishDialog(false);
    setLoadingStage(0);
    
    try {
      const approvedPosts = plan.posts.filter(p => p.status === PostStatus.APPROVED);
      await sendToTelegram(config.botToken, config.chatId, approvedPosts);
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        window.Telegram.WebApp.showAlert("Контент успешно отправлен в вашего бота!");
      } else {
        alert("Контент успешно опубликован!");
      }
      
      setStep('form');
      setPlan(null);
    } catch (error: any) {
      alert("Ошибка публикации: " + error.message);
    } finally {
      setLoadingStage(-1);
    }
  };

  return (
    <div className={`min-h-screen pb-20 selection:bg-blue-500/30 ${isTelegram ? 'pt-safe' : ''}`}>
      <nav className="glass sticky top-0 z-40 px-6 py-5 flex justify-between items-center border-b border-white/5 mb-8 backdrop-blur-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 gradient-btn rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-blue-500/20">C</div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tighter leading-none">ContentFactory <span className="text-blue-400">AI</span></span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Engine v4.0 (TG)</span>
              <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
              <span className="text-[9px] text-blue-400/80 uppercase font-bold">Memory: {history.length}</span>
            </div>
          </div>
        </div>
        
        {step === 'dashboard' && (
          <div className="flex items-center gap-4">
            {!isTelegram && allApproved && (
              <button 
                onClick={() => setShowPublishDialog(true)}
                className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider animate-pulse"
              >
                Публикация
              </button>
            )}
            <button 
              onClick={() => {
                 if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
                 setStep('form');
              }}
              className="glass p-2.5 rounded-xl text-slate-400 hover:text-white transition-all border-white/5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {step === 'form' && loadingStage === -1 && (
          <WizardForm onSubmit={handleStartProcess} isLoading={false} />
        )}

        {loadingStage !== -1 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#020617] animate-fade-in">
            <div className="max-w-lg w-full space-y-12 text-center">
              <div className="relative inline-block scale-125">
                 <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full mx-auto animate-spin border-t-blue-500"></div>
                 <div className="absolute inset-0 flex items-center justify-center font-black text-2xl gradient-text animate-pulse">AI</div>
              </div>
              
              <div className="space-y-6 pt-4">
                <h3 className="text-2xl font-bold gradient-text">Конвейер запущен...</h3>
                <div className="space-y-3">
                  {loadingSteps.map((s, i) => (
                    <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-700 ${
                      i === loadingStage ? 'glass neon-border scale-105 opacity-100 shadow-2xl' : 
                      i < loadingStage ? 'opacity-40 grayscale translate-x-2' : 'opacity-5 opacity-0'
                    }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                        i === loadingStage ? 'bg-blue-600 animate-pulse text-white' : 
                        i < loadingStage ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'
                      }`}>
                        {i < loadingStage ? '✓' : i + 1}
                      </div>
                      <span className={`text-sm font-bold tracking-tight ${i === loadingStage ? 'text-white' : 'text-slate-400'}`}>
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'dashboard' && plan && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Мастер-План</h2>
                  <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black rounded-full border border-blue-500/20 tracking-widest uppercase">Factory Active</div>
                </div>
                <p className="text-slate-400 font-medium text-sm">
                  {plan.niche} • {plan.tone} • {plan.period}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-4 p-2 bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur-md">
                 <div className="flex flex-col px-4 border-r border-white/5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Прошлый опыт</span>
                    <span className="text-base font-black text-blue-400">{history.length}</span>
                 </div>
                 <div className="flex flex-col px-4">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Текущий план</span>
                    <span className="text-base font-black text-white">{plan.posts.length}</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plan.posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onApprove={handleApprove} 
                  onEdit={handleEdit} 
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {showPublishDialog && (
        <PublishDialog 
          onConfirm={handlePublishConfirm} 
          onCancel={() => setShowPublishDialog(false)} 
        />
      )}
    </div>
  );
};

export default App;
