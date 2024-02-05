/**
 * Parses report card PDF buffers into a 2d array
 * Accounts for blanks the best it can
 */
import { writeFile } from "fs/promises";
import { PdfReader } from "pdfreader";

// If term is CON then it will be your behavior "grade" for the previous term
// This will be a string. Otherwise it will be a number
export interface ReportCardTerm {
  term: string;
  grade: number | string;
}

export interface ReportCard {
  name: string;
  classes: ReportCardClass[];
  credits: number;
}

export interface ReportCardClass {
  class: string;
  terms: ReportCardTerm[];
}

export interface WeightedReportCardClass extends ReportCardClass {
  level: 1 | 2 | 3;
}

export interface WeightedReportCard extends ReportCard {
  classes: WeightedReportCardClass[];
}

export interface ReportCardExtraInfo {
  queue_desc: string;
  queue_prog: string;
  queue_params: string;
  date: Date;
}

/**
 * Finds all the names and associated ids within the report card html
 * Groups: ID | Name
 */
const REPORTCARD_NAME_ID_REGEX =
  /<a id='(\w+)' name='\w+' href="javascript:void\(0\)" >([^<]+)<\/a><\/td><td>Report Card<\/td><td>([^<]+)/;

/**
 * Finds all of the required data to push a reportcard to queue from the id found with the above regex
 * Groups: queue_desc (replace spaces with +) | queue_prog | queue_params | ref_id
 */
const REPORTCARD_ID_INFO_REGEX =
  /Queue","([^"]+)", "([^"]+)", "([^"]+)"\)},'#(\w+)/;

export const parseReportCardNames = (
  text: string,
): Map<string, ReportCardExtraInfo> => {
  const idToNameDate = new Map<string, { name: string; date: Date }>();
  const reportCards = new Map<string, ReportCardExtraInfo>();
  void writeFile("test.html", text);
  for (
    let input = text, match = REPORTCARD_NAME_ID_REGEX.exec(input);
    match;
    input = input.slice(match.index + match[0].length),
      match = REPORTCARD_NAME_ID_REGEX.exec(input)
  ) {
    const [id, name, date] = match.slice(1);
    idToNameDate.set(id, {
      name,
      // date parser won't parse terms like "6:33pm" so we have to remove them
      date: new Date(date.split(" ").slice(0, -1).join(" ")),
    });
  }

  for (
    let input = text, match = REPORTCARD_ID_INFO_REGEX.exec(input);
    match !== null;
    input = input.slice(match.index + match[0].length),
      match = REPORTCARD_ID_INFO_REGEX.exec(input)
  ) {
    const [queue_desc, queue_prog, queue_params, ref_id] = match.slice(1);
    if (idToNameDate.has(ref_id)) {
      reportCards.set(idToNameDate.get(ref_id)!.name, {
        queue_desc,
        queue_params,
        queue_prog,
        date: idToNameDate.get(ref_id)!.date,
      });
    }
  }

  return reportCards;
};

const pdfReader = new PdfReader({ debug: true });

const parsePDFBuffer = async (buffer: Buffer): Promise<string> =>
  new Promise((resolve, reject) => {
    let string = "";
    let stop = true;
    pdfReader.parseBuffer(buffer, (error, data) => {
      if (error) return reject(error);
      if (data && data.text) {
        if (data.text.includes("Comments:")) {
          return resolve(string);
        }
        if (data.text.includes("Course")) {
          stop = false;
        }

        if (!stop) string += `${data.text}\n`;
      }
    });
  });

/**
 * Sorts a specific row of elements and accounts for blanks.
 * @param name Helps figure out if a single semester class is in the fall or spring (Q1-Q2=fall, Q3-Q4=spring)
 * @param row The row of elements
 * @returns The sorted row of elements with a constant row size of 19 elements.
 */
export const sortRow = (name: string, row: string[]): string[] => {
  const array: string[] = Array(19).fill(0);
  // eslint-disable-next-line
  array[0] = row[0];
  // at q1: 8 | 6

  let offset = 0;

  // spring semester class
  if (row.length <= 13 && (name.includes("Q3") || name.includes("Q4"))) {
    if (row.length <= 8) {
      array[17] = row[row.length - 1];
      array[16] = row[row.length - 2];
      array[15] = row[row.length - 3];
      row = row.slice(1);
    }
    offset = 8;
  } else if (row.length <= 8) {
    // fill back 4 - 1
    let s = -3;
    let o = 0;
    if (row.length === 8) {
      array[16] = row[row.length - 2];
      array[15] = row[row.length - 3];
      o += 2;
      s = -5;
    }

    array[17] = row[row.length - 1];

    array[8] = row[row.length - (2 + o)];
    array[7] = row[row.length - (3 + o)];

    row = row.slice(0, s);
  }
  // at q2: 12|11
  // 11 when fall semester only class (so no tardies or absences in s2)
  else if (row.length <= 13) {
    if (row.length === 11) {
      array[18] = row[row.length - 1];
      array[17] = row[row.length - 2];
      row = row.slice(0, -2);
    } else {
      array[17] = row[row.length - 1];
      array[16] = row[row.length - 2];
      array[15] = row[row.length - 3];
      row = row.slice(0, -3);
    }
  }
  // at q3: 14
  else if (row.length <= 14) {
    array[17] = row[row.length - 1];
    array[16] = row[row.length - 2];
    array[15] = row[row.length - 3];

    row = row.slice(0, -3);
  }
  // at q4: 19

  // fill the rest of the spaces

  for (let i = 1; i < row.length; i++) {
    array[i + offset] = row[i];
  }

  return array;
};

