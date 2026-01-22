# Training Load Notes

The training load sparkline shows the per-activity "suffer score" for your
recent activities.

How it is computed:
- `suffer_score = (moving_time / 60) * (average_heartrate / 190)`
- The sparkline displays up to 28 of the most recent activities.
- Bars highlighted in the darker color are from the last 7 days.
- The "7d / 28d" value is the sum of the last 7 days and last 28 days scores.
