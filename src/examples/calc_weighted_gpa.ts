/**
 * This may become an official part of the library, but currently I don't want too because of the unreliability of class level assignments -- There's too many edge cases
 * I also do not want to promote unnecessary spam to the Skyward API, and I also don't want to force caching on the library to reoslve that.
 * I'll think about it, but for now a worked example of calculating GPA is good enough.
 *
 * Calculates your weighted GPA!
 * Note: Uses the CCISD 5.0 scale, where the highest you can get is if you get all A's and you take all honors classes or above is a 6.0.
 *
 * Input the report cards to consider in reportCardNames, if you do not know the name just try and if you're wrong it'll give you the official list.
 * The format from Skyward is not consistent on report card names.
 *
 * How it works:
 * - Fetches each report card using the provided list with the SKYWARD_EMAIL and SKYWARD_PASSWORD enviroment variables
 * - Caches them into a file called report_cards.json for future runs
 * - Attempts to automatically assign if a class is level 2 or level 1 (Nothing on the report card indicates this so it does its best to guess)
 *  - If the class ends with an AP, APG, or if the ending word is H, or if the ending word starts wit HO, then it is a level 1. Otherwise it's a level 2.
 * - For each report card it:
 *  - Averages each class semester average
 *     - If the average is above 70, uses the formula: level_offset + (semesterAverage - 70) * .1 to calculate GPA for that class
 *     - If it's below 70, uses 0.0
 *  - Averages the average GPA from each class to get the GPA for that individual report card.
 * - Averages the average GPA from each report card to get your combined weighted gpa.
 *
 * If you can find a better way to automagically assign class weights, please feel free to PR
 *
 * To use, make sure you have a SKYWARD_EMAIL and SKYWARD_PASSWORD enviroment variable set. You can add a dependency like dotenv to do this if you want.
 * Alternatively, you can pass them in before running. Ex: SKYWARD_EMAIL=email SKYWARD_PASSWORD=password node dist/examples/calc_weighted_gpa.js
 */

import { readFile, writeFile } from "fs/promises";
import SkywardAccountManager from "../SkywardAccountManager.js";
import type { ReportCard } from "../parsers/ReportCardParser.js";
import "dotenv/config";

// NOTE: A Q4 report card is the final report card for that year and includes ALL quarters and semesters.
// For accuracy purposes, do not include 2 report cards from the same school year.
const reportCardNames = [
  // All report cards to consider
  "2024 Q2 Report Card",
  "2023 Q4 Report Card",
  "2022 - Q4 Report Card",
];

const reportCardDatas = new Map<string, ReportCard>();

const nFormat = (n: number): number => Math.floor(n * 100) / 100;

// automatically tries to use cache to reduce spam, to reset delete the file.
const file = await readFile("./report_cards.json", "utf-8").catch(() => {});

// eslint-disable-next-line no-negated-condition
if (!file) {
  const email = process.env.SKYWARD_EMAIL;
  const password = process.env.SKYWARD_PASSWORD;

  if (!email || !password) {
    console.log("Enviroment variables are not setup properly!");
    process.exit();
  }

  const account = new SkywardAccountManager(true); // Sets debug to true

  console.log(await account.login(email, password)); // Logs AuthObject or error

  const reportCardsList = await account.fetchReportCardNames();

  reportCardNames.forEach((card) => {
    if (!reportCardsList.includes(card)) {
      console.log(
        `${card} is not in the report card list! Check that it is one of these:`,
      );
      console.log(reportCardsList);
      process.exit();
    }
  });

  const reportCards = await Promise.all(
    reportCardNames.map((card) => account.fetchReportCard(card)),
  );

  for (const reportCard of reportCards) {
    if (SkywardAccountManager.isError(reportCard)) {
      console.log(`ERROR: ${reportCard}`);
      process.exit();
    }

    reportCardDatas.set(reportCard.name, reportCard);
  }

  // save report cards to file to reduce spam from skyward
  void writeFile(
    "./report_cards.json",
    JSON.stringify([...reportCardDatas.values()]),
  );
} else {
  for (const reportCard of JSON.parse(file) as ReportCard[]) {
    reportCardDatas.set(reportCard.name, reportCard);
  }
}

// Attempt to auto assign class levels
// Logic: If the start of the end ends with an AP or an H (For ex, Intro to Engineering and Design is an honors class that looks like INTR ENG DSN H on a report card) then it's a level 1 class.
// Anything else is a level 2. This will not always be right but it should be right most of the time, for this reason you should always have a way for users to edit the autoselections.

// Formula =  (semesterGrade - 70) * .1 + level offset
// (if below 70, you will get a 0.0 regardless of level)
// level offsets:
// Level 1: 3.0 (AP/Honors)
// Level 2: 2.0 (Regular)
// Level 3: 0.0 (Special Education Modified Courses)

const averages = [];

for (const reportCard of reportCardDatas.values()) {
  const gpas = [];
  console.log(reportCard.name);

  for (const rcClass of reportCard.classes) {
    // Guess the class level
    let weight: number;
    // Check if the class ends with AP, APG, or if the ending starts with an H or HO for honors
    if (
      rcClass.class.endsWith("AP") ||
      rcClass.class.endsWith("APG") ||
      rcClass.class.endsWith("H") ||
      rcClass.class
        .split(" ")
        [rcClass.class.split(" ").length - 1].startsWith("HO")
    )
      weight = 3.0;
    else weight = 2.0;

    // Find the average semester grade
    const a = rcClass.terms.filter((t) =>
      reportCard.name.includes("Q3") || reportCard.name.includes("Q4")
        ? t.term.startsWith("SM")
        : t.term.startsWith("SM1"),
    );
    const avg = a.reduce((p, c) => p + (c.grade as number), 0) / a.length;

    // Calculate GPA and push to array
    if (avg < 70) {
      gpas.push(0.0);
      continue;
    }
    const gpa = weight + (avg - 70) * 0.1;
    gpas.push(gpa);
    console.log(
      `Class: ${rcClass.class} Level: ${
        weight === 3 ? 1 : 2
      } Average SEM Grade: ${nFormat(avg)} GPA: ${nFormat(gpa)}`,
    );
  }

  // Push the average GPA to the array -- this is your GPA for that reportcard term.
  const aGPA = gpas.reduce((p, c) => p + c, 0) / gpas.length;
  averages.push(aGPA);
  console.log(`Average GPA for report card: ${nFormat(aGPA)}`);
}

// Average the average GPAS for each report card term -- This represents your GPA across the listed report cards.
console.log(
  `GPA: ${nFormat(averages.reduce((p, c) => p + c, 0) / averages.length)}`,
);

// console.log(await account.fetchReportCard("2023 Q4 Report Card")); // Logs your report card!
