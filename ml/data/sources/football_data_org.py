import httpx
from typing import Optional
from datetime import datetime, timezone

from .base import DataSource, CacheMixin


class FootballDataOrg(DataSource, CacheMixin):
    """
    Data source for football-data.org API v4.
    Covers major European leagues with match results, standings, and team data.
    """

    LEAGUE_CODES = {
        "PL": "Premier League",
        "PD": "La Liga",
        "SA": "Serie A",
        "BL": "Bundesliga",
        "FL": "Ligue 1",
        "UCL": "Champions League",
        "UEL": "Europa League",
    }

    def __init__(self, api_key: str, base_url: str = "https://api.football-data.org/v4/"):
        DataSource.__init__(self)
        CacheMixin.__init__(self, cache_dir="data/cache/football-data", ttl_hours=3)
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={"X-Auth-Token": api_key},
            timeout=30,
        )

    def name(self) -> str:
        return "football-data.org"

    def fetch_matches(self, league: str, season: str, **kwargs) -> list[dict]:
        cache_key = self._cache_key("matches", league, season)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        code = self._resolve_league(league)
        date_from = kwargs.get("date_from", "")
        date_to = kwargs.get("date_to", "")

        params = {"competition": code, "season": season}
        if date_from:
            params["dateFrom"] = date_from
        if date_to:
            params["dateTo"] = date_to

        resp = self.client.get(f"/competitions/{code}/matches", params=params)
        resp.raise_for_status()
        data = resp.json()

        matches = []
        for m in data.get("matches", []):
            matches.append(self._parse_match(m))

        self._save_cache(cache_key, matches)
        return matches

    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        cache_key = self._cache_key("team_stats", team_id, season)
        cached = self._load_cache(cache_key)
        if cached and isinstance(cached, dict):
            return cached

        resp = self.client.get(f"/teams/{team_id}/matches", params={"season": season, "limit": 50})
        resp.raise_for_status()
        data = resp.json()

        stats = self._compute_team_stats(data.get("matches", []), team_id)
        self._save_cache(cache_key, stats)
        return stats

    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        cache_key = self._cache_key("h2h", team1_id, team2_id, str(limit))
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        resp = self.client.get(f"/teams/{team1_id}/matches", params={"limit": limit})
        resp.raise_for_status()
        data = resp.json()

        h2h = []
        for m in data.get("matches", []):
            teams = [m["homeTeam"]["id"], m["awayTeam"]["id"]]
            if str(team2_id) in [str(t) for t in teams]:
                h2h.append(self._parse_match(m))

        self._save_cache(cache_key, h2h)
        return h2h

    def _resolve_league(self, league: str) -> str:
        upper = league.upper()
        if upper in self.LEAGUE_CODES:
            return upper
        for code, name in self.LEAGUE_CODES.items():
            if name.lower().startswith(league.lower()):
                return code
        raise ValueError(f"Unknown league: {league}")

    def _parse_match(self, m: dict) -> dict:
        home = m.get("homeTeam", {})
        away = m.get("awayTeam", {})
        score = m.get("score", {})
        full_time = score.get("fullTime", {})
        half_time = score.get("halfTime", {})
        extras = score.get("extraTime", {})
        penalties = score.get("penalties", {})

        status = m.get("status", "")
        utc_date = m.get("utcDate", "")

        return {
            "match_id": str(m.get("id")),
            "competition": m.get("competition", {}).get("name", ""),
            "season": m.get("season", {}).get("startDate", "")[:4],
            "matchday": m.get("matchday"),
            "status": status,
            "utc_date": utc_date,
            "home_team_id": str(home.get("id", "")),
            "home_team_name": home.get("name", ""),
            "home_team_short": home.get("shortName", ""),
            "away_team_id": str(away.get("id", "")),
            "away_team_name": away.get("name", ""),
            "away_team_short": away.get("shortName", ""),
            "home_score": self._safe_int(full_time.get("home")),
            "away_score": self._safe_int(full_time.get("away")),
            "half_time_home": self._safe_int(half_time.get("home")),
            "half_time_away": self._safe_int(half_time.get("away")),
            "extra_time_home": self._safe_int(extras.get("home")),
            "extra_time_away": self._safe_int(extras.get("away")),
            "penalties_home": self._safe_int(penalties.get("home")),
            "penalties_away": self._safe_int(penalties.get("away")),
            "winner": m.get("score", {}).get("winner"),
            "duration": m.get("score", {}).get("duration", "REGULAR"),
        }

    def fetch_standings(self, league: str, season: str) -> list[dict]:
        code = self._resolve_league(league)
        resp = self.client.get(f"/competitions/{code}/standings", params={"season": season})
        resp.raise_for_status()
        data = resp.json()
        standings = []
        for table in data.get("standings", []):
            for entry in table.get("table", []):
                team = entry.get("team", {})
                standings.append({
                    "position": entry.get("position"),
                    "team_id": str(team.get("id", "")),
                    "team_name": team.get("name", ""),
                    "played_games": entry.get("playedGames"),
                    "won": entry.get("won"),
                    "draw": entry.get("draw"),
                    "lost": entry.get("lost"),
                    "points": entry.get("points"),
                    "goals_for": entry.get("goalsFor"),
                    "goals_against": entry.get("goalsAgainst"),
                    "goal_difference": entry.get("goalDifference"),
                    "form": entry.get("form", ""),
                })
        return standings

    @staticmethod
    def _safe_int(val) -> Optional[int]:
        return int(val) if val is not None else None

    @staticmethod
    def _compute_team_stats(matches: list[dict], team_id: str) -> dict:
        total = len(matches)
        wins = draws = losses = 0
        goals_for = goals_against = 0
        for m in matches:
            is_home = str(m.get("homeTeam", {}).get("id")) == team_id
            gf = m.get("score", {}).get("fullTime", {}).get("home" if is_home else "away", 0)
            ga = m.get("score", {}).get("fullTime", {}).get("away" if is_home else "home", 0)
            gf = int(gf) if gf else 0
            ga = int(ga) if ga else 0
            goals_for += gf
            goals_against += ga
            if gf > ga:
                wins += 1
            elif gf == ga:
                draws += 1
            else:
                losses += 1

        return {
            "total_matches": total,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "avg_goals_for": round(goals_for / total, 2) if total else 0,
            "avg_goals_against": round(goals_against / total, 2) if total else 0,
            "win_rate": round(wins / total, 3) if total else 0,
        }
