# CrowRules Dreamscapes

**Where imagination becomes entertainment.**

A creative development platform for turning original dreams, ideas, stories, characters, and fictional worlds into television, film, animation, and other storytelling projects.

## Public pages
- `index.html` — cinematic homepage
- `submit.html` — authenticated creator submission intake
- `explore.html` — Dream Library
- `how-it-works.html` — development pipeline
- `development.html` — Project Development Space
- `project-room.html` — interactive sample project workspace
- `join-project.html` — creative collaboration interest form preview
- `pitch-room.html` — Pitch Room overview
- `premiere-room.html` — live public showcase of published productions
- `worlds.html` — World Builder
- `characters.html` — Character Forge
- `creators.html` — creative network
- `rights.html` — creator-first principles
- `creator-hub.html` — creator workspace preview
- `creator-dashboard.html` — authenticated creator dashboard for submissions, private messages, and project invitations
- `creator-portal.html` — personalized creator and team portal with private creator profiles, active project teams, invitations, assigned work, personal deadlines, and a private notification inbox for project invitations and new task/milestone assignments
- `project-dashboard.html` — authenticated cross-project production dashboard for progress, project health, overdue work, deadlines, milestones and assigned team workload
- `project-workspace.html` — private project workspace for story documents, immutable version snapshots, milestones, project team visibility, document discussions, activity timeline, secure media library, and production pipeline with task assignments and deadlines

## Restricted administration
- `admin-setup.html` — first-administrator setup and recovery instructions. The initial CrowRules administrator is now active.

- `admin.html` — authenticated Dreamscapes Control Room for submission review, project oversight, creator profiles, team assembly and invitations, Pitch Room decisions, and Premiere Room publishing.

## Supabase
Project: `cevylpnoexugwgygvtgu` (existing CrowRules Supabase project). The Control Room uses Supabase JS v2.118.0 and a publishable browser key only. It never includes a service-role or secret key.

Dreamscapes tables:
- `ds_submissions`
- `ds_submission_messages`
- `ds_workspace_documents`
- `ds_document_versions`
- `ds_workspace_milestones`
- `ds_document_comments`
- `ds_workspace_activity`
- `ds_media_assets`
- `ds_production_tasks`
- `ds_projects`
- `ds_project_members`
- `ds_pitch_reviews`
- `ds_activity_log`
- `ds_premieres`
- `ds_creator_profiles`
- `ds_email_preferences`
- `ds_email_deliveries`
- `ds_notifications`

All Dreamscapes tables have Row Level Security enabled. The `ds_creator_profiles` table stores creator display names, creative headlines, bios, skills, website and portfolio links, and collaboration availability. The `ds_notifications` table stores private user notifications for project invitations and new task or milestone assignments; RLS restricts reading and marking read to the recipient, while database triggers create notifications from authorized project actions. `ds_email_preferences` lets each creator turn off transactional email alerts while retaining in-app notifications. `ds_email_deliveries` is a server-only delivery ledger. A database trigger queues one email per notification; the `dreamscapes-email-worker` Edge Function runs every five minutes, sends through Brevo, retries known rejections with backoff, and marks uncertain provider outcomes for manual review rather than risking duplicate messages. `dreamscapes-email-unsubscribe` supports one-click opt-out. Worker authorization uses a random token stored in Supabase Vault and checked through a service-role-only database function. The administrator-only Team Assembly view compares creator skills, availability and active project commitments, supports a private session shortlist, and sends invitations through `ds_project_members`; creators must accept invitations before becoming active collaborators. Creators can insert and update only their own profile; profiles are visible to the owner, active collaborators sharing a project, and active CrowRules administrators. Workspace documents and milestones are restricted to project creators, active project members, and active CrowRules administrators. Document version snapshots are append-only through the client API; only authorized project participants can read or create them. Document discussions and project activity are restricted to project creators, active team members and active CrowRules administrators. Activity records are created by authenticated workspace actions. The `dreamscapes-media` Storage bucket is private, limited to 50 MB per file and approved document/image/audio/video MIME types; Storage and metadata policies restrict access to project creators, active project members and active CrowRules administrators. File previews/downloads use short-lived signed URLs. The production pipeline stores staged tasks with status, priority, due dates and assignments; RLS restricts task access to project creators, active members and active CrowRules administrators, and assignments can only target the project creator or active team members. The submission message thread is readable only by the submitting creator and active CrowRules administrators; creators can accept or decline only their own pending project invitations. Admin operations are gated by an active record in the existing `cr_admins` table. Creators must sign in or create an account. Submitters can insert/read only their own authenticated submissions; active administrators manage the private review queue. Project members can read only their own membership record and projects they are invited to or assigned to. Premiere Room listings are publicly readable only when status is `published`.

## Important launch notes
- Dreamscapes submission intake is connected to Supabase and requires an authenticated account. Email confirmation may be required depending on Auth settings. Collaborator interest forms remain preview-only. The intake has a honeypot but still needs CAPTCHA / broader abuse controls before major promotion.
- The Control Room is live against Supabase, but requires an existing CrowRules administrator account with an active `cr_admins` row.
- Team assignment requires an existing Supabase Auth user UUID.
- Publish only productions with confirmed permissions, approved credits, and cleared viewing links.
- Rights, compensation, ownership, and creator participation must be documented in separate written agreements.
- Before broad public promotion, verify email confirmation and Google OAuth end-to-end, and add CAPTCHA / rate-limiting protections to the intake. Project Workspace and Production Dashboard authentication, data loading, file uploads, task updates and milestone changes still require end-to-end browser testing.

## Preview
Open `index.html` or publish this repository with GitHub Pages.


### Email Operations Center
The restricted Admin Control Room includes a Brevo Email Operations Center. The `dreamscapes-email-admin` Edge Function validates the signed-in user against `cr_admins` (`is_active=true`) before returning delivery records, recipient email addresses, aggregate counts or allowing a failed delivery to be retried. Uncertain deliveries cannot be retried from the dashboard to avoid duplicate sends. The test-email action sends only to the currently signed-in administrator. The worker writes server-only run telemetry to `ds_email_worker_runs` for last-run health and processing counts. The delivery ledger and worker telemetry tables have RLS enabled and no anon/authenticated table grants.


### Brevo Delivery Intelligence
The `dreamscapes-brevo-webhook` Edge Function receives authenticated Brevo transactional events using a bearer token stored in Supabase Vault. The admin-only Email Operations Center can create or update the Brevo transactional webhook through the Brevo API; it subscribes to sent/request, delivered, hard/soft bounce, blocked, spam, invalid, deferred, click, opened, uniqueOpened and unsubscribed events. Events are idempotently stored in `ds_email_events`; delivery rows are enriched with delivered/bounced timestamps and open/click counts. `ds_email_suppressions` stores hard bounces, invalid addresses, blocks, spam complaints, unsubscribes and addresses with three or more soft bounces. The worker checks this list before every send. Suppressed recipients' pending/failed notifications are disabled and email preferences are switched off when the event can be linked to a delivery. Events, suppressions and delivery telemetry are server-only with RLS enabled and no anon/authenticated table grants. Open metrics may be affected by privacy proxies and are not a definitive measure of human readership.

Delivery reports include rolling 24-hour, 7-day and 30-day counts with bounce rates, plus breakdowns by notification type. Spam complaints are represented separately from bounces and immediately suppress future Dreamscapes email for the address.
