# Clear Creek ISD Node.JS Skyward Wrapper

## This is in a beta state and might not act like you expect it to. Use with caution.

## Goals:
- [x] Log into Skyward 
- [x] Pull grades
- [x] Pull classes & schedule
- [x] Parse out all grade information by class
- [ ] Pull assignments for each class by term
- [ ] Pull report cards and process them
- [ ] Calculate GPA

## WARNING: Rapid login attempts may block your account. I can not help you if this happens.

## Quick Start Guide
- Install the package using NPM/yarn: `npm install ccisd-skyward`/`yarn add ccisd-skyward` 
- Simply instantiate the `SkywardAccountManager` class and call `login`

```ts
const account = new SkywardAccountManager(true);

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
```

See the examples directory for code snippets.

## Manual Compilation Guide
*Note: You need [yarn](https://yarnpkg.com/) for this. I recommend downloading from the link so you get the proper version and not the one off NPM*

1. Clone the repository 
2. Install all dependencies with yarn by typing `yarn`
3. Build with `yarn build`. You can then test by running the examples and making sure they work as expected.

*If you plan on contributing you might find `yarn watch` useful, it will automatically recompile files when you save them.*

## Security

See `SECURITY.md`