// Logs into a skyward account using a .env file in the root directory and prints out a lot of information about your grades.
// See README.md and .env.example for details.
// You can use dotenv OR you can pass it in directly with `SKYWARD_EMAIL=email SKYWARD_PASSWORD=password yarn start examples/gradebook.js`
import GradeBookManager from "../GradeBookManager.js";
import SkywardAccountManager from "../SkywardAccountManager.js";
import type SkywardClass from "../SkywardClass.js";

const email = process.env.SKYWARD_EMAIL;
const password = process.env.SKYWARD_PASSWORD;

if (!email || !password) {
  console.log("Enviroment variables are not setup properly!");
  process.exit();
}

const account = new SkywardAccountManager(true); // Sets debug to true

console.log(await account.login(email, password)); // AuthObject or Error

const gradebook = await account.fetchGradebook(); // Returns GradeBookManager Class

if (gradebook instanceof GradeBookManager) {
  console.log(
    `Here's all of my classes: ${Object.keys(gradebook.classes).join(", ")}`,
  );
  console.log(`Here's some info about all of my teachers:`);
  console.log(
    [...gradebook.classes.values()]
      .map(
        (c: SkywardClass) =>
          `I have ${c.name} taught by ${c.teacher} as period ${c.period} during ${c.timeRange}`,
      )
      .join("\n"),
  );

  console.log(`Here's some info about all of my grades:`);
  console.log(
    [...gradebook.classes.values()]
      .map(
        (c) =>
          `Term Grades for ${c.name}: ${c.termGrades
            .map((t) => `${t.term}: ${t.grade ? t.grade : "N/A"}`) // If a grade isn't inserted yet, it will be undefined
            .join(", ")}\nAssignments: ${c.assignmentGrades
            .map((a) => `${a.name}: ${a.grade ? a.grade : "N/A"} (${a.term})`) // If a grade isn't inserted yet (*/100), it will be undefined
            .join(", ")}`,
      )
      .join("\n"),
  );
} else {
  console.error(gradebook); // Error!
}
