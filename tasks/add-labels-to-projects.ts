import {
  glClearLabelsCache,
  glCreateProjectLabel,
  glGetProjectLabels,
} from "../lib/gitlab-api.js";

export async function addLabelsToProjects(config, projectMap) {
  for (const projectId of projectMap.values()) {
    const projectLabels = await glGetProjectLabels({ project: projectId });

    for (const labelName of Object.keys(config.defaultLabelsToAdd)) {
      if (projectLabels.some((label) => label.name === labelName)) {
        console.info("label already exists", labelName);

        continue;
      }

      const { color, description, priority } =
        config.defaultLabelsToAdd[labelName];
      const res = await glCreateProjectLabel({
        project: projectId,
        name: labelName,
        color,
        description,
        priority,
      });
      console.info("created label", res);
    }
  }

  glClearLabelsCache();
}
