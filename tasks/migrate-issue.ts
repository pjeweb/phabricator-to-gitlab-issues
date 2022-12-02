import { phProjects, phUsers } from "../lib/phabricator-db.js";
import {
  phDownloadFile,
  phIdLookup,
  phRemarkupToHtml,
} from "../lib/phabricator-api.js";
import { lookup as lookupMimeType } from "mime-types";
import {
  glCreateComment,
  glCreateIssue,
  glUploadFile,
} from "../lib/gitlab-api.js";
import { NodeHtmlMarkdown } from "node-html-markdown";

export async function migrateIssue(
  config,
  projectMap,
  {
    id,
    fields: {
      status: { value: status },
      priority: { value: priority, subpriority, name: priorityName },
      name,
      description: { raw: descriptionRaw },
      dateCreated,
      dateModified,
      ownerOrdering,
      subtype,
      authorPHID,
      ownerPHID,
    },
    attachments: {
      subscribers: { subscriberPHIDS, viewerIsSubscribed = false },
      projects: { projectPHIDs },
      columns: { boards = {} },
    },
  }
) {
  const createdIssues = {};

  const nhm = new NodeHtmlMarkdown(config.nodeHtmlMarkdownOptions);
  const repoMap = new Map<string, string>();
  Object.keys(config.repoMap).forEach((key) => {
    repoMap.set(key, config.repoMap[key]);
  });

  let ccs = [];
  if (phUsers.has(authorPHID)) {
    ccs.push(phUsers.get(authorPHID).userName);
  }

  if (subscriberPHIDS?.length) {
    subscriberPHIDS.forEach((subscriberPHID) => {
      if (phUsers.has(subscriberPHID)) {
        ccs.push(phUsers.get(subscriberPHID).userName);
      }
    });
  }

  const labels = [];
  switch (priorityName) {
    case "Unbreak Now!":
      labels.push("Unbreak_Now");
      break;
    case "Needs Triage":
    case "High":
      labels.push("High");
      break;
    case "Normal":
      labels.push("Normal");
      break;
    case "Low":
      labels.push("Low");
      break;
    case "Wishlist":
      labels.push("Wishlist");
      break;
  }

  let commands = "";

  if (phUsers.has(ownerPHID)) {
    commands += "/assign @" + phUsers.get(ownerPHID).userName + " \n";
  }

  if (ccs.length) {
    commands += "/cc " + ccs.map((cc) => `@${cc}`).join(" ") + " \n";
  }

  switch (status) {
    case "resolved":
      labels.push("Resolved");
      commands += "/close \n";
      break;
    case "wontfix":
      labels.push("Wontfix");
      commands += "/close \n";
      break;
    case "invalid":
      labels.push("Invalid");
      commands += "/close \n";
      break;
    case "duplicate":
      labels.push("Duplicate");
      commands += "/close \n";
      break;
    case "open":
      // nothing to do
      break;
    default:
      console.error("Unknown status ", status);
  }

  const glTitle = `${name} (T${id})`.trim();
  let descRemarkup: string = descriptionRaw;
  //.replaceAll(/a/g, '');

  // Replace repo refs
  let repoRefs = [];
  descRemarkup = descRemarkup.replaceAll(
    /\{r([A-Z]+)([a-z\d]*)}?|\br([A-Z]+)([a-z\d]*)\b/g,
    (
      match,
      matchRepoWithDetails,
      matchRefWithDetails,
      matchRepoWithoutDetails,
      matchRefWithoutDetails
    ) => {
      const refId = repoRefs.length;
      const repoName = matchRepoWithDetails || matchRepoWithoutDetails;
      const gitRef = matchRefWithDetails || matchRefWithoutDetails;

      let markdown = repoName;
      if (repoName && repoMap.has(repoName)) {
        markdown = repoMap.get(repoName);
        if (gitRef) {
          markdown += "@" + gitRef;
        }
      } else {
        console.warn("Could not map repo ref. Add it to repoMap!", repoName);
        if (gitRef) {
          markdown += " " + gitRef;
        }
      }

      const replacement = `$$$REPO$REF$${refId}$$$`;
      repoRefs[refId] = {
        refId,
        replacement,
        markdown,
        match,
      };

      return replacement;
    }
  );

  let commentRefs = [];
  descRemarkup = descRemarkup.replaceAll(
    /\bT(\d+)#(\d+)\b/g,
    (match, matchTask, matchComment, offset) => {
      const taskId = parseInt(matchTask, 10);
      const commentId = parseInt(matchComment, 10);
      const refId = commentRefs.length;
      const replacement = `$$$COMMENT$REF$${refId}$$$`;

      commentRefs[refId] = {
        name: `T${taskId}`,
        taskId,
        commentId,
        offset,
        refId,
        replacement,
        match,
      };
      console.log("Found comment ref", taskId);
      return replacement;
    }
  );

  //let taskRefs = [];
  //descRemarkup = descRemarkup.replaceAll(
  //	/\{T\d+}?|\bT\d+\b/g,
  //	(match, offset) => {
  //		const withDetails = match.startsWith("{");
  //		const taskId = parseInt(match.replaceAll(/[T{}]/g, ""), 10);
  //		const refId = taskRefs.length;
  //		const replacement = `$$$TASK$REF$${refId}$$$`;
  //
  //		taskRefs[refId] = {
  //			name: `T${taskId}`,
  //			taskId,
  //			withDetails,
  //			offset,
  //			refId,
  //			replacement,
  //			match,
  //		};
  //		console.log("Found task ref", taskId);
  //		return replacement;
  //	}
  //);

  let fileRefs = [];
  descRemarkup = descRemarkup.replaceAll(
    /\{F\d+}?|\bF\d+\b/g,
    (match, offset) => {
      const withDetails = match.startsWith("{");
      const fileId = parseInt(match.replaceAll(/[F{}]/g, ""), 10);
      const refId = fileRefs.length;
      const replacement = `$$$FILE$REF$${refId}$$$`;

      fileRefs[refId] = {
        name: `F${fileId}`,
        fileId,
        withDetails,
        offset,
        refId,
        replacement,
        match,
      };
      console.log("Found file ref", fileId);
      return replacement;
    }
  );

  await Promise.all([
    //...[...taskRefs, ...commentRefs].map(async (ref, i) => {
    //	try {
    //		const res = await phIdLookup(ref.name);
    //		if (!res) {
    //			throw Error("Invalid PHID");
    //		}
    //	} catch (e) {
    //		console.info("Invalid task ref", ref.name);
    //		// Revert to old text
    //		descRemarkup = descRemarkup.replace(
    //			ref.replacement,
    //			ref.match
    //		);
    //		delete taskRefs[i];
    //	}
    //}),
    ...fileRefs.map(async (ref, i) => {
      try {
        const res = await phIdLookup(ref.name);
        if (!res) {
          throw Error("Invalid PHID");
        }

        const { phid, name, fullName } = res;

        const fileName = fullName.replace(new RegExp(`^${name}: `), "");
        const mimeType = lookupMimeType(fileName);

        Object.assign(ref, {
          phid,
          fileName,
          mimeType,
          blob: await phDownloadFile(phid, mimeType),
        });
      } catch (e) {
        console.info("Invalid file ref", ref.name);
        // Revert to old text
        descRemarkup = descRemarkup.replace(ref.replacement, ref.match);
        delete fileRefs[i];
      }
    }),
  ]);

  const descHTML = await phRemarkupToHtml(descRemarkup);
  let descMarkdown = nhm.translate(descHTML);

  // TODO: Comments
  // TODO: References/Links to other issues

  repoRefs.forEach(async (ref, i) => {
    descMarkdown = descMarkdown.replace(ref.replacement, ref.markdown);
  });

  /*
							/relate #issue1 #issue2
							 */

  console.log(glTitle, status);

  for (const projectPHID of projectPHIDs) {
    if (!phProjects.has(projectPHID)) {
      console.error("Unknown Project PHID", projectPHID);
      continue;
    }

    const { id } = phProjects.get(projectPHID);
    if (!projectMap.has(id)) {
      console.error(
        "Unknown Project ID (not in projects map)",
        id,
        "(" + projectPHID + ")"
      );
      continue;
    }

    const glProjectId = projectMap.get(id);

    if (Object.hasOwn(boards, projectPHID)) {
      const { columns } = boards[projectPHID];
      const column = columns[0].name; // Assume a task may only be assigned to one column (per project)
      labels.push(column);
    }

    if (process.env.DRY_RUN === "true") {
      console.info("Skip creation (dry-run)", glTitle);
      continue;
    }

    let description = descMarkdown;

    if (process.env.UPLOAD_FILES !== "false") {
      await Promise.all(
        fileRefs.map(async (fileRef) => {
          try {
            const res = await glUploadFile({
              project: glProjectId,
              fileName: fileRef.fileName,
              content: fileRef.blob,
            });

            if (res.markdown) {
              let newRef = res.markdown;
              if (!fileRef.withDetails) {
                newRef = newRef.replace(/^!/, "");
              }

              description = description.replace(fileRef.replacement, newRef);
            }

            console.info("file uploaded", res);
          } catch (e) {
            console.error("error uploading file", fileRef, e);
          }
        })
      );
    }

    const issueData = {
      title: glTitle,
      project: glProjectId,
      //assignee_id: assigneeUserName,
      created_at: new Date(dateCreated * 1000).toISOString(),
      description,
      labels: labels.join(",").trim(),
    };

    try {
      const res = await glCreateIssue(issueData);
      if (res.error) {
        console.error("Error creating issue!", res.error);
      } else {
        console.info("Created issue!", res.iid, {
          commands,
        });

        createdIssues[glProjectId] = createdIssues[glProjectId] || [];
        createdIssues[glProjectId].push({ res });

        // apply commands as comment?
        const commandRes = await glCreateComment({
          project: glProjectId,
          issue_iid: res.iid,
          body: commands,
        });
        if (commandRes.error) {
          console.error("Error applying commands", commandRes.error);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  return createdIssues;
}
