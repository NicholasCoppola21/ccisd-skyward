// Logs into a skyward account using a .env file in the root directory and prints out your attendance for the year.
// See README.md and .env.example for details.
// You can use dotenv OR you can pass it in directly with `SKYWARD_EMAIL=email SKYWARD_PASSWORD=password yarn start examples/attendence.js`
import SkywardAccountManager from "../SkywardAccountManager.js";
import "dotenv/config.js";

const email = process.env.SKYWARD_EMAIL;
const password = process.env.SKYWARD_PASSWORD;

if (!email || !password) {
  console.log("Enviroment variables are not setup properly!");
  process.exit();
}

const account = new SkywardAccountManager(true); // Sets debug to true

console.log(await account.login(email, password)); // Logs AuthObject or error

console.log(await account.fetchAttendance());
