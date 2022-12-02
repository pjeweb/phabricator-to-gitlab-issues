#!/usr/bin/env ts-node-esm
import * as dotenv from "dotenv";
import YAML from "yaml";
import { readFile } from "node:fs/promises";

import { phInit, phSearchTasks } from "./lib/phabricator-api.js";

import { glInit } from "./lib/gitlab-api.js";
import { endDb, initDb } from "./lib/phabricator-db.js";
import { addLabelsToProjects } from "./tasks/add-labels-to-projects.js";
import { addIssueBoardLists } from "./tasks/add-issue-board-lists.js";
import { migrateIssue } from "./tasks/migrate-issue.js";

dotenv.config();

const configSettings = YAML.parse(
  await readFile(process.env.CONFIG_FILE || "./config.yaml", {
    encoding: "utf-8",
  })
);

const defaultConfig = {
  defaultBoardName: "Development",
  searchParams: {
    limit: 100,
    // after, constraints, ...
  },
  projectMap: {},
  repoMap: {},
  defaultLabelsToAdd: {},
  nodeHtmlMarkdownOptions: {},
};

const config = {
  ...defaultConfig,
  ...configSettings,
};

const projectMap = new Map<number, number>();
Object.keys(config.projectMap).forEach((key) => {
  projectMap.set(Number(key), Number(config.projectMap[key]));
});

phInit(process.env.PH_API_URL, process.env.PH_TOKEN);
glInit(process.env.GL_API_URL, process.env.GL_TOKEN);

await initDb();
endDb();

/*
type GlIssueNote = {
  body: string;
  created_at: string; // "2013-09-30T13:46:01Z"
};

type GlIssue = {
  issue: {
    assignee_username: any;
    created_at: string; // "2013-09-30T13:46:01Z"
    description: any;
    labels: any;
    title: any;
    weight: any;
  };
  notes: Array<GlIssueNote>;
};

type GlProject = {
  files: Map<string, any>;
  columns: Map<string, any>;
  issues: Map<string, GlIssue>;
};

const glData = new Map<string, GlProject>();

const makeProject = (): GlProject => ({
  files: new Map<string, any>(),
  columns: new Map<string, any>(),
  issues: new Map<string, any>(),
});
 */

if (process.env.ADD_LABELS !== "false") {
  await addLabelsToProjects(config, projectMap);
}

if (process.env.EXPORT_ISSUES !== "false") {
  const searchParams: any = {
    "attachments[subscribers]": "1",
    "attachments[projects]": "1",
    "attachments[columns]": "1",
    ...config.searchParams,
  };

  const data = await phSearchTasks(searchParams);
  const limit = config.searchParams.limit || 100;
  if (data.length >= limit) {
    console.info(
      "NOTE: Limit reached, search for the next batch after:",
      data[data.length - 1].id
    );
  }

  let createdIssues = {};
  for (const result of data) {
    const createdIssuesForIssue = await migrateIssue(
      config,
      projectMap,
      result
    );
    createdIssues = { ...createdIssues, ...createdIssuesForIssue };
  }

  if (process.env.ADD_LISTS !== "false") {
    await addIssueBoardLists(config, createdIssues);
  }
}