/**
 * Parses a report card and returns a ReportCardClass array interface.
 * @param buffer The PDF file to process
 */
export const parseReportCard = async (
  name: string,
  buffer: Buffer,
): Promise<ReportCard> => {
  const text = await parsePDFBuffer(buffer);
  const args = text.split("\n").filter((s: string) => s !== "");
  let allElements = args.slice(0, -1);
  const credits = Number(args[args.length - 1]);

  const startOfSecondRow =
    allElements.slice(1).findIndex((s: string) => s.length > 3) + 1;

  const allTerms = allElements.slice(0, startOfSecondRow);
  allElements = allElements.slice(startOfSecondRow);

  const fixed = [];

  while (true) {
    const next = allElements.findIndex(
      (s: string, i: number) =>
        s.length > 3 && i !== 0 && Number.isNaN(Number(s)),
    );
    if (next < 0)
      allElements.findIndex(
        (s: string) => s.length > 3 && !Number.isNaN(Number(s)),
      );
    if (next >= 0) {
      fixed.push(sortRow(name, allElements.slice(0, next)));
      allElements = allElements.slice(next);
    } else {
      fixed.push(sortRow(name, allElements));
      break;
    }
  }

  return {
    name,
    credits,
    classes: fixed.map((s: string[]) => ({
      class: s[0],
      terms: s.slice(1).map((element: string, i: number) => ({
        term: allTerms.slice(1)[i],
        grade: Number.isNaN(Number(element)) ? element : Number(element),
      })),
    })),
  };
};

/**
 * Transforms the class level to its respective GPA weight offset.
 */
export const levelToWeight = {
  1: 3.0,
  2: 2.0,
  3: 0.0,
};

export const guessLevel = (name: string): 1 | 2 => {
  if (
    name.endsWith("AP") ||
    name.endsWith("APG") ||
    name.endsWith("H") ||
    name.split(" ")[name.split(" ").length - 1].startsWith("HO")
  )
    return 1;
  return 2;
};

/**
 * Averages an array.
 * @param array The numerical array to average values from
 * @returns The average (mean) of the array.
 */
export const avgArray = (array: number[]): number =>
  array.reduce((p, c) => p + c, 0) / array.length;

/**
 * Calculates the GPA for a speciifc report card term.
 * @param reportCard - The report card to calculate the GPAs for
 * @param term - The semester to base it off of (SM1 or SM2)
 * @param levelFunction - The function to use to get the level for each class, by default uses the exported guessLevel function.
 *
 * Note: If you provide a {WeightedReportCard} for reportCard instead of a {ReportCard} it will use the weights in there instead and NOT call the levelFunctino.
 *
 * Note: A weight should be a 1,2, or 3 for a level 1,2, or 3 class respectively.
 *
 * How this function works:
 * Calculates the GPA for each class using the formula `offset + (grade - 70) * .1` where offset is the class level weight offset
 * It then returns the mean value of all of the class GPAs.
 *
 * To calculate an overall GPA, you should use this function on each semester for each report card and then average all of them together at the end.
 *
 */
export const calcSemesterGPA = (
  reportCard: ReportCard | WeightedReportCard,
  term: "SM1" | "SM2",
  levelFunction: (name: string) => 1 | 2 | 3 = guessLevel,
): null | number => {
  const gpas: number[] = [];
  for (const rcClass of reportCard.classes) {
    const rcTerm = rcClass.terms.find((t) => t.term === term);
    if (!rcTerm || !Number(rcTerm?.grade)) return null;

    const grade = rcTerm.grade as number;
    if (grade < 70) {
      gpas.push(0.0);
      continue;
    }

    const weight =
      (rcClass as WeightedReportCardClass).level === undefined
        ? levelToWeight[levelFunction(rcClass.class)]
        : (rcClass as WeightedReportCardClass).level;

    gpas.push(weight + (grade - 70) * 0.1);
  }

  return avgArray(gpas);
};

/**
 * Calculates your overall GPA!
 * @param reportCards The report cards to consider in the GPA Calculation
 * @param levelFunction The function to use to determine class level. Note: If you use WeightedReportCards instead of ReportCards this function will not be ran.
 * @returns An object containing the overall GPA and each semester's gpa
 */
export const calcGPA = (
  reportCards: ReportCard[] | WeightedReportCard[],
  levelFunction: (name: string) => 1 | 2 | 3 = guessLevel,
): {
  reportCardGPAs: Map<string, number[]>;
  overall: number;
} => {
  const gpaMap = new Map<string, number[]>();
  const overall: number[] = [];

  for (const reportCard of reportCards) {
    const sm1 = calcSemesterGPA(reportCard, "SM1", levelFunction);
    const sm2 = calcSemesterGPA(reportCard, "SM2", levelFunction);

    if (sm1 !== null) {
      overall.push(sm1);
      gpaMap.set(reportCard.name, [sm1]);
    }
    if (sm2 !== null) {
      overall.push(sm2);
      gpaMap.get(reportCard.name)?.push(sm2);
    }
  }

  return { overall: avgArray(overall), reportCardGPAs: gpaMap };
};
