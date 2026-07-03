"""
Data source for football-data.co.uk - free CSV files with historical match data
for major European leagues. No API key required.

URL pattern: https://www.football-data.co.uk/mmz4281/{season_code}/{div}.csv
Season code: first 2 digits of start year + last 2 digits of end year (e.g., 2324 for 2023-24)
"""

import csv
import io
from typing import Optional, List
from datetime import datetime, timezone

import httpx

from .base import DataSource, CacheMixin


class FootballDataCoUK(DataSource, CacheMixin):
    LEAGUE_CODES = {
        "E0": "Premier League",
        "E1": "EFL Championship",
        "E2": "EFL League One",
        "E3": "EFL League Two",
        "EC": "National League",
        "SP1": "La Liga",
        "SP2": "La Liga 2",
        "D1": "Bundesliga",
        "D2": "Bundesliga 2",
        "I1": "Serie A",
        "I2": "Serie B",
        "F1": "Ligue 1",
        "F2": "Ligue 2",
        "N1": "Eredivisie",
        "B1": "Jupiler Pro League",
        "P1": "Primeira Liga",
        "SC0": "Scottish Premiership",
        "SC1": "Scottish Championship",
        "T1": "Süper Lig",
        "G1": "Super League Greece",
    }

    BASE_URL = "https://www.football-data.co.uk/mmz4281/{season_code}/{div}.csv"

    def __init__(self, cache_dir: str = "data/cache/football-data-uk", ttl_hours: int = 24):
        DataSource.__init__(self)
        CacheMixin.__init__(self, cache_dir=cache_dir, ttl_hours=ttl_hours)
        self._client = httpx.Client(timeout=30, follow_redirects=True)

    def name(self) -> str:
        return "football-data.co.uk"

    def fetch_matches(self, league: str, season: str, **kwargs) -> list[dict]:
        div = self._resolve_div(league)
        season_code = self._season_to_code(season)
        cache_key = self._cache_key("matches", div, season_code)
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        url = self.BASE_URL.format(season_code=season_code, div=div)
        resp = self._client.get(url)
        if resp.status_code == 404:
            print(f"  [football-data.co.uk] No data for {div}/{season_code} (404)")
            return []

        resp.raise_for_status()
        raw = resp.text
        matches = self._parse_csv(raw, div, season_code)
        self._save_cache(cache_key, matches)
        return matches

    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        return {}

    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        return []

    def fetch_seasons(self, div: str, start_season: str = "2020", end_season: str = "2025") -> list[dict]:
        """Convenience: download all seasons for a division."""
        all_matches = []
        for year in range(int(start_season), int(end_season) + 1):
            season = f"{year - 1}/{year}" if year > 2000 else str(year)
            code = self._season_to_code(season)
            try:
                matches = self.fetch_matches(div, season)
                all_matches.extend(matches)
                print(f"  [football-data.co.uk] {div} {season}: {len(matches)} matches")
            except Exception as e:
                print(f"  [football-data.co.uk] {div} {season}: SKIP ({e})")
        return all_matches

    def _parse_csv(self, raw: str, div: str, season_code: str) -> list[dict]:
        reader = csv.DictReader(io.StringIO(raw))
        competition = self.LEAGUE_CODES.get(div, div)
        season_year = self._code_to_season_year(season_code)

        matches = []
        for row in reader:
            date_str = (row.get("Date") or "").strip()
            if not date_str:
                continue
            utc_date = self._parse_date(date_str)
            if utc_date is None:
                continue

            home_team = (row.get("HomeTeam") or "").strip()
            away_team = (row.get("AwayTeam") or "").strip()
            if not home_team or not away_team:
                continue

            fthg = self._safe_int(row.get("FTHG"))
            ftag = self._safe_int(row.get("FTAG"))
            if fthg is None or ftag is None:
                continue

            ftr = (row.get("FTR") or "").strip()

            match = {
                "match_id": f"fduk_{div}_{season_code}_{len(matches)}",
                "external_id": f"fduk_{div}_{season_code}_{len(matches)}",
                "competition": competition,
                "season": season_year,
                "matchday": 0,
                "status": "FINISHED",
                "utc_date": utc_date,
                "home_team_id": home_team,
                "home_team_name": home_team,
                "home_team_short": home_team[:3].upper(),
                "away_team_id": away_team,
                "away_team_name": away_team,
                "away_team_short": away_team[:3].upper(),
                "home_score": fthg,
                "away_score": ftag,
                "half_time_home": self._safe_int(row.get("HTHG")),
                "half_time_away": self._safe_int(row.get("HTAG")),
            }

            closing_odds = self._extract_closing_odds(row)
            match.update(closing_odds)

            matches.append(match)

        return matches

    def _extract_closing_odds(self, row: dict) -> dict:
        """Extract closing odds, preferring Pinnacle, then Bet365."""
        odds = {}

        ps_h = self._safe_float(row.get("PSH"))
        ps_d = self._safe_float(row.get("PSD"))
        ps_a = self._safe_float(row.get("PSA"))
        b365_h = self._safe_float(row.get("B365H"))
        b365_d = self._safe_float(row.get("B365D"))
        b365_a = self._safe_float(row.get("B365A"))

        if ps_h and ps_d and ps_a:
            odds["odds_home"] = ps_h
            odds["odds_draw"] = ps_d
            odds["odds_away"] = ps_a
        elif b365_h and b365_d and b365_a:
            odds["odds_home"] = b365_h
            odds["odds_draw"] = b365_d
            odds["odds_away"] = b365_a

        bb_avg_h = self._safe_float(row.get("AvgH"))
        bb_avg_d = self._safe_float(row.get("AvgD"))
        bb_avg_a = self._safe_float(row.get("AvgA"))
        if bb_avg_h and bb_avg_d and bb_avg_a:
            odds["odds_home"] = bb_avg_h
            odds["odds_draw"] = bb_avg_d
            odds["odds_away"] = bb_avg_a

        return odds

    def _resolve_div(self, league: str) -> str:
        upper = league.upper()
        if upper in self.LEAGUE_CODES:
            return upper
        for code, name in self.LEAGUE_CODES.items():
            if name.lower().startswith(league.lower()):
                return code
        if league in ("EPL", "PREMIER", "PREMIER LEAGUE", "ENGLISH PREMIER LEAGUE"):
            return "E0"
        raise ValueError(f"Unknown league: {league}")

    def _season_to_code(self, season: str) -> str:
        if "/" in season:
            parts = season.split("/")
            start = parts[0].strip()
            end = parts[1].strip()
            if len(start) == 4 and len(end) == 4:
                return start[-2:] + end[-2:]
            elif len(start) == 2 and len(end) == 2:
                return start + end
        if season.isdigit() and len(season) == 4:
            year = int(season)
            return f"{(year - 1) % 100:02d}{year % 100:02d}"
        if season.isdigit() and len(season) == 2:
            return season + str(int(season) + 1)
        raise ValueError(f"Cannot parse season: {season}")

    def _code_to_season_year(self, code: str) -> str:
        if len(code) == 4 and code.isdigit():
            start = int("20" + code[:2])
            return f"{start}/{start + 1}"
        return code

    @staticmethod
    def _parse_date(date_str: str) -> Optional[str]:
        for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.replace(tzinfo=timezone.utc).isoformat()
            except (ValueError, IndexError):
                continue
        return None

    @staticmethod
    def _safe_int(val) -> Optional[int]:
        if val is None:
            return None
        try:
            return int(float(str(val).strip()))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _safe_float(val) -> Optional[float]:
        if val is None:
            return None
        try:
            return float(str(val).strip())
        except (ValueError, TypeError):
            return None
