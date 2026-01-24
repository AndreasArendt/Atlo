# FAQ
## What cookies does ATLO store?
* Atlo stores a single, essential session cookie set by the backend to ensure requests belong to the same session.
* When you dismiss the cookie banner we record that preference in the browser's local storage so we don't show it again.

## What user related data does ATLO store?
We store only minimal data needed to operate the app:
- Session ID and API rate-limit state
- Strava access + refresh tokens (TTL 30 days)
- Strava athlete ID and username (if present)
- Heart-rate zones (used to compute max HR for training load)

We do **not** store activity history, GPS tracks, or HR time-series data.

## Does ATLO get access to my home address?
No, we do not store your home address. We request `read`, `activity:read`, and `profile:read_all` to access heart-rate zones for training load calculations, but we do not store full profile details like address or location.
For further information about scopes, please refer to the official Strava [docs](https://developers.strava.com/docs/authentication/).

## Why do you request `profile:read_all`?
We use it to read your heart-rate zones (from the Strava athlete zones endpoint), which lets us estimate max heart rate for training load.

## Do you read heart-rate data?
Yes. We read average heart rate and moving time from activities to calculate training load. This data is processed on the fly and is not stored.

## Does ATLO store my tracks?
No, we do not. We strictly follow the Strava policy to not store user-related activity data. Once the map is rendered the activity data is discarded.
