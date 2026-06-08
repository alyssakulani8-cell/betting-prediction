import httpx
from typing import Optional
from datetime import datetime

from .base import DataSource, CacheMixin


class BasketballAPI(DataSource, CacheMixin):
    """
    Data source for balldontlie.io API.
    Provides NBA stats including games, teams, players, and season averages.
    """

    def __init__(self, api_key: str, base_url: str = "https://api.balldontlie.io/v1/"):
        DataSource.__init__(self)
        CacheMixin.__init__(self, cache_dir="data/cache/basketball", ttl_hours=3)
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": api_key},
            timeout=30,
        )

    def name(self) -> str:
        return "balldontlie"

    def fetch_matches(self, league: str, season: str, **kwargs) -> list[dict]:
        cache_key = self._cache_key("games", season)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        season_year = self._resolve_season(season)
        per_page = kwargs.get("per_page", 100)

        all_games = []
        cursor = None
        while True:
            params = {
                "seasons[]": season_year,
                "per_page": min(per_page, 100),
            }
            if cursor:
                params["cursor"] = cursor

            resp = self.client.get("/games", params=params)
            resp.raise_for_status()
            data = resp.json()

            for game in data.get("data", []):
                all_games.append(self._parse_game(game))

            meta = data.get("meta", {})
            cursor = meta.get("next_cursor")
            if not cursor or len(all_games) >= (kwargs.get("max_games", 5000)):
                break

        self._save_cache(cache_key, all_games)
        return all_games

    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        cache_key = self._cache_key("team_stats", team_id, season)
        cached = self._load_cache(cache_key)
        if cached and isinstance(cached, dict):
            return cached

        season_year = self._resolve_season(season)
        resp = self.client.get(
            "/games",
            params={"team_ids[]": team_id, "seasons[]": season_year, "per_page": 82},
        )
        resp.raise_for_status()
        data = resp.json()

        stats = self._compute_team_avg(data.get("data", []), team_id)
        self._save_cache(cache_key, stats)
        return stats

    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        cache_key = self._cache_key("h2h", team1_id, team2_id, str(limit))
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        resp = self.client.get(
            "/games",
            params={
                "team_ids[]": [team1_id, team2_id],
                "per_page": limit * 2,
            },
        )
        resp.raise_for_status()
        data = resp.json()

        h2h = []
        for g in data.get("data", []):
            home_id = str(g.get("home_team", {}).get("id"))
            away_id = str(g.get("visitor_team", {}).get("id"))
            if (home_id == team1_id and away_id == team2_id) or \
               (home_id == team2_id and away_id == team1_id):
                h2h.append(self._parse_game(g))

        self._save_cache(cache_key, h2h)
        return h2h[:limit]

    def fetch_team_list(self) -> list[dict]:
        cache_key = self._cache_key("teams")
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        resp = self.client.get("/teams")
        resp.raise_for_status()
        data = resp.json()

        teams = []
        for t in data.get("data", []):
            teams.append({
                "id": str(t.get("id")),
                "name": t.get("full_name"),
                "abbreviation": t.get("abbreviation"),
                "city": t.get("city"),
                "conference": t.get("conference"),
                "division": t.get("division"),
            })

        self._save_cache(cache_key, teams)
        return teams

    def fetch_player_stats(self, game_id: str) -> list[dict]:
        cache_key = self._cache_key("player_stats", game_id)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        resp = self.client.get("/stats", params={"game_ids[]": game_id, "per_page": 30})
        resp.raise_for_status()
        data = resp.json()

        stats = []
        for s in data.get("data", []):
            player = s.get("player", {})
            team = s.get("team", {})
            stats.append({
                "game_id": game_id,
                "player_id": str(player.get("id")),
                "player_name": f"{player.get('first_name')} {player.get('last_name')}",
                "team_id": str(team.get("id")),
                "min": s.get("min"),
                "pts": s.get("pts"),
                "reb": s.get("reb"),
                "ast": s.get("ast"),
                "turnover": s.get("turnover"),
                "stl": s.get("stl"),
                "blk": s.get("blk"),
                "fg_pct": s.get("fg_pct"),
                "fg3_pct": s.get("fg3_pct"),
                "ft_pct": s.get("ft_pct"),
                "plus_minus": s.get("plus_minus"),
            })

        self._save_cache(cache_key, stats)
        return stats

    def _parse_game(self, game: dict) -> dict:
        home = game.get("home_team", {})
        away = game.get("visitor_team", {})

        home_score = game.get("home_team_score")
        away_score = game.get("visitor_team_score")

        return {
            "game_id": str(game.get("id")),
            "date": game.get("date"),
            "season": game.get("season"),
            "status": game.get("status"),
            "period": game.get("period"),
            "time_remaining": game.get("time"),
            "postseason": game.get("postseason"),
            "home_team_id": str(home.get("id", "")),
            "home_team_name": home.get("full_name", ""),
            "home_team_abbr": home.get("abbreviation", ""),
            "away_team_id": str(away.get("id", "")),
            "away_team_name": away.get("full_name", ""),
            "away_team_abbr": away.get("abbreviation", ""),
            "home_score": home_score,
            "away_score": away_score,
        }

    @staticmethod
    def _resolve_season(season: str) -> int:
        try:
            return int(season[:4])
        except ValueError:
            return datetime.now().year

    @staticmethod
    def _compute_team_avg(games: list[dict], team_id: str) -> dict:
        totals = {
            "pts": 0, "reb": 0, "ast": 0, "stl": 0, "blk": 0,
            "turnover": 0, "fg_pct": 0, "fg3_pct": 0, "ft_pct": 0,
        }
        count = 0
        for g in games:
            is_home = str(g.get("home_team", {}).get("id")) == team_id
            score_key = "home_team_score" if is_home else "visitor_team_score"
            opp_score_key = "visitor_team_score" if is_home else "home_team_score"
            pts = g.get(score_key) or 0
            opp_pts = g.get(opp_score_key) or 0
            totals["pts"] += pts
            totals["opp_pts"] = totals.get("opp_pts", 0) + opp_pts
            count += 1

        if count == 0:
            return {}

        return {
            "games_played": count,
            "avg_points_for": round(totals["pts"] / count, 1),
            "avg_points_against": round(totals.get("opp_pts", 0) / count, 1),
            "avg_margin": round((totals["pts"] - totals.get("opp_pts", 0)) / count, 1),
        }
