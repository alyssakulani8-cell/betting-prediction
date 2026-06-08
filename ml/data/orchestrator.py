"""
Central data orchestrator that coordinates fetching from all API sources
and merges data into a unified training DataFrame.
"""

from typing import Optional, List
from datetime import datetime, timedelta
import pandas as pd

from config import config
from .sources.football_data_org import FootballDataOrg
from .sources.odds_api import OddsAPI
from .sources.basketball_api import BasketballAPI


class DataOrchestrator:
    def __init__(self):
        self.football = FootballDataOrg(
            api_key=config.football_api_key,
            base_url=config.football_base_url,
        ) if config.football_api_key else None

        self.odds = OddsAPI(
            api_key=config.odds_api_key,
            base_url=config.odds_base_url,
        ) if config.odds_api_key else None

        self.basketball = BasketballAPI(
            api_key=config.basketball_api_key,
            base_url=config.basketball_base_url,
        ) if config.basketball_api_key else None

    def fetch_football_dataset(
        self,
        leagues: Optional[List[str]] = None,
        seasons: Optional[List[str]] = None,
        include_odds: bool = True,
    ) -> pd.DataFrame:
        if not self.football:
            raise RuntimeError("Football API key not configured")

        leagues = leagues or ["PL", "PD", "SA", "BL", "FL"]
        seasons = seasons or [str(datetime.now().year - 1)]

        all_matches = []
        for league in leagues:
            for season in seasons:
                matches = self.football.fetch_matches(league, season)
                for m in matches:
                    if m["status"] == "FINISHED":
                        all_matches.append(m)

        df = pd.DataFrame(all_matches)
        if df.empty:
            return df

        df["utc_date"] = pd.to_datetime(df["utc_date"])
        df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
        df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
        df = df.dropna(subset=["home_score", "away_score"])

        if include_odds and self.odds:
            odds_data = self._fetch_odds_for_matches(df, "football")
            df = self._merge_odds(df, odds_data)

        df = df.sort_values("utc_date").reset_index(drop=True)
        return df

    def fetch_basketball_dataset(
        self,
        season: Optional[str] = None,
        include_odds: bool = True,
    ) -> pd.DataFrame:
        if not self.basketball:
            raise RuntimeError("Basketball API key not configured")

        season = season or str(datetime.now().year)
        games = self.basketball.fetch_matches("NBA", season)
        df = pd.DataFrame(games)

        if df.empty:
            return df

        df["date"] = pd.to_datetime(df["date"])
        df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
        df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
        df = df.dropna(subset=["home_score", "away_score"])

        if include_odds and self.odds:
            odds_data = self._fetch_odds_for_matches(df, "basketball")
            df = self._merge_odds(df, odds_data)

        df = df.sort_values("date").reset_index(drop=True)
        return df

    def _fetch_odds_for_matches(self, df: pd.DataFrame, sport: str) -> pd.DataFrame:
        if not self.odds:
            return pd.DataFrame()

        try:
            odds_matches = self.odds.fetch_matches(sport, "")
            return pd.DataFrame(odds_matches)
        except Exception:
            return pd.DataFrame()

    @staticmethod
    def _merge_odds(df: pd.DataFrame, odds_df: pd.DataFrame) -> pd.DataFrame:
        if odds_df.empty:
            return df
        if "home_team" not in odds_df.columns or "away_team" not in odds_df.columns:
            return df

        odds_df["home_team"] = odds_df["home_team"].str.lower().str.strip()
        odds_df["away_team"] = odds_df["away_team"].str.lower().str.strip()

        home_col = "home_team_name" if "home_team_name" in df.columns else "home_team"
        away_col = "away_team_name" if "away_team_name" in df.columns else "away_team"

        if home_col not in df.columns:
            return df

        df[home_col] = df[home_col].astype(str).str.lower().str.strip()
        df[away_col] = df[away_col].astype(str).str.lower().str.strip()

        merged = df.merge(
            odds_df[["home_team", "away_team", "odds_home", "odds_away", "odds_draw",
                      "spread_home", "spread_away", "total_over", "total_under",
                      "total_line", "bookmaker_count"]],
            left_on=[home_col, away_col],
            right_on=["home_team", "away_team"],
            how="left",
            suffixes=("", "_odds"),
        )
        merged = merged.drop(columns=["home_team", "away_team"], errors="ignore")
        return merged
