"""
Data source that reads match data directly from the backend Prisma SQLite database.
Provides real match data for training without requiring external API calls.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .base import DataSource, CacheMixin


class BackendDB(DataSource, CacheMixin):
    """
    Reads matches and teams from the backend's Prisma SQLite database.
    Covers all competitions that have been fetched into the backend.
    """

    def __init__(self, db_path: str, cache_dir: str = "data/cache/backend", ttl_hours: int = 6):
        DataSource.__init__(self)
        CacheMixin.__init__(self, cache_dir=cache_dir, ttl_hours=ttl_hours)
        self.db_path = Path(db_path)
        self._conn: Optional[sqlite3.Connection] = None

    def name(self) -> str:
        return "backend-db"

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            if not self.db_path.exists():
                raise FileNotFoundError(f"Backend database not found: {self.db_path}")
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def fetch_matches(self, league: Optional[str] = None, season: Optional[str] = None, **kwargs) -> list[dict]:
        cache_key = self._cache_key("matches", league or "all", season or "all")
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        conn = self._connect()
        query = """
            SELECT m.id, m.external_id, m.league_id, m.home_team_id, m.away_team_id,
                   m.home_score, m.away_score, m.status, m.kickoff, m.season, m.matchday,
                   ht.name AS home_team_name, at.name AS away_team_name,
                   l.name AS competition_name
            FROM matches m
            LEFT JOIN teams ht ON ht.id = m.home_team_id
            LEFT JOIN teams at ON at.id = m.away_team_id
            LEFT JOIN leagues l ON l.id = m.league_id
            WHERE m.status = 'FINISHED'
              AND m.home_score IS NOT NULL
              AND m.away_score IS NOT NULL
        """
        params = []
        if league:
            query += " AND l.id = ?"
            params.append(league)
        if season:
            query += " AND m.season = ?"
            params.append(season)

        query += " ORDER BY m.kickoff ASC"
        cur = conn.execute(query, params)
        rows = cur.fetchall()

        matches = []
        for row in rows:
            kickoff_ms = row["kickoff"]
            if isinstance(kickoff_ms, (int, float)):
                utc_date = datetime.fromtimestamp(kickoff_ms / 1000, tz=timezone.utc).isoformat()
            else:
                utc_date = str(kickoff_ms)

            matches.append({
                "match_id": row["id"],
                "external_id": row["external_id"] or "",
                "competition": row["competition_name"] or row["league_id"] or "",
                "season": row["season"] or "",
                "matchday": row["matchday"] or 0,
                "status": row["status"],
                "utc_date": utc_date,
                "home_team_id": row["home_team_id"] or "",
                "home_team_name": row["home_team_name"] or "",
                "home_team_short": (row["home_team_name"] or "")[:3].upper(),
                "away_team_id": row["away_team_id"] or "",
                "away_team_name": row["away_team_name"] or "",
                "away_team_short": (row["away_team_name"] or "")[:3].upper(),
                "home_score": row["home_score"],
                "away_score": row["away_score"],
            })

        self._save_cache(cache_key, matches)
        return matches

    def fetch_all_football(self) -> list[dict]:
        """Convenience: fetch all finished football matches."""
        cache_key = self._cache_key("all_football")
        cached = self._load_cache(cache_key)
        if cached:
            return cached

        conn = self._connect()
        cur = conn.execute("""
            SELECT m.id, m.external_id, m.league_id, m.home_team_id, m.away_team_id,
                   m.home_score, m.away_score, m.status, m.kickoff, m.season, m.matchday,
                   ht.name AS home_team_name, at.name AS away_team_name,
                   l.name AS competition_name
            FROM matches m
            LEFT JOIN teams ht ON ht.id = m.home_team_id
            LEFT JOIN teams at ON at.id = m.away_team_id
            LEFT JOIN leagues l ON l.id = m.league_id
            WHERE m.status = 'FINISHED'
              AND m.home_score IS NOT NULL
              AND m.away_score IS NOT NULL
              AND l.sport = 'football'
            ORDER BY m.kickoff ASC
        """)
        rows = cur.fetchall()
        matches = []
        for row in rows:
            kickoff_ms = row["kickoff"]
            if isinstance(kickoff_ms, (int, float)):
                utc_date = datetime.fromtimestamp(kickoff_ms / 1000, tz=timezone.utc).isoformat()
            else:
                utc_date = str(kickoff_ms)
            matches.append({
                "match_id": row["id"],
                "external_id": row["external_id"] or "",
                "competition": row["competition_name"] or row["league_id"] or "",
                "season": row["season"] or "",
                "matchday": row["matchday"] or 0,
                "status": row["status"],
                "utc_date": utc_date,
                "home_team_id": row["home_team_id"] or "",
                "home_team_name": row["home_team_name"] or "",
                "home_team_short": (row["home_team_name"] or "")[:3].upper(),
                "away_team_id": row["away_team_id"] or "",
                "away_team_name": row["away_team_name"] or "",
                "away_team_short": (row["away_team_name"] or "")[:3].upper(),
                "home_score": row["home_score"],
                "away_score": row["away_score"],
            })
        self._save_cache(cache_key, matches)
        return matches

    def fetch_team_stats(self, team_id: str, season: str) -> dict:
        matches = self.fetch_matches()
        relevant = [m for m in matches if m["home_team_id"] == team_id or m["away_team_id"] == team_id]
        total = len(relevant)
        wins = sum(1 for m in relevant
                   if (m["home_team_id"] == team_id and m["home_score"] > m["away_score"])
                   or (m["away_team_id"] == team_id and m["away_score"] > m["home_score"]))
        draws = sum(1 for m in relevant
                    if m["home_score"] == m["away_score"])
        losses = total - wins - draws
        gf = sum(m["home_score"] for m in relevant if m["home_team_id"] == team_id) + \
             sum(m["away_score"] for m in relevant if m["away_team_id"] == team_id)
        ga = sum(m["away_score"] for m in relevant if m["home_team_id"] == team_id) + \
             sum(m["home_score"] for m in relevant if m["away_team_id"] == team_id)
        return {
            "total_matches": total,
            "wins": wins, "draws": draws, "losses": losses,
            "goals_for": gf, "goals_against": ga,
            "avg_goals_for": round(gf / total, 2) if total else 0,
            "avg_goals_against": round(ga / total, 2) if total else 0,
            "win_rate": round(wins / total, 3) if total else 0,
        }

    def fetch_head_to_head(self, team1_id: str, team2_id: str, limit: int = 10) -> list[dict]:
        matches = self.fetch_matches()
        h2h = [m for m in matches
               if (m["home_team_id"] == team1_id and m["away_team_id"] == team2_id)
               or (m["home_team_id"] == team2_id and m["away_team_id"] == team1_id)]
        return h2h[:limit]

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None


def compute_elo_from_backend(db_path: str = None):
    """Load finished matches from backend DB as a DataFrame for ELO pre-computation."""
    import pandas as pd
    from config import config

    path = Path(db_path or config.backend_db_path)
    if not path.exists():
        print(f"[backend_db] DB not found: {path}")
        return None

    conn = sqlite3.connect(str(path))
    query = """
        SELECT m.id, m.home_team_id, m.away_team_id,
               m.home_score, m.away_score, m.kickoff,
               ht.name AS home_team_name, at.name AS away_team_name,
               l.name AS competition
        FROM matches m
        LEFT JOIN teams ht ON ht.id = m.home_team_id
        LEFT JOIN teams at ON at.id = m.away_team_id
        LEFT JOIN leagues l ON l.id = m.league_id
        WHERE m.status = 'FINISHED'
          AND m.home_score IS NOT NULL
          AND m.away_score IS NOT NULL
          AND l.sport = 'football'
        ORDER BY m.kickoff ASC
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    if len(df) == 0:
        return None

    df["utc_date"] = pd.to_datetime(df["kickoff"] / 1000, unit="s", utc=True)
    df["home_team_id"] = df["home_team_id"].astype(str)
    df["away_team_id"] = df["away_team_id"].astype(str)
    df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
    df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
    df = df.dropna(subset=["home_score", "away_score"]).reset_index(drop=True)

    print(f"[backend_db] Loaded {len(df)} finished matches for ELO pre-computation")
    return df
