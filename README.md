# FormsOCR Studio — SaaS v5.1 (Railway-ready)
Studio OCR par gabarit (ROI) prêt pour **SaaS** avec comptes, paliers d'abonnement, PDF multi-pages, et déploiement Docker/Railway.

## Démarrage local
```bash
cd backend
./run.sh         # macOS/Linux
# ou run.bat     # Windows
# ouvrir http://localhost:8000
```

## Docker
```bash
cd backend
docker compose up --build
# http://localhost:8000
```

## Railway
- Connecte ton repo GitHub → Railway → Deploy
- Utilise `backend/Dockerfile` (installe Tesseract + fra, et OpenCV headless)
- Variables d'env: `JWT_SECRET`, `DEFAULT_PLAN`
- Healthcheck: GET `/api/health`
