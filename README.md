# Migration script to migrate Phabricator Maniphest tasks to Gitlab CE issues

Uses Phabricator MySQL and Conduit API to export and Gitlab REST API to import.

Currently supports:
- issues
- labels (for priority, close reason and board names)
- boards
- attachments
- map projects manually (config.yaml)
- map phabricator repos to gitlab projects manually (config.yaml)

TODO:
- Support for comments
- Resolve references to tasks and task comments (This will probably need a second run to figure out the new Gitlab issue ids)
- Typescript usage is currently pretty minimal (horrible)

## Prep

- Make sure Phabricator MySQL is accessible.
- Create API token in Phabricator and Gitlab.

## Run

- Requires `node` v18 and `pnpm`.
- Install deps using `pnpm install`.
- Copy `.env.example` to `.env` and adapt variables.
- Copy `config.example.yaml` to `config.yaml` and adapt config.
- Run migration using `pnpm start`.
