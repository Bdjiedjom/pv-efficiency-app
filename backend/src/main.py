from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import os
import re  # Important pour neutraliser les caractères spéciaux
from thefuzz import process

app = FastAPI(title="API Solar Cells Efficiency Smart")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "nrel_data.csv"
global_df = None

FR_TO_EN_MAPPING = {
    "silicium": "Silicon",
    "monocristallin": "Single crystal",
    "polycristallin": "Multicrystalline",
    "couche mince": "Thin-Film",
    "perovskite": "Perovskite",
    "organique": "Organic",
    "colorant": "Dye",
    "cellule": "Cell",
    "tandem": "Tandem",
    "hétérojonction": "Heterojunction",
    "amorphe": "Amorphous",
    "gallium (gaas)": "GaAs",
    "gallium": "GaAs",
    "gaas": "GaAs",
    "concentration": "Concentrator",
    "cigs": "CIGS",
    "cdte": "CdTe",
    "quantum dot": "Quantum Dot"
}

class LoginRequest(BaseModel):
    password: str

def load_data():
    global global_df
    if os.path.exists(DB_FILE):
        try:
            df = pd.read_csv(DB_FILE)
            df['Measurement Date'] = pd.to_datetime(df['Measurement Date'], errors='coerce')
            
            # On remplit les vides avec du texte vide pour éviter les erreurs NaN
            cols_text = ['Eff. Chart Cell Type', 'Detailed description', 'Eff. Chart Material Class', 'Group(s)']
            for col in cols_text:
                if col in df.columns:
                    df[col] = df[col].fillna('').astype(str) # Force le texte
            
            # Force numérique
            df['Combined efficiency (%)'] = pd.to_numeric(df['Combined efficiency (%)'], errors='coerce')
            
            global_df = df
            print(f"✅ Données chargées : {len(global_df)} lignes.")
        except Exception as e:
            print(f"❌ Erreur CRITIQUE au chargement : {e}")
            global_df = pd.DataFrame()
    else:
        print("⚠️ Fichier introuvable.")
        global_df = pd.DataFrame()

@app.on_event("startup")
async def startup_event():
    load_data()

# --- LOGIQUE BLINDÉE ---
def smart_search_logic(user_keyword):
    print(f"🔍 Recherche pour : {user_keyword}") # LOG
    clean_keyword = user_keyword.lower().strip()
    search_term = FR_TO_EN_MAPPING.get(clean_keyword, user_keyword)

    # 1. Recherche EXACTE (Insensible à la casse)
    # C'est la plus fiable pour "Amorphous Si:H (stabilized)"
    mask_exact = global_df['Eff. Chart Cell Type'].str.lower() == search_term.lower()
    if mask_exact.any():
        print(f"   -> Match Exact trouvé ({mask_exact.sum()} résultats)")
        return global_df[mask_exact], search_term

    # 2. Recherche CONTAINS (Avec neutralisation des regex)
    # re.escape() transforme "Si:H (stab)" en "Si:H \(stab\)" pour que Pandas ne panique pas
    safe_term = re.escape(search_term)
    
    mask = (
        global_df['Eff. Chart Cell Type'].str.contains(safe_term, case=False, na=False) | 
        global_df['Detailed description'].str.contains(safe_term, case=False, na=False) |
        global_df['Eff. Chart Material Class'].str.contains(safe_term, case=False, na=False)
    )
    results = global_df[mask]

    if not results.empty:
        print(f"   -> Match 'Contains' trouvé ({len(results)} résultats)")
        return results, search_term

    # 3. Fuzzy (Rattrapage)
    print("   -> Tentative Fuzzy Search...")
    all_candidates = list(set(
        global_df['Eff. Chart Cell Type'].unique().tolist() + 
        global_df['Eff. Chart Material Class'].unique().tolist()
    ))
    all_candidates = [x for x in all_candidates if x]

    best_match, score = process.extractOne(search_term, all_candidates)
    
    if score >= 75:
        print(f"   -> Correction Fuzzy : {best_match} (Score {score})")
        mask_fuzzy = (
            (global_df['Eff. Chart Cell Type'] == best_match) | 
            (global_df['Eff. Chart Material Class'] == best_match)
        )
        return global_df[mask_fuzzy], best_match
    
    print("   -> Aucune correspondance.")
    return pd.DataFrame(), search_term

@app.get("/autocomplete")
def autocomplete(query: str):
    if not query or len(query) < 2: return []
    # Recherche simple et rapide
    safe_query = re.escape(query.strip()) # Sécurité
    mask = (
        global_df['Eff. Chart Cell Type'].str.contains(safe_query, case=False, na=False) |
        global_df['Eff. Chart Material Class'].str.contains(safe_query, case=False, na=False)
    )
    matches = global_df[mask]
    if matches.empty: return []
    
    suggestions = matches['Eff. Chart Cell Type'].unique().tolist()
    # On filtre les vides et on garde le top 8
    return [s for s in suggestions if s][:8]

