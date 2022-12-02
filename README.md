# Migration script to migrate Phabricator Maniphest tasks to Gitlab CE issues

## Prep

- Make sure Phabricator MySQL is accessible.
- Create API token in Phabricator and Gitlab.

## Run

- Requires node v18 and pnpm.
- Install deps using `pnpm install`.
- Copy `.env.example` to `.env` and adapt variables.
- Copy `config.example.yaml` to `config.yaml` and adapt config.
- Run migration using `pnpm start`.
