# Training Load Notes

The training load shows the ratio between your short-term and long-term load using a TRIMP-based model.

How it is computed:
- **Step 1: Inputs**
  - `moving_time` (seconds) and `average_heartrate` per activity.
  - `max_heartrate` comes from your Strava heart rate zones.
  - `resting_heartrate = 60` (default).
- **Step 2: TRIMP per activity**
  - `duration_min = moving_time / 60`
  - `HR_ratio = (average_heartrate - resting_heartrate) / (max_heartrate - resting_heartrate)`
  - `TRIMP = duration_min * HR_ratio * exp(b * HR_ratio)`
  - `b = 1.92`
  - `HR_ratio` is clamped to `[0, 1.2]` to avoid outliers.
  - If `moving_time` or `average_heartrate` is missing/zero, TRIMP is treated as `0`.
- **Step 3: Daily aggregation**
  - TRIMP is aggregated by UTC day for the last **90 days**
- **Step 4: Exponential smoothing**
  - ATL (7d): `ATL_t = ATL_{t-1} + (Load_t - ATL_{t-1}) / 7`
  - CTL (42d): `CTL_t = CTL_{t-1} + (Load_t - CTL_{t-1}) / 42`
  - Smoothing starts at `0` on the first day in the 90-day window.
- **Step 5: Training load**
  - `load = ATL / CTL` (only shown if `CTL > 0`)

The scores are defined as followed:
|score | load |
|---|---|
|0.8–1.3| productive|
| >1.5 | elevated injury / overtraining risk|
| <0.7 | likely under-stimulating|

Notes:
- The activity list uses your selected date range, but training load always uses the last 90 days ending today for stability.
