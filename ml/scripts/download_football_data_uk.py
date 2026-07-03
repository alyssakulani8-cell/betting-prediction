"""
Download historical match data from football-data.co.uk for multiple leagues
and seasons, then save to a unified CSV for training.

Usage:
    python scripts/download_football_data_uk.py
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from datetime import datetime

from data.orchestrator import DataOrchestrator


def main():
    print("=" * 60)
    print(f"FOOTBALL-DATA.CO.UK DOWNLOADER - {datetime.now().isoformat()}")
    print("=" * 60)

    orchestrator = DataOrchestrator()

    # Major European leagues with broadest coverage
    priority_leagues = ["E0", "E1", "SP1", "D1", "I1", "F1", "N1", "P1", "B1", "T1", "SC0", "G1"]

    # Secondary leagues (lower divisions)
    secondary_leagues = ["E2", "E3", "SP2", "D2", "I2", "F2", "SC1"]

    print(f"\nPriority leagues: {priority_leagues}")
    print(f"Secondary leagues: {secondary_leagues}")
    print(f"Season range: 2020 - 2025\n")

    # Download priority leagues
    print("--- PRIORITY LEAGUES ---")
    df_priority = orchestrator.fetch_football_uk_dataset(
        leagues=priority_leagues,
        start_season="2018",
        end_season="2025",
    )
    print(f"\nPriority leagues total: {len(df_priority)} matches")

    # Download secondary leagues (fewer seasons)
    print("\n--- SECONDARY LEAGUES ---")
    df_secondary = orchestrator.fetch_football_uk_dataset(
        leagues=secondary_leagues,
        start_season="2020",
        end_season="2025",
    )
    print(f"\nSecondary leagues total: {len(df_secondary)} matches")

    all_matches = pd.concat([df_priority, df_secondary], ignore_index=True)
    all_matches = all_matches.drop_duplicates(subset=["utc_date", "home_team_name", "away_team_name"])
    all_matches = all_matches.sort_values("utc_date").reset_index(drop=True)

    output_dir = Path("data/raw/football-data-uk")
    output_dir.mkdir(parents=True, exist_ok=True)

    csv_path = output_dir / "all_matches.csv"
    all_matches.to_csv(csv_path, index=False)

    from collections import Counter
    comp_counts = Counter(all_matches["competition"])
    print(f"\n{'=' * 60}")
    print(f"TOTAL: {len(all_matches)} matches saved to {csv_path}")
    print(f"\nCompetition breakdown:")
    for comp, count in sorted(comp_counts.items(), key=lambda x: -x[1]):
        print(f"  {comp}: {count}")
    print(f"\nDate range: {all_matches['utc_date'].min()} to {all_matches['utc_date'].max()}")
    print(f"Teams: {all_matches['home_team_name'].nunique()} (from home_team_name)")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
