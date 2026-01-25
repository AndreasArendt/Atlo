# Training Load Notes

The training load shows the ratio between your short-term and long-term load using a TRIMP-based model.

How it is computed:
- **Step 1: Inputs**
  - `moving_time` and `average_heartrate` per activity.
  - `max_heartrate`, taken from your Strava profile.
  - `resting_heartrate` set to `60` as default currently.
- **Step 2: TRIMP per activity**
  - `HR_ratio = (average_heartrate - resting_heartrate) / (max_heartrate - resting_heartrate)`
  - `TRIMP = duration_min * HR_ratio * exp(b * HR_ratio)`
  - `b = 1.92` (currently)
- **Step 3: Daily aggregation**
  - TRIMP is aggregated by UTC day for the last **90 days**
- **Step 4: Exponential smoothing**
  - ATL (7d): `ATL_t = ATL_{t-1} + (TRIMP - ATL_{t-1}) / 7`
  - CTL (42d): `CTL_t = CTL_{t-1} + (TRIMP - CTL_{t-1}) / 42`
- **Step 5: Training load**
  - `training_load = ATL / CTL`

The scores are defined as followed:
|score | load |
|---|---|
|0.8–1.2| balanced|
| >1.2 | elevated injury / overtraining risk|
| <0.8 | likely under-stimulating|