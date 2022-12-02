import { promisify } from "node:util";
import * as mysql from "mysql";

let con;

export const phProjects = new Map();
export const phUsers = new Map();

type QueryAsync = (query: string) => Promise<any>;
const queryAsync: QueryAsync = promisify((query, cb) =>
  con.query(query, (err, results, fields) =>
    cb(err, {
      results,
      fields,
    })
  )
);

export const initDb = async () => {
  con = mysql.createConnection({
    port: process.env.PH_DB_PORT ? Number(process.env.PH_DB_PORT) : 3306,
    user: process.env.PH_DB_USER || "root",
    password: process.env.PH_DB_PASSWORD || "",
  });

  con.connect();

  const { results: userResults } = await queryAsync(`SELECT *
													 FROM phabricator_user.user`);
  for (const userResult of userResults) {
    const phid = userResult.phid.toString();
    phUsers.set(phid, {
      phid,
      id: userResult.id,
      userName: userResult.userName,
    });
  }

  const { results: projectResults } = await queryAsync(`SELECT *
														FROM phabricator_project.project`);
  for (const projectResult of projectResults) {
    const phid = projectResult.phid.toString();
    const { id, name, primarySlug } = projectResult;

    phProjects.set(phid, { phid, id, name, primarySlug });
  }
};

export const endDb = () => {
  con.end();
};
