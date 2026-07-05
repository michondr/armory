import os

# Prisma's URL carries a `?schema=public` param that libpq doesn't understand — strip it.
DATABASE_URL = os.environ["DATABASE_URL"].split("?")[0]
IMAGES_DIR = os.environ.get("IMAGES_DIR", "/data/images")
APP_ENCRYPTION_KEY = os.environ.get("APP_ENCRYPTION_KEY", "")
ARMORY_DOMAIN = os.environ.get("ARMORY_DOMAIN", "armory.michondr.space")

POLL_INTERVAL = float(os.environ.get("SCORER_POLL_INTERVAL", "3"))

# --- vision tunables (env-overridable so we can iterate without code changes) ---
MAX_DIM = int(os.environ.get("SCORER_MAX_DIM", "1600"))
HOLE_MIN_AREA = int(os.environ.get("SCORER_HOLE_MIN_AREA", "18"))
HOLE_MAX_AREA_FRAC = float(os.environ.get("SCORER_HOLE_MAX_AREA_FRAC", "0.02"))
HOLE_MIN_CIRCULARITY = float(os.environ.get("SCORER_HOLE_MIN_CIRCULARITY", "0.45"))
# Opening kernel (px) to erase thin ring lines while keeping filled hole blobs.
HOLE_OPEN_SIZE = int(os.environ.get("SCORER_HOLE_OPEN_SIZE", "5"))
