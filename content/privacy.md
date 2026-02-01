# Privacy Policy and Data Usage Declaration

**Last updated:** 25.01.2026

## 1. Introduction
This website (“the Application”) integrates with the Strava API to provide authenticated access to Strava services. The Application is designed according to the principles of data minimization, purpose limitation, and privacy by design.

## 2. Data Collected
Upon authentication with Strava, the Application stores only the following information:

- Session ID – used to manage authenticated user sessions
- API rate-limit state (per session) – used solely to comply with Strava API usage limits
- Strava access token – used to access Strava API endpoints on the user’s behalf
- Strava refresh token – used to renew the access token when required
- Strava athlete ID – used to associate a profile
- Strava username (if present) – stored as part of the Atlo profile
- Heart-rate zones – used to determine max heart rate for training load calculations
- Resting Heartrate – if user enters this manually

All tokens are stored with a time-to-live (TTL) of 30 days and are automatically invalidated and removed after expiration, the profile is deleted on "logout".

## 3. Data Explicitly Not Stored
The Application does **not** store:

- Full athlete profile information (name, email address, gender, location, profile images)
- Activity or performance history (including GPS tracks)
- Heart-rate time series or detailed stream data
- Historical usage or analytics data
- Any personal identifiers beyond what is strictly required for authentication

Any athlete information returned during the OAuth authentication flow beyond the fields above is discarded and never persisted.

## 4. Purpose and Legal Basis for Processing (GDPR / UK GDPR)

Personal data is processed solely for the following purposes and legal bases under Article 6(1) of the GDPR and UK GDPR:

| Purpose | Data Involved | Legal Basis |
|-------|--------------|-------------|
| Authentication and session management | Session ID, access token, refresh token | Article 6(1)(b) – performance of a contract |
| Token refresh and API access | Access token, refresh token | Article 6(1)(b) – performance of a contract |
| Compliance with Strava API rate limits | Rate-limit state | Article 6(1)(f) – legitimate interest |
| Training load calculation | Athlete ID, heart-rate zones, activity summary metrics (avg HR, moving time) | Article 6(1)(b) – performance of a contract |

No data is processed for marketing, profiling, analytics, or automated decision-making.

## 5. Data Retention
All stored data is retained only for as long as necessary to support authentication and session management. Tokens and session data are automatically deleted after 30 days or earlier if no longer required. The minimal Atlo profile (athlete ID, username, heart-rate zones) is retained until you log out or request deletion.

## 6. Data Sharing
No personal data is sold, shared, or transferred to third parties. Data is used exclusively within the scope of this Application and solely to communicate with Strava’s API.

## 7. User Rights (GDPR / UK GDPR)
Users have the right to:

- Access information about stored data
- Request deletion of stored session or token data
- Withdraw consent by revoking the Application’s access via Strava

Because the Application stores only minimal profile data and no activity history, requests are typically resolved by token invalidation and removal of the stored profile.

## 8. Security
Appropriate technical and organizational measures are applied to protect stored data against unauthorized access, disclosure, alteration, or destruction.

## 9. Changes to This Policy
This policy may be updated if data handling practices change. Any updates will continue to comply with applicable data protection laws.

## 10. Contact
For privacy-related inquiries:

**Email:** info@atlo.me
