import React, { useState } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, Lock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = "http://127.0.0.1:8000";

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // États Upload
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // --- 1. Gestion du Login ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const res = await axios.post(`${API_URL}/admin/login`, { password: password });
        if (res.data.success) {
            setIsAuthenticated(true);
            setLoginError('');
        }
    } catch (err) {
        setLoginError("Mot de passe incorrect.");
    }
  };

  // --- 2. Gestion de l'Upload ---
  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadStatus({ type: 'info', msg: 'Envoi...' });
      const response = await axios.post(`${API_URL}/admin/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.status === 'success') {
        setUploadStatus({ type: 'success', msg: 'Mise à jour réussie !' });
      }
    } catch (err) {
      setUploadStatus({ type: 'error', msg: "Erreur lors de l'envoi." });
    }
  };

  // --- Affichage : Mode Login ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
            <Link to="/" className="text-gray-400 text-sm hover:text-white flex items-center gap-1 mb-6"><ArrowLeft className="w-4 h-4"/> Retour au site</Link>
            
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Lock className="text-yellow-500"/> Accès Restreint
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <input 
                    type="password" 
                    placeholder="Mot de passe admin"
                    className="w-full p-3 bg-gray-700 text-white rounded border border-gray-600 focus:border-yellow-500 focus:outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 rounded transition">
                    Se connecter
                </button>
            </form>
            {loginError && <p className="text-red-400 mt-4 text-center">{loginError}</p>}
        </div>
      </div>
    );
  }

  // --- Affichage : Mode Admin (Connecté) ---
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-2"><Upload className="text-yellow-500"/> Back Office</h1>
                <button onClick={() => setIsAuthenticated(false)} className="text-sm text-gray-400 hover:text-white">Se déconnecter</button>
            </div>

            <div className="bg-gray-800 p-8 rounded-xl border border-gray-700">
                <p className="mb-6 text-gray-300">Uploader le fichier NREL (.xlsx ou .csv) pour mettre à jour la base de données.</p>
                
                <div className="flex gap-4 items-center">
                    <input type="file" onChange={(e) => setFile(e.target.files[0])} className="text-gray-400" accept=".csv, .xlsx" />
                    <button onClick={handleUpload} disabled={!file} className="bg-yellow-500 text-gray-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 disabled:opacity-50">
                        Mettre à jour
                    </button>
                </div>

                {uploadStatus && (
                    <div className={`mt-6 p-4 rounded ${uploadStatus.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                        {uploadStatus.type === 'success' && <CheckCircle className="inline w-5 h-5 mr-2"/>}
                        {uploadStatus.msg}
                    </div>
                )}
            </div>
            
            <div className="mt-8">
                <Link to="/" className="text-blue-400 hover:underline flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4"/> Retour à la recherche
                </Link>
            </div>
        </div>
    </div>
  );
}

export default AdminPage;