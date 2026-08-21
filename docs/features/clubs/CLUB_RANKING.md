# Club ranking

Per-Club score is `(1.5 ln(1+likes) + 2 ln(1+comments) + 2.5 ln(1+redrops) + .5 ln(1+views)) × exp(-age_seconds/259200)`. Every signal must have `CLUB_INTERNAL` scope and match the Club's Drop.
