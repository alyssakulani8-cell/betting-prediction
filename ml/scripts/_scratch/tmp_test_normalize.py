import sqlite3, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.team_names import normalize, validate_coverage

conn = sqlite3.connect("../backend/prisma/betting.db")
cur = conn.execute("""
    SELECT DISTINCT ht.name AS t
    FROM matches m
    LEFT JOIN teams ht ON ht.id = m.home_team_id
    WHERE m.status = 'FINISHED' AND m.home_score IS NOT NULL
    UNION
    SELECT DISTINCT at.name AS t
    FROM matches m
    LEFT JOIN teams at ON at.id = m.away_team_id
    WHERE m.status = 'FINISHED' AND m.away_score IS NOT NULL
    ORDER BY t
""")
backend_names = [r[0] for r in cur.fetchall() if r[0]]
conn.close()

print("Backend team names and their normalized forms:")
for name in backend_names:
    canon = normalize(name)
    match = "SAME" if canon == name else "OK"
    print(f"  {match}: '{name}' -> '{canon}'")

result = validate_coverage(backend_names)
print(f"\nCoverage: {result['coverage']:.1f}% ({result['mapped']}/{result['total']})")
if result['unmapped']:
    print(f"Unmapped: {result['unmapped']}")
