'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import api from '@/lib/api';
import {
  Sparkles,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';

export default function AiAssistantPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [answering, setAnswering] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ question: string; answer: string }>>([]);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ai-assistant/insights');
      setInsights(res.data);
    } catch (error: any) {
      console.error('Error loading insights:', error);
      toast.error('Failed to load AI insights');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || answering) return;

    const userQuestion = question.trim();
    setQuestion('');
    setAnswering(true);
    setAnswer('');

    try {
      const res = await api.post('/ai-assistant/ask', { question: userQuestion });
      const newAnswer = res.data.answer;
      setAnswer(newAnswer);
      setChatHistory((prev) => [...prev, { question: userQuestion, answer: newAnswer }]);
    } catch (error: any) {
      console.error('Error asking question:', error);
      toast.error(error.response?.data?.error || 'Failed to get answer');
    } finally {
      setAnswering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-gray-600">Analyzing your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Assistant</h1>
            <p className="text-xs sm:text-sm text-gray-600">Get instant insights and recommendations</p>
          </div>
        </div>
        <button
          onClick={loadInsights}
          className="px-3 sm:px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors self-start sm:self-auto"
        >
          Refresh Insights
        </button>
      </div>

      {/* Summary Card */}
      {insights?.summary && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Summary</h3>
              <p className="text-sm sm:text-base text-gray-700">{insights.summary}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Insights */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Key Insights</h2>
          </div>
          <ul className="space-y-3">
            {insights?.insights?.map((insight: string, idx: number) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-sm text-gray-700 flex-1">{insight}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recommendations</h2>
          </div>
          <ul className="space-y-3">
            {insights?.recommendations?.map((rec: string, idx: number) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-sm text-gray-700 flex-1">{rec}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Metrics */}
      {insights?.keyMetrics && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Key Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {insights.keyMetrics.totalCredentials !== undefined && (
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {insights.keyMetrics.totalCredentials}
                </p>
                <p className="text-xs text-gray-600 mt-1">Credentials</p>
              </div>
            )}
            {insights.keyMetrics.totalInvoices !== undefined && (
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {insights.keyMetrics.totalInvoices}
                </p>
                <p className="text-xs text-gray-600 mt-1">Invoices</p>
              </div>
            )}
            {insights.keyMetrics.totalSpend !== undefined && (
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(Number(insights.keyMetrics.totalSpend))}
                </p>
                <p className="text-xs text-gray-600 mt-1">Total Spend</p>
              </div>
            )}
            {insights.keyMetrics.pendingInvoices !== undefined && (
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {insights.keyMetrics.pendingInvoices}
                </p>
                <p className="text-xs text-gray-600 mt-1">Pending</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Interface */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Ask a Question</h2>
        </div>

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {chatHistory.map((chat, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">You</span>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{chat.question}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-gray-900">{chat.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current Answer */}
        {answer && chatHistory.length === 0 && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-900 flex-1">{answer}</p>
            </div>
          </div>
        )}

        {/* Question Form */}
        <form onSubmit={handleAskQuestion} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your spending, credentials, invoices..."
            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            disabled={answering}
          />
          <button
            type="submit"
            disabled={!question.trim() || answering}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {answering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Thinking...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Ask</span>
              </>
            )}
          </button>
        </form>

        {/* Suggested Questions */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'What are my top spending categories?',
              'Which credentials need review?',
              'How can I reduce costs?',
              'Show me pending invoices',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuestion(suggestion)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