@app.get("/suggestions")
def get_suggestions():
    return ["Perovskite", "Silicon", "CIGS", "CdTe", "Gallium (GaAs)", "Organic", "Tandem"]

@app.get("/search")
def search_efficiency(keyword: str):
    if global_df is None or global_df.empty:
        raise HTTPException(status_code=503, detail="Données non disponibles")

    try:
        filtered_df, used_term = smart_search_logic(keyword)

        if filtered_df.empty:
            return {"found": False, "message": f"Introuvable: {keyword}"}

        # Tri intelligent : Priorité au rendement, puis à la date
        # On ignore les rendements vides ou nuls pour le record
        valid_recs = filtered_df[filtered_df['Combined efficiency (%)'] > 0].copy()
        
        if valid_recs.empty:
             # Si tout est vide, on renvoie n'importe quoi pour éviter le crash
             latest_record = filtered_df.iloc[0]
        else:
             latest_record = valid_recs.sort_values(by=['Combined efficiency (%)', 'Measurement Date'], ascending=[False, False]).iloc[0]

        date_display = "Date inconnue"
        if pd.notnull(latest_record['Measurement Date']):
            date_display = latest_record['Measurement Date'].strftime('%Y-%m-%d')

        return {
        "found": True,
        "keyword": keyword,
        "data": {
            "efficiency": f"{latest_record['Combined efficiency (%)']}%",
            "update_date": date_display,
            "laboratory": str(latest_record['Group(s)']),
            "technology": str(latest_record['Eff. Chart Cell Type']),      # Nom précis (ex: Amorphous Si:H)
            "category": str(latest_record['Eff. Chart Material Class'])     # Nouvelle info : Famille (ex: Thin-Film)
        }
    }
    except Exception as e:
        print(f"❌ ERREUR SEARCH: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
def get_history_data(keyword: str):
    try:
        if global_df is None or global_df.empty: return []

        filtered_df, used_term = smart_search_logic(keyword)
        if filtered_df.empty: return []

        # 1. Identifier la technologie cible (Meilleur record)
        best_df = filtered_df.sort_values(by='Combined efficiency (%)', ascending=False)
        if best_df.empty: return []
        
        best_record = best_df.iloc[0]
        target_tech = best_record['Eff. Chart Cell Type']
        target_mat = best_record['Eff. Chart Material Class']

        print(f"   -> Cible Historique: Tech='{target_tech}' / Mat='{target_mat}'")

        # 2. Filtrage Strict
        if target_tech and len(str(target_tech)) > 1:
            strict_df = filtered_df[filtered_df['Eff. Chart Cell Type'] == target_tech].copy()
        else:
            strict_df = filtered_df[filtered_df['Eff. Chart Material Class'] == target_mat].copy()

        # 3. Nettoyage Données
        strict_df = strict_df.dropna(subset=['Measurement Date', 'Combined efficiency (%)'])
        strict_df = strict_df[strict_df['Combined efficiency (%)'] > 0.1] # Retire les 0.0%
        strict_df = strict_df.sort_values(by='Measurement Date', ascending=True)

        history_data = []
        for _, row in strict_df.iterrows():
            eff = row['Combined efficiency (%)']
            date_val = row['Measurement Date']
            
            # Sécurité JSON ultime : Vérifier chaque champ
            if pd.isna(eff) or pd.isna(date_val): continue
            
            history_data.append({
                "date": date_val.strftime('%Y-%m-%d'),
                "year": int(date_val.year),
                "efficiency": float(eff),
                "lab": str(row['Group(s)']) if row['Group(s)'] and str(row['Group(s)']) != 'nan' else "Labo inconnu"
            })
            
        print(f"   -> Historique généré : {len(history_data)} points.")
        return history_data

    except Exception as e:
        print(f"❌ ERREUR HISTORY: {str(e)}")
        # En cas d'erreur, on renvoie une liste vide pour ne pas casser le frontend
        return []

@app.post("/admin/login")
def login(data: LoginRequest):
    if data.password == "soleil123":
        return {"success": True, "token": "admin-access-granted"}
    raise HTTPException(status_code=401, detail="Mot de passe incorrect")

@app.post("/admin/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext == "csv": df_new = pd.read_csv(file.file)
        else: df_new = pd.read_excel(file.file)
        df_new.to_csv(DB_FILE, index=False)
        load_data()
        return {"status": "success", "message": "OK", "total_records": len(global_df)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)