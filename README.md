# Clear Creek ISD Node.JS Skyward Wrapper

## This is in a beta state and might not act like you expect it to. Use with caution.

## NOTE: Pre 1.0 releases may include major changes as minor version changes. Expect updates to break code and if needed, pin the version to the latest patch.

## Goals:
- [x] Log into Skyward 
- [x] Fetch grades
- [x] Fetch classes & schedule
- [x] Parse out all grade information by class
- [X] Fetch assignments for each class by term
- [x] Fetch attendance 
- [x] Fetch report cards and process them*
- [x] Calculate GPA\*\*

\* Cannot parse progress report cards or STAAR EOC ones.

\*\* Currently only in an [example](https://github.com/NicholasCoppola21/ccisd-skyward/blob/main/src/examples/calc_weighted_gpa.ts). See top of file for explanation.
## WARNING: Rapid login attempts may block your account. I can not help you if this happens.

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