# Clear Creek ISD Node.JS Skyward Wrapper

## Goals:
- [x] Log into Skyward 
- [x] Fetch grades
- [x] Fetch classes & schedule
- [x] Parse out all grade information by class
- [X] Fetch assignments for each class by term
- [x] Fetch attendance 
- [x] Fetch report cards and process them*
- [x] Calculate GPA

\* Cannot parse progress report cards or STAAR EOC ones.

## WARNING: Rapid login attempts may block your account. I can not help you if this happens.

## A Note on GPA Calculations
If you're a studeent that is graduation in the **year 2026 or beyond**, electives do NOT count towards GPA. To keep the GPA calculator in this program accurate; you have to **manually remove** these classes from the parsed ReportCard and then pass that to the gpa function. It is **NOT** automatically done.

## Quick Start Guide
- Install the package using NPM/yarn: `npm install ccisd-skyward`/`yarn add ccisd-skyward` 
- Simply instantiate the `SkywardAccountManager` class and call `login`

Just 5 simple lines to fetch your grades, attendance, and report card:
```ts
const account = new SkywardAccountManager(true); // Sets debug to true

console.log(await account.login(email, password)); // AuthObject or Error

const gradebook = await account.fetchGradebook(); // Returns GradeBookManager Class or Error
const attendance = await account.fetchAttendance(); // Returns attendance related information
const reportCard = await account.fetchReportCard("2023 Q4 Report Card"); // Returns your 2023 Q4 Report Card
```

See more in the [examples](https://github.com/NicholasCoppola21/ccisd-skyward/tree/main/src/examples)!

## Manual Compilation Guide
*Note: You need [yarn](https://yarnpkg.com/) for this. I recommend downloading from the link so you get the proper version and not the one off NPM*

1. Clone the repository 
2. Install all dependencies with yarn by typing `yarn`
3. Build with `yarn build`. You can then test by running the examples and making sure they work as expected.

*If you plan on contributing you might find `yarn watch` useful, it will automatically recompile files when you save them.*

## Security

See `SECURITY.md`