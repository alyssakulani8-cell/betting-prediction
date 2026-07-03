"""
Team name normalization for consistent ELO lookups across data sources.
Maps both backend DB names and football-data.co.uk CSV names to canonical keys.
"""

import re

# Direct mapping: backend name -> CSV/canonical name
BACKEND_TO_CANONICAL = {
    "Manchester City FC": "Man City",
    "Manchester United FC": "Man United",
    "Newcastle United FC": "Newcastle",
    "Leicester City FC": "Leicester",
    "Wolverhampton Wanderers FC": "Wolves",
    "Tottenham Hotspur FC": "Tottenham",
    "Brighton & Hove Albion FC": "Brighton",
    "West Ham United FC": "West Ham",
    "Crystal Palace FC": "Crystal Palace",
    "Aston Villa FC": "Aston Villa",
    "Nottingham Forest FC": "Nott'm Forest",
    "Everton FC": "Everton",
    "Fulham FC": "Fulham",
    "Brentford FC": "Brentford",
    "Ipswich Town FC": "Ipswich",
    "Southampton FC": "Southampton",
    "AFC Bournemouth": "Bournemouth",
    "Norwich City FC": "Norwich",
    "Watford FC": "Watford",
    "Burnley FC": "Burnley",
    "Leeds United FC": "Leeds",
    "Sheffield United FC": "Sheffield United",
    "Sheffield Wednesday FC": "Sheffield Wed",
    "Huddersfield Town FC": "Huddersfield",
    "Middlesbrough FC": "Middlesbrough",
    "Stoke City FC": "Stoke",
    "Swansea City FC": "Swansea",
    "Cardiff City FC": "Cardiff",
    "Bristol City FC": "Bristol City",
    "Coventry City FC": "Coventry",
    "Millwall FC": "Millwall",
    "Blackburn Rovers FC": "Blackburn",
    "Preston North End FC": "Preston",
    "Hull City FC": "Hull",
    "Luton Town FC": "Luton",
    "Queens Park Rangers FC": "QPR",
    "Rotherham United FC": "Rotherham",
    "Birmingham City FC": "Birmingham",
    "West Bromwich Albion FC": "West Brom",
    "Derby County FC": "Derby",
    "Reading FC": "Reading",
    "Wigan Athletic FC": "Wigan",
    "Blackpool FC": "Blackpool",
    "Sunderland AFC": "Sunderland",
    "Portsmouth FC": "Portsmouth",
    "Charlton Athletic FC": "Charlton",
    "Oxford United FC": "Oxford Utd",
    "Peterborough United FC": "Peterborough",
    "Wycombe Wanderers FC": "Wycombe",
    "Plymouth Argyle FC": "Plymouth",
    "Cheltenham Town FC": "Cheltenham",
    "Burton Albion FC": "Burton Albion",
    "Accrington Stanley FC": "Accrington",
    "Morecambe FC": "Morecambe",
    "Cambridge United FC": "Cambridge Utd",
    "Shrewsbury Town FC": "Shrewsbury",
    "Lincoln City FC": "Lincoln",
    "MK Dons": "Milton Keynes Dons",
    "Doncaster Rovers FC": "Doncaster",
    "Wimbledon": "AFC Wimbledon",
    "Fleetwood Town FC": "Fleetwood",
    "Gillingham FC": "Gillingham",
    "Crewe Alexandra FC": "Crewe",
    "Walsall FC": "Walsall",
    "Salford City FC": "Salford City",
    "Harrogate Town FC": "Harrogate",
    "Crawley Town FC": "Crawley",
    "Colchester United FC": "Colchester",
    "Carlisle United FC": "Carlisle",
    "Bradford City FC": "Bradford",
    "Barrow AFC": "Barrow",
    "Newport County AFC": "Newport Co",
    "Tranmere Rovers FC": "Tranmere",
    "Forest Green Rovers FC": "Forest Green",
    "Stockport County FC": "Stockport",
    "Chesterfield FC": "Chesterfield",
    "AFC Wimbledon": "AFC Wimbledon",
    "Milton Keynes Dons FC": "Milton Keynes Dons",
    "Exeter City FC": "Exeter",
    "Swindon Town FC": "Swindon",
    "Port Vale FC": "Port Vale",
    "Leyton Orient FC": "Leyton Orient",
    "Stevenage FC": "Stevenage",
    "Crawley Town FC": "Crawley",
    "Sutton United FC": "Sutton Utd",
    "Hartlepool United FC": "Hartlepool",
    "Rochdale AFC": "Rochdale",
    "Oldham Athletic AFC": "Oldham",
    "Scunthorpe United FC": "Scunthorpe",
    "FC Barcelona": "Barcelona",
    "Real Madrid CF": "Real Madrid",
    "Club Atlético de Madrid": "Ath Madrid",
    "Athletic Club": "Ath Bilbao",
    "Valencia CF": "Valencia",
    "Sevilla FC": "Sevilla",
    "Real Sociedad": "Real Sociedad",
    "Villarreal CF": "Villarreal",
    "Real Betis Balompié": "Real Betis",
    "CA Osasuna": "Osasuna",
    "Getafe CF": "Getafe",
    "RC Celta de Vigo": "Celta",
    "RCD Espanyol de Barcelona": "Espanol",
    "RCD Mallorca": "Mallorca",
    "UD Almería": "Almeria",
    "UD Las Palmas": "Las Palmas",
    "Deportivo Alavés": "Alaves",
    "Rayo Vallecano": "Rayo Vallecano",
    "FC Barcelona Atlètic": "Barcelona",
    "Granada CF": "Granada",
    "Elche CF": "Elche",
    "Levante UD": "Levante",
    "Girona FC": "Girona",
    "FC Bayern München": "Bayern Munich",
    "Borussia Dortmund": "Dortmund",
    "Bayer 04 Leverkusen": "Leverkusen",
    "RB Leipzig": "RB Leipzig",
    "Eintracht Frankfurt": "Ein Frankfurt",
    "VfL Wolfsburg": "Wolfsburg",
    "1. FC Union Berlin": "Union Berlin",
    "SC Freiburg": "Freiburg",
    "Borussia Mönchengladbach": "Borussia M'gladbach",
    "1. FC Heidenheim 1846": "Heidenheim",
    "FC Augsburg": "Augsburg",
    "VfB Stuttgart": "Stuttgart",
    "TSG 1899 Hoffenheim": "Hoffenheim",
    "SV Werder Bremen": "Werder Bremen",
    "1. FSV Mainz 05": "Mainz",
    "FC Köln": "Köln",
    "Hamburger SV": "Hamburg",
    "Hertha BSC": "Hertha",
    "Schalke 04": "Schalke 04",
    "FC St. Pauli 1910": "St Pauli",
    "AC Milan": "Milan",
    "FC Internazionale Milano": "Inter",
    "Juventus FC": "Juventus",
    "AS Roma": "Roma",
    "Atalanta BC": "Atalanta",
    "SSC Napoli": "Napoli",
    "SS Lazio": "Lazio",
    "ACF Fiorentina": "Fiorentina",
    "FC Bologna": "Bologna",
    "Torino FC": "Torino",
    "Udinese Calcio": "Udinese",
    "Empoli FC": "Empoli",
    "US Lecce": "Lecce",
    "AC Monza": "Monza",
    "US Sassuolo Calcio": "Sassuolo",
    "Genoa CFC": "Genoa",
    "Cagliari Calcio": "Cagliari",
    "Hellas Verona FC": "Verona",
    "Frosinone Calcio": "Frosinone",
    "Venezia FC": "Venezia",
    "Como 1907": "Como",
    "Parma Calcio 1913": "Parma",
    "Spezia Calcio": "Spezia",
    "Salernitana Calcio 1919": "Salernitana",
    "Benevento Calcio": "Benevento",
    "Crotone FC": "Crotone",
    "Paris Saint-Germain FC": "PSG",
    "Paris SG": "PSG",
    "Olympique de Marseille": "Marseille",
    "Olympique Lyonnais": "Lyon",
    "AS Monaco FC": "Monaco",
    "OGC Nice": "Nice",
    "RC Lens": "Lens",
    "Stade Rennais FC": "Rennes",
    "LOSC Lille": "Lille",
    "FC Nantes": "Nantes",
    "Montpellier Hérault SC": "Montpellier",
    "Stade de Reims": "Reims",
    "RC Strasbourg Alsace": "Strasbourg",
    "FC Toulouse": "Toulouse",
    "Stade Brestois 29": "Brest",
    "AC Ajaccio": "Ajaccio",
    "Angers SCO": "Angers",
    "FC Metz": "Metz",
    "Clermont Foot 63": "Clermont",
    "Le Havre AC": "Le Havre",
    "FC Lorient": "Lorient",
    "ES Troyes AC": "Troyes",
    "AS Saint-Étienne": "St Etienne",
    "AFC Ajax": "Ajax",
    "PSV": "PSV Eindhoven",
    "Feyenoord Rotterdam": "Feyenoord",
    "FC Twente": "Twente",
    "AZ Alkmaar": "AZ Alkmaar",
    "FC Utrecht": "Utrecht",
    "Sparta Rotterdam": "Sparta Rotterdam",
    "SC Heerenveen": "Heerenveen",
    "FC Groningen": "Groningen",
    "NEC Nijmegen": "NEC Nijmegen",
    "Go Ahead Eagles": "Go Ahead Eagles",
    "Fortuna Sittard": "Fortuna Sittard",
    "Heracles Almelo": "Heracles",
    "RKC Waalwijk": "RKC Waalwijk",
    "Willem II Tilburg": "Willem II",
    "PEC Zwolle": "PEC Zwolle",
    "SC Cambuur": "Cambuur",
    "FC Emmen": "FC Emmen",
    "FC Volendam": "Volendam",
    "FC Porto": "Porto",
    "SL Benfica": "Benfica",
    "Sporting CP": "Sporting CP",
    "SC Braga": "Braga",
    "Vitória SC": "Vitoria Guimaraes",
    "FC Famalicão": "Famalicao",
    "GD Estoril Praia": "Estoril",
    "FC Arouca": "Arouca",
    "FC Vizela": "Vizela",
    "Casa Pia AC": "Casa Pia",
    "Rio Ave FC": "Rio Ave",
    "CD Santa Clara": "Santa Clara",
    "FC Paços de Ferreira": "Pacos Ferreira",
    "Portimonense SC": "Portimonense",
    "CD Tondela": "Tondela",
    "CD Nacional": "Nacional",
    "CF Estrela da Amadora": "Estrela",
    "Moreirense FC": "Moreirense",
    "FC Basel 1893": "Basel",
    "BSC Young Boys": "Young Boys",
    "Celtic FC": "Celtic",
    "Rangers FC": "Rangers",
    "Club Brugge KV": "Club Brugge",
    "KRC Genk": "Genk",
    "RSC Anderlecht": "Anderlecht",
    "KAA Gent": "Gent",
    "Royal Antwerp FC": "Antwerp",
    "Standard de Liège": "Standard Liege",
    "Galatasaray SK": "Galatasaray",
    "Fenerbahçe SK": "Fenerbahce",
    "Besiktas JK": "Besiktas",
    "Trabzonspor AŞ": "Trabzonspor",
    "PAE Olympiakos SFP": "Olympiakos",
    "PAOK FC": "PAOK",
    "Panathinaikos FC": "Panathinaikos",
    "AEK Athens FC": "AEK Athens",
    "Aris Thessaloniki FC": "Aris",
    "Liverpool FC": "Liverpool",
    "Chelsea FC": "Chelsea",
    "Arsenal FC": "Arsenal",
    "Nottingham Forest FC": "Nott'm Forest",
}

