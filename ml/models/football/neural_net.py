"""
Neural network model for football outcome prediction using TensorFlow/Keras.
Deep learning captures non-linear interactions between features.
"""

from typing import Dict, Optional
import numpy as np
import tensorflow as tf
from tensorflow import keras
from ..base import BasePredictor


class FootballNeuralNet(BasePredictor):
    def __init__(self, input_dim: int, params: Optional[Dict] = None):
        self.input_dim = input_dim
        self.params = params or {
            "hidden_layers": [256, 128, 64],
            "dropout": 0.3,
            "learning_rate": 0.001,
            "batch_size": 64,
            "epochs": 300,
            "patience": 30,
        }
        self.model: Optional[keras.Model] = None
        self.history: Optional[keras.callbacks.History] = None
        self.feature_names: list[str] = []

    @property
    def name(self) -> str:
        return "neural_net_football"

    def _build(self):
        inputs = keras.Input(shape=(self.input_dim,))
        x = inputs
        for units in self.params["hidden_layers"]:
            x = keras.layers.Dense(units, activation="relu")(x)
            x = keras.layers.BatchNormalization()(x)
            x = keras.layers.Dropout(self.params["dropout"])(x)
        outputs = keras.layers.Dense(3, activation="softmax")(x)

        model = keras.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=self.params["learning_rate"]),
            loss="sparse_categorical_crossentropy",
            metrics=["accuracy"],
        )
        self.model = model

    def fit(self, X_train, y_train, X_val, y_val) -> dict:
        self._build()

        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=self.params["patience"],
                restore_best_weights=True,
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss",
                factor=0.5,
                patience=10,
                min_lr=1e-6,
            ),
        ]

        self.history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=self.params["epochs"],
            batch_size=self.params["batch_size"],
            callbacks=callbacks,
            verbose=0,
        )

        y_pred = self.model.predict(X_val, verbose=0)
        val_acc = np.mean(y_pred.argmax(axis=1) == y_val)
        val_loss = self._log_loss(y_val, y_pred)

        return {"val_accuracy": float(val_acc), "val_log_loss": float(val_loss)}

    def predict_proba(self, X) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained")
        return self.model.predict(X, verbose=0)

    def predict(self, X) -> np.ndarray:
        return self.predict_proba(X).argmax(axis=1)

    def get_feature_importance(self) -> Optional[Dict[str, float]]:
        return None

    def save(self, path: str):
        if self.model:
            self.model.save(path)

    def load(self, path: str):
        self.model = keras.models.load_model(path)

    @staticmethod
    def _log_loss(y_true, y_pred, eps=1e-15):
        y_pred = np.clip(y_pred, eps, 1 - eps)
        return -np.mean(np.sum(np.eye(y_pred.shape[1])[y_true] * np.log(y_pred), axis=1))
