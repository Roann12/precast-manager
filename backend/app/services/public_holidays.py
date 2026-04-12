from __future__ import annotations

from datetime import date
from functools import lru_cache

import holidays


@lru_cache(maxsize=8)
def _za_holidays_for_year(year: int):
    """
    Returns a mapping-like object of South Africa public holidays for the given year.

    Using LRU cache because planners can call working-day checks many times.
    """

    # Prefer explicit SouthAfrica class when available.
    cls = getattr(holidays, "SouthAfrica", None)
    if cls is not None:
        return cls(years=[year])

    # Fallback to country-based lookup.
    return holidays.country_holidays("ZA", years=[year])


def is_south_africa_public_holiday(d: date) -> bool:
    """True when `d` is a South Africa public holiday (includes observed/substitute days)."""
    return d in _za_holidays_for_year(d.year)

