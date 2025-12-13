# FAQ
## What cookies does ATLO store?
* Atlo stores a single, essential session cookie set by the backend to ensure requests belong to the same session.
* When you dismiss the cookie banner we record that preference in the browser's local storage so we don't show it again.

## What user related data does ATLO store?
None - we do not store any user data. We even clear out the `athlete` information from the access token to ensure a minimal footprint.

## Does ATLO get access to my home address?
No, we do not. The Strava scopes requested are limited to `read` and `activity:read`, which keeps your privacy zones hidden.
For further information about scopes, please refer to the official Strava [docs](https://developers.strava.com/docs/authentication/).

## Does ATLO store my tracks?
No, we do not. We strictly follow the Strava policy to not store user-related activity data. Once the map is rendered the activity data is discarded.