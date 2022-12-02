let GL, GL_TOKEN;

export function glInit(baseUrl, token) {
	GL = baseUrl;
	GL_TOKEN = token;
}

async function glBase(
	path,
	{ __method = "POST", ...init }: Record<string, any>
) {
	const res = await fetch(`${GL}${path.replace("^/", "")}`, {
		method: __method,
		headers: {
			"PRIVATE-TOKEN": GL_TOKEN,
		},
		...init,
	});

	return await res.json();
}

const gl = async (path, { __method, ...params }: Record<string, any>) =>
	await glBase(path, {
		__method,
		body: new URLSearchParams(params),
	});

export const glCreateIssueBoardList = async ({
	project,
	board,
	label,
}: {
	project: number;
	board: number;
	label: number;
}) => {
	return await gl(`/projects/${project}/boards/${board}/lists`, {
		label_id: label,
	});
};

export const glCreateIssueLink = async ({
	project,
	issue_iid,
	target_project_id,
	target_issue_iid,
	link_type, // (“relates_to”, “blocks”, “is_blocked_by”), defaults to “relates_to”).
}) => {
	return await gl(`/projects/${project}/issues/${issue_iid}/links`, {
		target_project_id,
		target_issue_iid,
		link_type,
	});
};

export const glCreateProjectLabel = async ({
	project,
	name,
	color,
	priority = "",
	description = "",
}: any) => {
	return await gl(`/projects/${project}/labels`, {
		name,
		color,
		priority,
		description,
	});
};

export const glCreateIssue = async ({
	project,
	//assignee_id,
	created_at,
	description,
	labels = "",
	title,
	weight,
}: any) => {
	return await gl(`/projects/${project}/issues`, {
		//assignee_id,
		created_at,
		description,
		labels,
		title,
		weight,
	});
};

export const glCreateComment = async ({
	project,
	issue_iid,
	body,
	created_at,
}: any & { project: string; issue_iid: string; body: string }) => {
	return await gl(`/projects/${project}/issues/${issue_iid}/notes`, {
		body,
		created_at,
	});
};

const projectBoardCache = new Map<number, any>();
export const glGetProjectBoards = async ({ project }) => {
	if (projectBoardCache.has(project)) {
		return projectBoardCache.get(project);
	}

	const res = await glBase(`/projects/${project}/boards`, {
		__method: "GET",
	});
	if (res.error || res.boards?.message) {
		console.error("error getting project boards", {
			project,
			error: res.error || res.boards?.message,
		});
		return null;
	}

	return res;
};

let projectLabelCache = new Map<number, any>();

export function glClearLabelsCache() {
	projectLabelCache = new Map<number, any>();
}

export const glGetProjectLabels = async ({ project }) => {
	if (projectLabelCache.has(project)) {
		return projectLabelCache.get(project);
	}

	const res = await glBase(`/projects/${project}/labels`, {
		__method: "GET",
	});
	if (res.error) {
		console.error("error getting project labels", { project });
		return null;
	}

	return res;
};

export const glUploadFile = async ({ project, fileName, content }) => {
	const fd = new FormData();
	fd.append("file", content, fileName);

	return await glBase(`/projects/${project}/uploads`, {
		body: fd,
	});
};

export const glEditIssue = async ({
	project,
	issue_iid,
	// TODO
}) => {
	return await gl(`/projects/${project}/issues/${issue_iid}`, {
		__method: "PUT",
		// TODO
	});
};