# Reverse: canonical -> backend (for completeness)
CANONICAL_TO_BACKEND = {v: k for k, v in BACKEND_TO_CANONICAL.items()}

# Also map CSV names that are already in canonical form to themselves
# These are the names football-data.co.uk uses, which IS our canonical form
CSV_NAMES = set()


def normalize(team_name: str) -> str:
    """Normalize a team name to its canonical form for ELO lookups."""
    if not team_name:
        return team_name
    name = team_name.strip()

    # Direct lookup
    if name in BACKEND_TO_CANONICAL:
        return BACKEND_TO_CANONICAL[name]

    # Try case-insensitive lookup
    for backend, canonical in BACKEND_TO_CANONICAL.items():
        if name.lower() == backend.lower():
            return canonical

    name_lower = name.lower()

    # Strip common suffixes
    name = re.sub(r'\s+FC(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+AFC(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+CF(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+SC(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+BV(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+SV(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+SSC(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+SD(?:\s+\d+)?$', '', name, flags=re.IGNORECASE)

    # Strip common prefixes
    name = re.sub(r'^(?:1\.\s*|2\.\s*|3\.\s*)?(?:FC|FSV|SV|TSG|VfL|VfB|SC|SSV|TuS)\s+', '', name, flags=re.IGNORECASE)

    name = name.strip()

    # Handle specific well-known teams
    special_cases = {
        "manchester city": "Man City",
        "man city": "Man City",
        "mancity": "Man City",
        "manchester united": "Man United",
        "man united": "Man United",
        "manutd": "Man United",
        "newcastle united": "Newcastle",
        "newcastle": "Newcastle",
        "leicester city": "Leicester",
        "leicester": "Leicester",
        "wolverhampton": "Wolves",
        "wolverhampton wanderers": "Wolves",
        "wolves": "Wolves",
        "tottenham hotspur": "Tottenham",
        "tottenham": "Tottenham",
        "brighton & hove albion": "Brighton",
        "brighton": "Brighton",
        "west ham united": "West Ham",
        "west ham": "West Ham",
        "bayern munich": "Bayern Munich",
        "bayern münchen": "Bayern Munich",
        "borussia mönchengladbach": "Borussia M'gladbach",
        "borussia moenchengladbach": "Borussia M'gladbach",
        "eintracht frankfurt": "Ein Frankfurt",
        "1. fc union berlin": "Union Berlin",
        "union berlin": "Union Berlin",
        "1. fc heidenheim": "Heidenheim",
        "1. fsv mainz": "Mainz",
        "internazionale": "Inter",
        "inter milan": "Inter",
        "ac milan": "Milan",
        "psg": "PSG",
        "paris saint-germain": "PSG",
        "atlético madrid": "Ath Madrid",
        "atletico madrid": "Ath Madrid",
        "athletic bilbao": "Ath Bilbao",
        "athletic club": "Ath Bilbao",
        "psv eindhoven": "PSV Eindhoven",
        "ajax": "Ajax",
        "feyenoord": "Feyenoord",
        "sporting cp": "Sporting CP",
        "sporting lisbon": "Sporting CP",
        "benfica": "Benfica",
    }

    name_lower = name.lower().strip()
    if name_lower in special_cases:
        return special_cases[name_lower]

    # Also try the original full name lowercase
    original_lower = team_name.strip().lower()
    if original_lower in special_cases:
        return special_cases[original_lower]

    return name.strip()


def load_csv_names(csv_path: str = "data/raw/football-data-uk/all_matches.csv"):
    """Load CSV team names for reference (called once at startup)."""
    import pandas as pd
    try:
        df = pd.read_csv(csv_path, usecols=["home_team_name", "away_team_name"])
        CSV_NAMES.update(df["home_team_name"].unique())
        CSV_NAMES.update(df["away_team_name"].unique())
    except Exception:
        pass


def canonical_key(name: str) -> str:
    """Get the canonical key for ELO lookup. Returns normalized name."""
    return normalize(name)


def validate_coverage(backend_names: list[str]) -> dict:
    """Check what percentage of backend names have canonical mappings."""
    mapped = 0
    unmapped = []
    for name in backend_names:
        canon = normalize(name)
        if canon and canon != name:
            mapped += 1
        else:
            unmapped.append(name)
    return {
        "total": len(backend_names),
        "mapped": mapped,
        "unmapped": unmapped,
        "coverage": mapped / len(backend_names) * 100 if backend_names else 0,
    }
