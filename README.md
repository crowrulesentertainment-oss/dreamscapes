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

## Restricted administration
- `admin-setup.html` — first-administrator setup and recovery instructions. The initial CrowRules administrator is now active.

- `admin.html` — authenticated Dreamscapes Control Room for submission review, project oversight, team assignments, Pitch Room decisions, and Premiere Room publishing.

## Supabase
Project: `cevylpnoexugwgygvtgu` (existing CrowRules Supabase project). The Control Room uses Supabase JS v2.118.0 and a publishable browser key only. It never includes a service-role or secret key.

Dreamscapes tables:
- `ds_submissions`
- `ds_submission_messages`
- `ds_projects`
- `ds_project_members`
- `ds_pitch_reviews`
- `ds_activity_log`
- `ds_premieres`

All seven Dreamscapes tables have Row Level Security enabled. The submission message thread is readable only by the submitting creator and active CrowRules administrators; creators can accept or decline only their own pending project invitations. Admin operations are gated by an active record in the existing `cr_admins` table. Creators must sign in or create an account. Submitters can insert/read only their own authenticated submissions; active administrators manage the private review queue. Project members can read only their own membership record and projects they are invited to or assigned to. Premiere Room listings are publicly readable only when status is `published`.

## Important launch notes
- Dreamscapes submission intake is connected to Supabase and requires an authenticated account. Email confirmation may be required depending on Auth settings. Collaborator interest forms remain preview-only. The intake has a honeypot but still needs CAPTCHA / broader abuse controls before major promotion.
- The Control Room is live against Supabase, but requires an existing CrowRules administrator account with an active `cr_admins` row.
- Team assignment requires an existing Supabase Auth user UUID.
- Publish only productions with confirmed permissions, approved credits, and cleared viewing links.
- Rights, compensation, ownership, and creator participation must be documented in separate written agreements.
- Before broad public promotion, verify email confirmation and Google OAuth end-to-end, and add CAPTCHA / rate-limiting protections to the intake.

## Preview
Open `index.html` or publish this repository with GitHub Pages.
