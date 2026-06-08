from abc import ABC, abstractmethod
from typing import Dict, Optional, List
import numpy as np
import pandas as pd


class BasePredictor(ABC):
    @abstractmethod
    def fit(self, X_train: np.ndarray, y_train: np.ndarray, X_val: np.ndarray, y_val: np.ndarray) -> dict:
        ...

    @abstractmethod
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        ...

    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        ...

    @abstractmethod
    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        ...

    @abstractmethod
    def save(self, path: str):
        ...

    @abstractmethod
    def load(self, path: str):
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        ...
