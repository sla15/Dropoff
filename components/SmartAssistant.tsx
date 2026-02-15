import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, X, Map as MapIcon, Send, Loader2 } from 'lucide-react';
import { Theme } from '../types';
import { CONFIG } from '../config';

export const SmartAssistant = ({ onClose, theme }: { onClose: () => void, theme: Theme }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [groundingChunks, setGroundingChunks] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse('');
    setGroundingChunks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: CONFIG.GOOGLE_AI_API_KEY });
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      setResponse(result.text || "I found some information for you.");
      if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setGroundingChunks(result.candidates[0].groundingMetadata.groundingChunks);
      }
    } catch (error) {
      console.error(error);
      setResponse("I'm sorry, I couldn't reach the assistant right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const bg = theme === 'light' ? 'bg-white' : 'bg-[#1C1C1E]';
  const text = theme === 'light' ? 'text-black' : 'text-white';
  const inputBg = theme === 'light' ? 'bg-gray-100' : 'bg-[#2C2C2E]';

  return (
    <div className="fixed inset-0 z-[60] flex flex-col animate-slide-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`mt-auto h-[85%] w-full md:max-w-md md:mx-auto md:mb-6 md:rounded-[2rem] ${bg} rounded-t-[2rem] flex flex-col overflow-hidden shadow-2xl relative z-10`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#00D68F]" size={20} />
            <h2 className={`font-bold text-lg ${text}`}>Smart Assistant</h2>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full ${inputBg}`}><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {response ? (
            <div className="space-y-4 animate-scale-in">
              <div className={`p-4 rounded-2xl ${inputBg} ${text} text-sm leading-relaxed whitespace-pre-wrap`}>
                {response}
              </div>
              {groundingChunks.length > 0 && (
                <div className="space-y-3">
                  <h3 className={`text-xs font-bold uppercase ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>Sources from Google Maps</h3>
                  {groundingChunks.map((chunk, i) => {
                    if (chunk.maps?.title) {
                      return (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent`}>
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <MapIcon size={18} />
                          </div>
                          <div className="flex-1">
                            <div className={`font-bold text-sm ${text}`}>{chunk.maps.title}</div>
                            <div className="text-xs text-gray-500 truncate">{chunk.maps.uri}</div>
                          </div>
                        </div>
                      )
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full opacity-40">
              <Sparkles size={48} className="mb-4" />
              <p className="text-center text-sm">Ask me about places, directions, <br />or local recommendations.</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 pb-safe border-t border-gray-100 dark:border-gray-800">
          <div className={`flex items-center gap-2 p-2 pr-2 rounded-full ${inputBg}`}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ask anything..."
              className={`flex-1 bg-transparent px-4 py-2 outline-none ${text} placeholder:opacity-50`}
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query}
              className={`w-10 h-10 rounded-full bg-[#00D68F] flex items-center justify-center text-black disabled:opacity-50 transition-opacity`}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};