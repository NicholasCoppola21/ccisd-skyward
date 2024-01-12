import GradeBookManager, { type Class } from "../GradeBookManager.js";
import SkywardAccountManager from "../SkywardAccountManager.js";

const email = process.env.SKYWARD_EMAIL;
const password = process.env.SKYWARD_PASSWORD;

if (!email || !password) {
  console.log("Enviroment variables are not setup properly!");
  process.exit();
}

const account = new SkywardAccountManager(true); // Sets debug to true

console.log(await account.login(email, password)); // AuthObject or Error

const gradebook = await account.pullGradebook();

if (gradebook instanceof GradeBookManager) {
  console.log(`Here's all of my classes: ${gradebook.classNames.join(", ")}`);
  console.log(`Here's some info about all of my teachers:`);
  console.log(
    [...gradebook.classDetails.values()]
      .map(
        (c: Class) =>
          `I have ${c.name} taught by ${c.teacher} as period ${c.period} during ${c.timeRange}`,
      )
      .join("\n"),
  );
} else {
  console.error(gradebook); // Error!
}
