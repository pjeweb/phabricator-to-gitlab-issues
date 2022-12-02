import {
  glCreateIssueBoardList,
  glGetProjectBoards,
  glGetProjectLabels,
} from "../lib/gitlab-api.js";

const issueBoardsCreatedCache = new Set<string>();

async function createIssueListIfNotExists(
  config,
  projectId: number,
  boardId: number | null = null,
  name
) {
  const hash = `${projectId}///${boardId}///${name}`;
  if (!issueBoardsCreatedCache.has(hash)) {
    issueBoardsCreatedCache.add(hash);
    try {
      const boards = await glGetProjectBoards({ project: projectId });
      const labels = await glGetProjectLabels({ project: projectId });
      if (boards === null || labels === null) {
        return;
      }

      const defaultBoardIndex =
        boards.findIndex((board) => board.name === config.defaultBoardName) ||
        0;
      const board = boards[defaultBoardIndex].id;

      const labelId = labels.find(
        (label) => label.name.replace(/^~/, "") === name.replace(/^~/, "")
      )?.id;
      if (!labelId) {
        console.error("Could not find label id.", {
          project: projectId,
          board,
          name,
        });
        return;
      }

      const res = await glCreateIssueBoardList({
        project: projectId,
        board,
        label: labelId,
      });
      if (res.error) {
        console.error("Could not create issue board list on project. (A)", {
          project: projectId,
          board,
          name,
          error: res.error,
        });
      } else {
        console.info("Created issue board list for project!", {
          project: projectId,
          name,
        });
      }
    } catch (e) {
      console.error("Could not create issue board list on project.", {
        project: projectId,
        name,
        error: e,
      });
    }
  }
}

export async function addIssueBoardLists(config, createdIssues) {
  for (const projectId of Object.keys(createdIssues)) {
    const columns = [
      ...new Set(
        createdIssues[projectId]
          .map(({ column }) => column)
          .filter((column) => column && column !== "")
      ),
    ];

    for (const column of columns) {
      await createIssueListIfNotExists(config, Number(projectId), null, column);
    }
  }
}
