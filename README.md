# Clear Creek ISD Node.JS Skyward Wrapper

## This is in a beta state and might not act like you expect it to. Use with caution.

## Goals:
- [x] Log into Skyward 
- [x] Pull grades
- [x] Pull classes & schedule
- [x] Parse out all grade information by class
- [X] Pull assignments for each class by term
- [x] Pull attendance 
- [ ] Pull report cards and process them
- [ ] Calculate GPA

## WARNING: Rapid login attempts may block your account. I can not help you if this happens.

## Quick Start Guide
- Install the package using NPM/yarn: `npm install ccisd-skyward`/`yarn add ccisd-skyward` 
- Simply instantiate the `SkywardAccountManager` class and call `login`

Just 4 simple lines to pull your grades & attendance:
```ts
const account = new SkywardAccountManager(true); // Sets debug to true

console.log(await account.login(email, password)); // AuthObject or Error

const gradebook = await account.pullGradebook(); // Returns GradeBookManager Class or Error
const attendance = await account.pullAttendance(); // Returns attendance related information
```

See more in the [GradeBook Example](https://github.com/NicholasCoppola21/ccisd-skyward/blob/0b32ccfc0a7a425a034ff7642b6a8539e76db3b7/src/examples/gradebook.ts).

See the examples directory for code snippets.

## Manual Compilation Guide
*Note: You need [yarn](https://yarnpkg.com/) for this. I recommend downloading from the link so you get the proper version and not the one off NPM*

1. Clone the repository 
2. Install all dependencies with yarn by typing `yarn`
3. Build with `yarn build`. You can then test by running the examples and making sure they work as expected.

*If you plan on contributing you might find `yarn watch` useful, it will automatically recompile files when you save them.*

## Security

See `SECURITY.md`