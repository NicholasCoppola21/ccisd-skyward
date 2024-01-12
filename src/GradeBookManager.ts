export interface Class {
  name: string;
  teacher: string;
  period: number;
  timeRange: string;
}

export default class GradeBookManager {
  /**
   * Stores all of your classes by name
   */
  public readonly classDetails = new Map<string, Class>();

  /**
   * Stores just class names for ease of use
   */
  public readonly classNames: string[] = [];

  /**
   * Stores grades by class name, contains blanks denoted by N/A
   */
  public readonly classGrades = new Map<
    string,
    { code: string; grade: string }[]
  >();

  /**
   * Stores grades directly pulled from tables within the HTML.
   * This list will list all of the grades for each term for each class (Every grade in a column for a class and then the next class)
    Format: `"ShortCode Grade". Both can be missing. See regex at the bottom for details.
  */
  //   private rawGrades: string[];

  /**
   * Pulls the class name, period, time, and then name (in that order) from the HTML.
   */

  /**
   * Parses data from Skyward's gradebook HTML page for ease of use
   * @param rawText The raw HTML for the gradebook webpage
   */
  public constructor(
    rawText: string,
    private debug?: boolean,
  ) {
    this.log(`Obtained ${this.getAllClassMatches(rawText)} classes`);
    this.log(`Obtained ${this.getAllGrades(rawText)} grades`);
    this.log(this.classDetails);
    this.log(this.classGrades);
  }

  /**
   * Grabs all classes it can find in the HTML using the CLASS_REGEX defined below.
   * @param text - Copy of raw HTML.
   * @returns The number of classes that it obtained.
   */
  private getAllClassMatches(text: string): number {
    let n = 0;

    // remove match and rerun scan
    while (true) {
      const args = GradeBookManager.CLASS_REGEX.exec(text);

      if (args) {
        const [name, period, time, teacher] = [...args.slice(1)];
        this.classDetails.set(name, {
          name,
          period: Number(period),
          teacher,
          timeRange: time,
        });
        this.classNames.push(name);

        text = text.slice(args.index + args[0].length);
        n++;
      } else break;
    }
    this.log(`Found ${n} classes!`);
    this.log([...this.classDetails.values()]);
    return n;
  }

  /**
   * Grabs all grades it can find in the HTML using the GRADE_REGEX defined below.
   * getAllClasses must be run first because it relies on it for associating the grade with a class.
   * @param text - Copy of raw HTML.
   * @returns The number of grades that it obtained
   */
  private getAllGrades(text: string): number {
    let n = 0;

    let curClass = 0;

    let prevShortCode: string = "";
    // remove match and rerun scan
    while (true) {
      const args = GradeBookManager.GRADE_REGEX.exec(text);

      if (args) {
        let [shortCode, grade] = [
          // If the first set for normal grades doesn't capture them and it goes to exceptions 2 & 3 then they stay undefined by regex. This accounts for that.
          ...args.slice(args[1] === undefined && args[2] === undefined ? 3 : 1),
        ];
        if (!grade) grade = "N/A";

        text = text.slice(args.index + args[0].length);

        n++;

        this.log(
          `Found grade Shortcode: ${shortCode} Grade: ${grade} Current Class: ${curClass}`,
        );

        if (!this.classGrades.has(this.classNames[curClass])) {
          this.classGrades.set(this.classNames[curClass], []);
        }

        // If there is no shortcode, then it is a semester exam.
        if (!shortCode) {
          if (prevShortCode && prevShortCode === "Q2") {
            // semester 1 final exam
            this.classGrades
              .get(this.classNames[curClass])
              ?.push({ code: "SE1", grade });
          } else {
            // semester 2 final exam
            this.classGrades
              .get(this.classNames[curClass])
              ?.push({ code: "SE2", grade });
          }
          continue;
        }

        // If this code starts with FIN, then that means its the last grade for the class
        if (shortCode === "FIN") {
          this.classGrades
            .get(this.classNames[curClass])
            ?.push({ code: shortCode, grade });
          curClass++;
        } else {
          this.classGrades
            .get(this.classNames[curClass])
            ?.push({ code: shortCode, grade });
        }

        prevShortCode = shortCode;
      } else break;
    }
    return n;
  }

  private log(message: unknown) {
    if (this.debug) console.log(message);
  }

  private static CLASS_REGEX =
    /<a id='\w+' name='\w+' href="javascript:void\(0\)" >([\w &]+)<\/a><\/span><\/td><\/tr><tr><td style="padding-left:10px"><label class="[\w ]+" style="padding-right:3px;width:auto">Period<\/label>(\d)<span class='[\w ]+' style='padding-left:5px;'>([\w -:]+)<\/span><\/td><\/tr><tr><td style="padding-left:10px"><a id='\w+' name='\w+' href="javascript:void\(0\)" >([\w ]+)<\/a><\/td><\/tr><\/table><\/div><\/div>/;

  /**
   * Pulls all grades from the HTML. This includes blank grades. After all matches are found, your data will include every term for a class period and then the next class in that order
   * Currently, this regex does not capture entire class terms.
   * Instead you have to rebuild by using the fact that the grades are finished once you see FIN grade (optional)
   * If FIN has a grade then it is finished.
   * If there is no shortcode, then it was a final exam for the semester.
   * If there is no grade, then it is a blank spot (Blanks needed for identifying the end of classes)
   * Order by group: ShortCode Grade (both optional)
   * Exs. `S1 100`, `S1`, `FIN`, `Q1 100`, `P7 500`
   *
   * Examples of how to apply these regexs above
   */
  private static GRADE_REGEX =
    /(?:<a id='\w+' name='\w+' data-sId='\w+' data-eId='\w+' data-cNI='\w+' data-trk='\w+' data-sec='\w+' data-gId='\w+' data-bkt='[\w ]+' data-lit='(\w+)' data-isEoc='\w+' href=\\"javascript:void\(0\)\\" >(\d+)<\\\/a>)|(?:<td {2}style='cursor:pointer' class='fB emptyGrade' id='showGradeInfo' data-sId='\w+' data-eId='\w+' data-cNI='\w+' data-trk='\w+' data-sec='\w+' data-gId='\w+' data-bkt='[\w ]+' data-lit='(\w+)' data-pos='left'><div class='[\w _]+'><\\\/div><\\\/td>)|(?:<div class='\w+'>(\d+)<\\\/div>)/;
}
