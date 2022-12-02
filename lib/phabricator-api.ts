let PH, PH_TOKEN;

export function phInit(baseUrl, token) {
	PH = baseUrl;
	PH_TOKEN = token;
}

async function ph(
	path,
	{ __method = "POST", ...params }: Record<string, string>
) {
	const res = await fetch(`${PH}${path.replace("^/", "")}`, {
		method: __method,
		body: new URLSearchParams({
			"api.token": PH_TOKEN,
			...params,
		}).toString(),
	});

	if (!res.ok) {
		console.error("ph error", res.statusText);
		return res;
	}

	const isJsonRes =
		res.headers.get("content-type").split(";")[0].trim().toLowerCase() ===
		"application/json";
	if (isJsonRes) {
		return await res.json();
	}

	return res;
}

export const phSearchTasks = async (searchParams) =>
	(await ph(`maniphest.search`, searchParams)).result.data;

export const phRemarkupToHtml = async (text) => {
	const res = await ph("remarkup.process", {
		context: "maniphest",
		"contents[0]": text,
	});
	return res.result[0].content;
};

export const phDownloadFile = async (phid, type) =>
	await ph("file.download", { phid }).then(
		(res) => new Blob([Buffer.from(res.result, "base64")], { type })
	);

export const phIdLookup = async (name) => {
	// TODO: Cache?
	const res = await ph("phid.lookup", { "names[0]": name });
	return res.result[name];
};
