// import type SkywardAccountManager from "./SkywardAccountManager.js";
import Class from "../SkywardClass.js";

/**
 * Every Short Code that can be produced by a gradeset
 * Can be converted to longcode by calling the static method GradeBookManager#shortToLong
 */
export enum ShortCode {
  "P1" = "P1",
  "P2" = "P2",
  "Q1" = "Q1",
  "P3" = "P3",
  "P4" = "P4",
  "Q2" = "Q2",
  "SE1" = "SE1",
  "S1" = "S1",
  "P5" = "P5",
  "P6" = "P6",
  "Q3" = "Q3",
  "P7" = "P7",
  "P8" = "P8",
  "Q4" = "Q4",
  "SE2" = "SE2",
  "S2" = "S2",
  "FIN" = "FIN",
}

/**
 * Manages, parses, and abstracts your gradebook into Classes.
 */
export default class GradeBookManager {
  public classes = new Map<string, Class>();

  /**
   * Parses data from Skyward's gradebook HTML page for ease of use
   * @param rawText The raw HTML for the gradebook webpage
   */
  public constructor(
    rawText: string,
    private debug?: boolean,
  ) {
    this.log(`Obtained ${this.stage1(rawText)} classes`);
    this.log(`Obtained ${this.stage2(rawText)} term grades`);
    this.log(`Obtained ${this.stage3(rawText)} assignments`);
    this.log(this.classes);
  }

  /**
   * Grabs all classes it can find in the HTML using the CLASS_REGEX defined below.
   * @param text - Copy of raw HTML.
   * @returns The number of classes that it obtained.
   */
  private stage1(text: string): number {
    let n = 0;

    // remove match and rerun scan
    while (true) {
      const args = GradeBookManager.CLASS_REGEX.exec(text);

      if (args) {
        const [name, period, time, teacher] = [...args.slice(1)];
        this.classes.set(name, new Class(name, Number(period), time, teacher));
        text = text.slice(args.index + args[0].length);
        n++;
      } else break;
    }
    this.log(`Found ${n} classes!`);
    return n;
  }

  /**
   * Grabs all grades it can find in the HTML using the GRADE_REGEX defined below.
   * getAllClasses must be run first because it relies on it for associating the grade with a class.
   * @param text - Copy of raw HTML.
   * @returns The number of grades that it obtained
   */
  private stage2(text: string): number {
    let n = 0;

    let curClass = 0;

    let prevShortCode: string = "";
    // remove match and rerun scan
    while (true) {
      const args = GradeBookManager.GRADE_REGEX.exec(text);

      if (args) {
        const shortCode = args[2] ?? args[4];
        const grade = args[3] ?? args[5] ?? undefined;
        const gId = args[1];

        if (gId && Number(gId)) {
          const c = [...this.classes.values()][curClass];
          if (c) {
            c.assignmentCode = Number(gId);
          }
        }

        text = text.slice(args.index + args[0].length);

        if (this.classes.size - 1 < curClass) {
          // This shouldn't ever happen.

          this.log(
            "We have grades for classes that were not found by the class regex!",
          );
          return n;
        }

        n++;

        // If there is no shortcode, then it is a semester exam.
        if (!shortCode) {
          if (prevShortCode && prevShortCode === "Q2") {
            // semester 1 final exam
            [...this.classes.values()][curClass].termGrades.push({
              term: ShortCode.SE1,
              grade: Number(grade) ? Number(grade) : undefined,
            });
          } else {
            // semester 2 final exam
            [...this.classes.values()][curClass]?.termGrades.push({
              term: ShortCode.SE2,
              grade: Number(grade) ? Number(grade) : undefined,
            });
          }
          continue;
        }

        // If this code starts with FIN, then that means its the last grade for the class
        if (shortCode === "FIN") {
          [...this.classes.values()][curClass]?.termGrades.push({
            term: ShortCode.FIN,
            grade: Number(grade) ? Number(grade) : undefined,
          });
          curClass++;
        } else {
          [...this.classes.values()][curClass]?.termGrades.push({
            term: ShortCode[shortCode as keyof typeof ShortCode],
            grade: Number(grade) ? Number(grade) : undefined,
          });
        }

        prevShortCode = shortCode;
      } else break;
    }
    return n;
  }

