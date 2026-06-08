import httpx
from datetime import datetime, timezone
from typing import Optional

from .base import DataSource, CacheMixin


class OddsAPI(DataSource, CacheMixin):
    """
    Data source for The Odds API (the-odds-api.com).
    Provides real-time and historical betting odds from multiple bookmakers.
    Supports both football (soccer) and basketball.
    """

    SPORT_MAP = {
        "football": "soccer_epl,soccer_laliga,soccer_serie_a,soccer_bundesliga,soccer_ligue_one,soccer_uefa_champs_league",
        "basketball": "basketball_nba",
    }

    def __init__(self, api_key: str, base_url: str = "https://api.the-odds-api.com/v4/"):
        DataSource.__init__(self)
        CacheMixin.__init__(self, cache_dir="data/cache/odds", ttl_hours=1)
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=30)

    def name(self) -> str:
        return "the-odds-api"

    def fetch_matches(self, league: str, season: str, **kwargs) -> list[dict]:
        sport = self._resolve_sport(league)
        cache_key = self._cache_key("odds", sport)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        regions = kwargs.get("regions", "us,uk,eu")
        markets = kwargs.get("markets", "h2h,spreads,totals")

        params = {
            "apiKey": self.api_key,
            "regions": regions,
            "markets": markets,
            "oddsFormat": "decimal",
        }

        resp = self.client.get(f"{self.base_url}sports/{sport}/odds", params=params)
        resp.raise_for_status()
        data = resp.json()

        matches = []
        for event in data:
            matches.append(self._parse_event(event))

        self._save_cache(cache_key, matches)
        return matches

    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        return {}

    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        return []

    def fetch_upcoming_events(self, sport_key: str = "upcoming") -> list[dict]:
        cache_key = self._cache_key("upcoming", sport_key)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        params = {"apiKey": self.api_key}
        resp = self.client.get(f"{self.base_url}sports/{sport_key}/odds", params=params)
        resp.raise_for_status()
        data = resp.json()

        events = [self._parse_event(e) for e in data]
        self._save_cache(cache_key, events)
        return events

    def fetch_historical_odds(self, event_id: str) -> Optional[dict]:
        cache_key = self._cache_key("historical", event_id)
        cached = self._load_cache(cache_key)
        if cached and isinstance(cached, dict):
            return cached

        params = {"apiKey": self.api_key}
        resp = self.client.get(f"{self.base_url}events/{event_id}/odds", params=params)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        self._save_cache(cache_key, data)
        return data

    def _resolve_sport(self, league: str) -> str:
        league_lower = league.lower().replace(" ", "_")
        for category, sport_list in self.SPORT_MAP.items():
            if league_lower in sport_list or category in league_lower:
                return sport_list.split(",")[0]
        return "soccer_epl"

    def _parse_event(self, event: dict) -> dict:
        bookmakers = event.get("bookmakers", [])
        best_home = best_away = best_draw = None
        best_spread_home = best_spread_away = None
        best_over = best_under = None
        total_line = None

        for book in bookmakers:
            for market in book.get("markets", []):
                key = market.get("key", "")
                outcomes = market.get("outcomes", [])
                if key == "h2h":
                    for o in outcomes:
                        name = o.get("name", "").lower()
                        price = o.get("price")
                        if "home" in name or name == event.get("home_team", "").lower():
                            best_home = self._best_price(best_home, price)
                        elif "away" in name or name == event.get("away_team", "").lower():
                            best_away = self._best_price(best_away, price)
                        else:
                            best_draw = self._best_price(best_draw, price)
                elif key == "spreads":
                    for o in outcomes:
                        name = o.get("name", "").lower()
                        point = o.get("point")
                        price = o.get("price")
                        if "home" in name:
                            best_spread_home = (point, price)
                        else:
                            best_spread_away = (point, price)
                elif key == "totals":
                    total_line = outcomes[0].get("point") if outcomes else None
                    for o in outcomes:
                        name = o.get("name", "").lower()
                        price = o.get("price")
                        if "over" in name:
                            best_over = price
                        else:
                            best_under = price

        return {
            "event_id": event.get("id"),
            "sport_key": event.get("sport_key"),
            "sport_title": event.get("sport_title"),
            "commence_time": event.get("commence_time"),
            "home_team": event.get("home_team"),
            "away_team": event.get("away_team"),
            "odds_home": best_home,
            "odds_away": best_away,
            "odds_draw": best_draw,
            "spread_home": best_spread_home,
            "spread_away": best_spread_away,
            "total_over": best_over,
            "total_under": best_under,
            "total_line": total_line,
            "bookmaker_count": len(bookmakers),
        }

    @staticmethod
    def _best_price(current: Optional[float], new: float) -> float:
        return new if current is None else max(current, new)
