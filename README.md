# Migration script to migrate Phabricator Maniphest tasks to Gitlab CE issues

Uses Phabricator MySQL and Conduit API to export and Gitlab REST API to import.

## Project info

### Currently, supporting:

- migrating tasks to issues
- migrating labels for task priority, close reason and board names
- migrating boards
- migrating task attachments
- map projects manually (config.yaml)
- map phabricator repos to gitlab projects manually (config.yaml)

### TODO:

- Support for task comments
- Resolve references to tasks and task comments (This will probably need a second run to figure out the new Gitlab issue ids)
- Typescript usage is currently pretty minimal (horrible)

### Out of Scope:
- Support Gitlab Premium features
- Migrate anything other than listed above

## Getting started

### Prep

- Make sure Phabricator MySQL is accessible.
- Create API token in Phabricator and Gitlab.
- You may like to disable email notifications for the target Gitlab project.

### Run

- Requires `node` v18 and `pnpm`.
- Install deps using `pnpm install`.
- Copy `.env.example` to `.env` and adapt variables.
- Copy `config.example.yaml` to `config.yaml` and adapt config.
- Run migration using `pnpm start`.
