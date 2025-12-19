import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Zap, Calendar, Activity, ChevronRight, Sun, Sparkles, TrendingUp } from 'lucide-react';
// IMPORT DU GRAPHIQUE
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]); // Pour stocker les données du graphe
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const [autoSuggestions, setAutoSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef(null);
  const [popularSuggestions, setPopularSuggestions] = useState([]);

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        const res = await axios.get(`${API_URL}/suggestions`);
        setPopularSuggestions(res.data);
      } catch (err) { setPopularSuggestions(["Perovskite", "Silicon", "CIGS"]); }
    };
    fetchPopular();

    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = async (e) => {
    const value = e.target.value;
    setKeyword(value);
    if (value.length >= 2) {
      try {
        const res = await axios.get(`${API_URL}/autocomplete`, { params: { query: value } });
        setAutoSuggestions(res.data);
        setShowSuggestions(true);
      } catch (err) { setAutoSuggestions([]); }
    } else { setShowSuggestions(false); }
  };

  const selectSuggestion = (term) => {
    setKeyword(term);
    setShowSuggestions(false);
    performSearch(term);
  };

  const performSearch = async (term) => {
    if (!term.trim()) return;
    setLoading(true); setError(''); setResult(null); setHistory([]); setHasSearched(true); setKeyword(term);
    setShowSuggestions(false);

    try {
      // 1. Appel principal (Dernier record)
      const response = await axios.get(`${API_URL}/search`, { params: { keyword: term } });
      
      if (response.data.found) {
        setResult(response.data.data);
        
        // 2. Appel secondaire (Historique pour le graphe)
        // On le fait seulement si on a trouvé un résultat
        const histResponse = await axios.get(`${API_URL}/history`, { params: { keyword: term } });
        setHistory(histResponse.data);
      } else {
        setError("Technologie introuvable.");
      }
    } catch (err) { setError("Le serveur ne répond pas."); } 
    finally { setLoading(false); }
  };

  // Composant personnalisé pour le Tooltip du graphique (Design sympa)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-xl text-sm">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-blue-600 font-semibold">
            Eff: {payload[0].value}%
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-[150px]">
            {payload[0].payload.lab}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      <div className={`flex-1 flex flex-col items-center transition-all duration-700 ease-in-out px-4 ${hasSearched ? 'pt-8 justify-start' : 'justify-center'}`}>
        
        {/* En-tête */}
        <div className={`text-center transition-all duration-500 ${hasSearched ? 'scale-75 mb-6' : 'mb-8'}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl shadow-lg mb-4 text-white">
            <Sun className="w-8 h-8 animate-pulse-slow" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">PV Efficiency</h1>
          {!hasSearched && <p className="text-slate-500 mt-2 font-medium">Moteur de recherche de précision NREL</p>}
        </div>

        {/* Barre de Recherche */}
        <div className="w-full max-w-lg relative z-20 group" ref={searchContainerRef}>
          <form onSubmit={(e) => { e.preventDefault(); performSearch(keyword); }} className="relative flex items-center bg-white rounded-full shadow-xl border border-slate-100 h-14 md:h-16 transition-all focus-within:ring-4 focus-within:ring-blue-100 z-20">
            <Search className="ml-5 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tapez 'Silicon', 'GaAs'..."
              className="flex-1 px-4 text-lg bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 h-full w-full rounded-full"
              value={keyword}
              onChange={handleInputChange}
              onFocus={() => keyword.length >= 2 && setShowSuggestions(true)}
            />
            <button type="submit" disabled={loading} className="mr-2 px-6 h-10 md:h-12 bg-slate-900 text-white font-medium rounded-full hover:bg-slate-800 transition-colors disabled:opacity-70 flex items-center gap-2">
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </form>

          {showSuggestions && autoSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-fade-in-up">
              <ul className="py-2">
                {autoSuggestions.map((suggestion, index) => (
                  <li key={index} onClick={() => selectSuggestion(suggestion)} className="px-6 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between group transition-colors">
                    <span className="text-slate-700 font-medium group-hover:text-blue-700">{suggestion}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!hasSearched && popularSuggestions.length > 0 && (
          <div className="mt-8 max-w-2xl w-full flex flex-col items-center animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3 text-sm text-slate-400 font-medium uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-yellow-500" /> Suggestions
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {popularSuggestions.map((s, i) => (
                <button key={i} onClick={() => performSearch(s)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-sm font-medium hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CONTAINER RÉSULTATS */}
        <div className="w-full max-w-2xl mt-8 px-2 pb-10 space-y-6">
          {error && <div className="bg-red-50 text-red-600 px-6 py-4 rounded-2xl text-center shadow-sm">{error}</div>}

          {/* 1. CARTE PRINCIPALE */}
            {result && !loading && (
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in-up">
                
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
                {/* Effet lumineux en arrière-plan */}
                <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                {/* --- NOUVEAU : Le Badge de Catégorie --- */}
                {result.category && (
                    <div className="inline-block px-3 py-1 mb-3 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-sm text-blue-100 text-xs font-bold uppercase tracking-widest">
                    {result.category}
                    </div>
                )}
                {/* -------------------------------------- */}

                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{result.technology}</h2>
                
                <div className="flex items-center gap-2 text-sm text-slate-300 mt-2">
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs font-mono uppercase text-slate-400">Lab</span>
                    <span className="font-medium text-white">{result.laboratory}</span>
                </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-bold text-slate-400 uppercase">Rendement Max</span>
                    </div>
                    <div className="text-6xl font-black text-slate-900 tracking-tight">{result.efficiency}</div>
                </div>
                
                <div className="flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
                    <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Date Record</span>
                    </div>
                    <p className="text-lg font-medium text-slate-700">{result.update_date}</p>
                    </div>
                </div>
                </div>
            </div>
            )}

          {/* 2. GRAPHIQUE ÉVOLUTIF */}
          {history.length > 1 && !loading && (
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Évolution Temporelle</h3>
                  <p className="text-sm text-slate-400">Progression du rendement (%) au fil des années</p>
                </div>
              </div>
              
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEff" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="year" 
                      tick={{fill: '#94a3b8', fontSize: 12}} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      tick={{fill: '#94a3b8', fontSize: 12}} 
                      axisLine={false} 
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="efficiency" 
                      stroke="#2563EB" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorEff)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="py-6 text-center text-slate-300 text-sm">&copy; {new Date().getFullYear()} Solar Metrics</footer>
    </div>
  );
}

export default SearchPage;