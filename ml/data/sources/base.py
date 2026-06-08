from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import json
from pathlib import Path
from datetime import datetime, timedelta


class DataSource(ABC):
    @abstractmethod
    def fetch_matches(self, league: str, season: str, **kwargs) -> list[dict]:
        ...

    @abstractmethod
    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        ...

    @abstractmethod
    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        ...

    @abstractmethod
    def name(self) -> str:
        ...


class CacheMixin:
    def __init__(self, cache_dir: str = "data/cache", ttl_hours: int = 6):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(hours=ttl_hours)

    def _cache_key(self, prefix: str, *args) -> str:
        key = f"{prefix}_{'_'.join(str(a) for a in args)}"
        safe = "".join(c if c.isalnum() or c in "_-" else "_" for c in key)
        return str(self.cache_dir / f"{safe}.json")

    def _load_cache(self, key: str) -> Optional[list[dict]]:
        path = Path(key)
        if not path.exists():
            return None
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        if datetime.now() - mtime > self.ttl:
            return None
        with open(path) as f:
            return json.load(f)

    def _save_cache(self, key: str, data: list[dict]):
        with open(key, "w") as f:
            json.dump(data, f, default=str)
