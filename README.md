# AI Precision Betting Prediction & Analysis

Full-stack AI-powered betting prediction platform with web and mobile apps.

## Architecture

```
betting-prediction/
├── web/          # React web application
├── mobile/       # React Native mobile application
├── backend/      # Node.js/Express API server
├── ml/           # Python ML models & notebooks
└── shared/       # Shared types, constants, utilities
```

## Tech Stack

- **Frontend (Web):** React, React Router, TailwindCSS
- **Mobile:** React Native, React Navigation
- **Backend:** Node.js, Express, PostgreSQL
- **ML/AI:** Python, scikit-learn, TensorFlow, FastAPI
- **Auth:** JWT, OAuth2
- **Deployment:** Docker, GitHub Actions

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 15+

### Installation

```bash
# Backend
cd backend && npm install

# Web
cd web && npm install

# Mobile
cd mobile && npm install

# ML
cd ml && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### Environment Variables
Copy `.env.example` to `.env` in each sub-project and fill in the values.

## License
MIT
