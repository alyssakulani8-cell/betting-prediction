import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from config import config

def evaluate():
    model_path = config.model_path + "prediction_model.pkl"
    try:
        model = joblib.load(model_path)
    except FileNotFoundError:
        print("No trained model found. Run train_model.py first.")
        return

    np.random.seed(123)
    X_test = pd.DataFrame({
        "home_win_rate": np.random.uniform(0.2, 0.8, 200),
        "away_win_rate": np.random.uniform(0.2, 0.8, 200),
        "home_avg_goals": np.random.uniform(0.5, 3.0, 200),
        "away_avg_goals": np.random.uniform(0.5, 3.0, 200),
        "home_avg_conceded": np.random.uniform(0.5, 3.0, 200),
        "away_avg_conceded": np.random.uniform(0.5, 3.0, 200),
        "home_xg": np.random.uniform(0.5, 3.0, 200),
        "away_xg": np.random.uniform(0.5, 3.0, 200),
        "home_form_score": np.random.uniform(0, 1, 200),
        "away_form_score": np.random.uniform(0, 1, 200),
        "h2h_home_wins": np.random.randint(0, 10, 200),
        "h2h_away_wins": np.random.randint(0, 10, 200),
        "h2h_draws": np.random.randint(0, 5, 200),
    })
    y_test = np.random.choice([0, 1, 2], 200, p=[0.45, 0.25, 0.30])

    y_pred = model.predict(X_test)

    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=["Home Win", "Draw", "Away Win"]))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

if __name__ == "__main__":
    evaluate()
