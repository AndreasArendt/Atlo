# Training Load Notes

The training load shows the training load score for your recent activities.

How it is computed:
- `score_window = (moving_time / 60) * (average_heartrate / max_heartrate)`
- `max_heartrate` comes from your Strava heart rate zones.
- The training load value is the ratio of the last 7 days score to the last 28 days score.
`load = score_7_days / score_28_days`

The scores are defined as followed:
|score | load |
|---|---|
|0.8–1.3| productive|
| >1.5 | elevated injury / overtraining risk|
| <0.7 | likely under-stimulating|