  private stage3(text: string) {
    let n = 0;

    while (true) {
      const args = GradeBookManager.ASSIGNMENT_REGEX.exec(text);

      if (args) {
        const [gId, name, dueDate, shortCode] = args.slice(1);
        text = text.slice(args.index + args[0].length);

        const grade = this.stage3dot5(args[0]);

        if (grade === "None") {
          this.log(
            `No grade was found for the assignment ${name} ${shortCode} ${gId}`,
          );
        }

        const match = [...this.classes.values()].find(
          (c) => c.assignmentCode === Number(gId),
        );

        if (!match) {
          this.log(
            `Assignment found that doesn't have a matching gID (${gId}) ${name} ${shortCode} ${grade}`,
          );
          continue;
        }

        // date format: 09\/07\/2023

        match.assignmentGrades.push({
          grade: Number(grade) ? Number(grade) : undefined,
          name,
          term: ShortCode[shortCode as keyof typeof ShortCode],
          dueDate: new Date(dueDate.replaceAll("\\/", "-")),
        });
        n++;
      } else {
        return n;
      }
    }
  }

  /**
   * Scans the assignment block for a grade.
   * @param text Entire Assignemnt Block (From <a> to </div>)
   * @returns The grade, or None if not found
   */
  private stage3dot5(text: string): string {
    while (true) {
      const match = GradeBookManager.ASSIGNEMNT_GRADE_REGEX.exec(text);
      if (match) {
        if (Number(match[1])) return match[1];
        text = text.slice(match.index + match[0].length);
      } else {
        return "None";
      }
    }
  }

  private log(message: unknown) {
    if (this.debug) console.log(message);
  }

  /**
   * Fetchs the class name, period, time, and then name (in that order) from the HTML.
   */
  private static CLASS_REGEX =
    /<a id='\w+' name='\w+' href="javascript:void\(0\)" >([\w &]+)<\/a><\/span><\/td><\/tr><tr><td style="padding-left:10px"><label class="[\w ]+" style="padding-right:3px;width:auto">Period<\/label>(\d)<span class='[\w ]+' style='padding-left:5px;'>([\w -:]+)<\/span><\/td><\/tr><tr><td style="padding-left:10px"><a id='\w+' name='\w+' href="javascript:void\(0\)" >([\w ]+)<\/a><\/td><\/tr><\/table><\/div><\/div>/;

  /**
   * Fetchs all grades from the HTML. This includes blank grades. After all matches are found, your data will include every term for a class period and then the next class in that order
   * Currently, this regex does not capture entire class terms.
   * Instead you have to rebuild by using the fact that the grades are finished once you see FIN grade (optional)
   * If FIN has a grade then it is finished.
   * If there is no shortcode, then it was a final exam for the semester.
   * If there is no grade, then it is a blank spot (Blanks needed for identifying the end of classes)
   * Order by group: gID (unique class code to link it to assignments) ShortCode Grade (last two can be optional)
   *
   * Examples of how to apply these regexs above
   */
  private static GRADE_REGEX =
    /(?:<a id='\w+' name='\w+' data-sId='\w+' data-eId='\w+' data-cNI='\w+' data-trk='\w+' data-sec='\w+' data-gId='(\w+)' data-bkt='[\w ]+' data-lit='(\w+)' data-isEoc='\w+' href=\\"javascript:void\(0\)\\" >(\d+)<\\\/a>)|(?:<td {2}style='cursor:pointer' class='fB emptyGrade' id='showGradeInfo' data-sId='\w+' data-eId='\w+' data-cNI='\w+' data-trk='\w+' data-sec='\w+' data-gId='\w+' data-bkt='[\w ]+' data-lit='(\w+)' data-pos='left'><div class='[\w _]+'><\\\/div><\\\/td>)|(?:<div class='\w+'>(\d+)<\\\/div>)/;

  /**
   * Generic Assignemnt Regex
   * Captures class gId, assignment name, due date, short code.
   * To capture the grade, you have to cycle through the input with the below regex:
   */
  private static ASSIGNMENT_REGEX =
    /<a id='showAssignmentInfo' name='showAssignmentInfo' data-sId='\w+' data-gId='(\w+)' data-aId='\w+' data-pos='right' data-type='default' data-maxHeight='550' data-minWidth='400' data-maxWidth='450' data-title='Assignment Details' href=\\"javascript:void\(0\)\\" >([\w ]+)<\\\/a><\\\/br><label class=\\"sf_labelRight aLt fXs fIl aD\\">Due:<\\\/label><span class='fXs fIl'>(\w+\\\/\w+\\\/\w+)&nbsp;&nbsp;\((\w+)\)<\\\/span><\\\/div><\\\/div><\\\/td>"},(?:{"h":"<td class='[\w ]+'><div class='height26 gW_12469_009_all'>(?:&nbsp;|\w+)<\\\/div><\\\/td>"},?)+]/;

  /**
   * Scans an assignment block for the grade because the place changes depending on term.
   */
  private static ASSIGNEMNT_GRADE_REGEX =
    /<div class='height26 gW_12469_009_all'>(&nbsp;|\w+)<\\\/div>/;
}
