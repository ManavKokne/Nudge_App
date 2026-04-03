# Nudge

Nudge is a standalone pseudo social media platform that serves as the ingestion layer for a larger disaster intelligence system.

The app behaves like a community feed (Twitter/Reddit inspired) while also acting as a structured data pipeline into downstream alert analytics.

## Tech Stack

- Framework: Next.js App Router (JavaScript only)
- UI: Tailwind CSS with reusable ShadCN-style components (Radix UI primitives + utility wrappers)
- Icons: Lucide React
- Validation: Zod
- Auth: bcryptjs + signed JWT session in HTTP-only cookie
- NLP (mock mode): compromise
- Databases:
	- Social/Ingestion DB: users, posts, comments
	- Dashboard/Alerts DB: tweets

## Core Product Functionality

### 1. Authentication and Session Flow

- Users can sign up and log in from dedicated pages.
- Passwords are hashed with bcrypt before persistence.
- Successful auth writes a signed session token to an HTTP-only cookie.
- Unauthorized users are redirected to login for protected pages and API routes.

### 2. Responsive Social Feed

- Home page displays a card-based feed of posts with author identity, timestamps, extracted metadata, urgency tags, and engagement counts.
- Layout is responsive for desktop, tablet, and mobile.
- Top navigation includes:
	- Dynamic logo switching based on viewport
	- User avatar menu/drawer
	- Theme toggle (persisted)
	- Profile editing and logout

### 3. Profile and Avatar Management

- Each user gets a random avatar at signup from public/avatar/av_1.png to av_N.png.
- Edit Profile allows:
	- Email updates
	- Avatar changes via avatar grid picker
- Profile update also refreshes session cookie payload.

### 4. Post Creation and Engagement

- Create Post opens a modal with text input.
- Media upload is intentionally disabled and shown as roadmap placeholder.
- Every post stores raw content in social DB first.
- Users can:
	- Open full post details
	- Add comments
	- Give thumbs up/down feedback

### 5. Post Detail Experience

- Dedicated detail page for each post.
- Shows full post, urgency/request/location context, feedback counters, and chronological comment thread.
- Comment submission uses validated API input and relational DB writes.

## Processing Abstraction (PROCESSING_MODE)

Processing behavior is controlled by PROCESSING_MODE with two strict modes.

### Mock Mode (PROCESSING_MODE=mock)

End-to-end flow:

1. Persist raw post in social DB.
2. Run NLP extraction on post text to infer:
	 - location
	 - request_type
	 - cleaned alert content for dashboard row
3. Query disaster DB tweets table for similar alerts in last 1 hour by same location + request_type.
4. Compute urgency score and semantic label:

| Similar count in last 1h (before insert) | Score | Label |
| --- | --- | --- |
| 0 | 20 | non-urgent |
| 1 | 40 | potentially urgent |
| 2 | 60 | semi-urgent |
| 3 | 80 | semi-urgent |
| >= 4 | 100 | urgent |

5. Insert processed alert into disaster tweets table.
6. Store extracted metadata and score back into social posts table for traceability.

Dashboard urgency compatibility rule:

- Score 100 maps to urgent
- Score below 100 maps to non-urgent

### ML Mode (PROCESSING_MODE=ml)

End-to-end flow:

1. Persist raw post in social DB.
2. Skip NLP extraction/scoring/disaster writes.
3. External ML pipeline is expected to consume raw social data and become the only writer to dashboard tweets.

This one-writer model avoids duplicate or conflicting alert records.

## Example Mock Extraction

Input post:

Need immediate assistance in Bengaluru. Situation critical. BTM Layout 2nd Stage, Bengaluru, Karnataka. Medical.

Expected processed values:

- content: Need immediate assistance in Bengaluru. Situation critical.
- location: BTM Layout 2nd Stage, Bengaluru, Karnataka
- request_type: Medical
- urgency_label: non-urgent
- urgency_score: 20

## Application Routes

### Pages

- / -> session-aware redirect to /home or /login
- /login -> login form
- /signup -> signup form
- /home -> protected community feed
- /post/[id] -> protected post detail page

### API Endpoints

- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/session
- PUT /api/profile
- GET /api/posts
- POST /api/posts
- GET /api/posts/[id]
- GET /api/posts/[id]/comments
- POST /api/posts/[id]/comments
- POST /api/posts/[id]/feedback

All user input entry points are validated with Zod and return structured success/error payloads.

## Database Design

### Social DB

SQL script: db/social_schema.sql

Main tables:

- users
	- id, email, password_hash, avatar_url, created_at
- posts
	- id, user_id, content, processing_mode
	- extracted_location, extracted_request_type
	- urgency_score, urgency_label
	- upvotes, downvotes, created_at, updated_at
- comments
	- id, post_id, user_id, content, created_at

### Disaster DB

Compatibility guide: db/disaster_schema_expectations.sql

The app dynamically maps common alias columns (for example content/tweet/text/body and request_type/category/type) when writing alerts.

## Environment Configuration

Copy .env.example to .env.local and set:

- DATABASE_URL_SOCIAL
- DATABASE_URL_DISASTER
- SESSION_SECRET
- PROCESSING_MODE
- AVATAR_COUNT

Recommended defaults:

- PROCESSING_MODE=mock for end-to-end demo behavior
- AVATAR_COUNT=8 if using bundled avatar files

## Local Development

1. Install dependencies

	 npm install

2. Configure environment

	 copy .env.example .env.local

3. Provision social schema

	 run db/social_schema.sql against social database

4. Ensure disaster tweets table compatibility

	 validate columns using db/disaster_schema_expectations.sql guidance

5. Run development server

	 npm run dev

6. Open browser

	 http://localhost:3000

## Quality Checks

- npm run lint
- npm run build

## Project Structure (high-level)

- app: pages and route handlers
- components: UI primitives and feature components
- lib/auth: auth/session guards
- lib/db: DB clients and query modules
- lib/processing: mock/ml processing pipeline and NLP extraction
- lib/validation: Zod schemas
- db: SQL setup and compatibility docs
- public: logos and avatar assets

## Important Runtime Notes

- Post creation does not fail when downstream mock processing fails; raw social post remains stored and the API returns processingError for observability.
- Feedback counters are simple increments and do not currently deduplicate per user.
- Session is stateless JWT in cookie; server validates and can re-issue updated payload after profile edits.
