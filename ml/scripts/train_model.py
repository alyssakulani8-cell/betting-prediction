import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, log_loss
from xgboost import XGBClassifier
import joblib
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from config import config

def generate_sample_data(n_samples: int = 1000) -> tuple:
    np.random.seed(42)
    X = pd.DataFrame({
        "home_win_rate": np.random.uniform(0.2, 0.8, n_samples),
        "away_win_rate": np.random.uniform(0.2, 0.8, n_samples),
        "home_avg_goals": np.random.uniform(0.5, 3.0, n_samples),
        "away_avg_goals": np.random.uniform(0.5, 3.0, n_samples),
        "home_avg_conceded": np.random.uniform(0.5, 3.0, n_samples),
        "away_avg_conceded": np.random.uniform(0.5, 3.0, n_samples),
        "home_xg": np.random.uniform(0.5, 3.0, n_samples),
        "away_xg": np.random.uniform(0.5, 3.0, n_samples),
        "home_form_score": np.random.uniform(0, 1, n_samples),
        "away_form_score": np.random.uniform(0, 1, n_samples),
        "h2h_home_wins": np.random.randint(0, 10, n_samples),
        "h2h_away_wins": np.random.randint(0, 10, n_samples),
        "h2h_draws": np.random.randint(0, 5, n_samples),
    })
    y = np.random.choice([0, 1, 2], n_samples, p=[0.45, 0.25, 0.30])
    return X, y

def train():
    print("Generating sample training data...")
    X, y = generate_sample_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("Training XGBoost model...")
    model = XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=3,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {accuracy:.4f}")

    model_path = config.model_path + "prediction_model.pkl"
    joblib.dump(model, model_path)
    print(f"Model saved to {model_path}")

if __name__ == "__main__":
    train()
