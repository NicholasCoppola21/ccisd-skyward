/**
 * Finds all absenses in the groups:
 * Date | Reason | Period | Unique ID (For fetching classes)
 * Fetch classes using the 2nd (and then 3rd) regexes below
 */
const MAIN_ATTENDANCE_REGEX =
  /<tr class="(?:odd|even)"><td scope="row" style="white-space:nowrap">([^<]+)<\/td><td>([^<]+)<\/td><td style="white-space:nowrap">([^<]+)<\/td><td><a id='(\w+)' name='\w+' (?:style='white-space:nowrap' )?href="javascript:void\(0\)" >([^<]+)</;

/**
 * Finds the classes block by ID in the groups:
 * ID
 *
 * Use the INNER_attendance_CLASSES_REGEX to find the classes.
 */
const ATTENDANCE_CLASSES_ID =
  /(?:<a id=\\\w+\\u0027 name=\\\w+\\u0027 href=\\u0022javascript:void\(0\)\\u0022 >[^<]+<\/a>(?:<br \/>)?)+[^#]+#(\w+)/;

/**
 * Finds classes from a class block
 */
const INNER_ATTENDANCE_CLASSES_REGEX =
  /<a id=\\\w+\\u0027 name=\\\w+\\u0027 href=\\u0022javascript:void\(0\)\\u0022 >([^<]+)<\/a>/;

export interface AbsentEvent {
  date: Date;
  reason: string;
  periods: string;
  classes: string[];
}
/**
 * Parses an attendance HTML page
 * @param text The HTML to parse
 */
export const parseAttendanceHTML = (text: string): AbsentEvent[] => {
  const attendance: {
    id: string;
    date: Date;
    periods: string;
    reason: string;
    classes: string[];
  }[] = [];

  // STEP 1: Parse out all absent dates, reasons, and periods.
  let copy = text;

  while (true) {
    const args = MAIN_ATTENDANCE_REGEX.exec(copy);

    if (args) {
      copy = copy.slice(args.index + args[0].length);
      const [date, reason, periods, id, classes] = args.slice(1);
      if (classes === "View Classes") {
        attendance.push({
          classes: [],
          date: new Date(date),
          id,
          periods,
          reason,
        });
      } else {
        attendance.push({
          classes: [classes],
          date: new Date(date),
          id,
          periods,
          reason,
        });
      }
    } else {
      break;
    }
  }

  // STEP 2: Parse out all class HTML blocks

  copy = text;

  while (true) {
    const args = ATTENDANCE_CLASSES_ID.exec(copy);

    if (args) {
      copy = copy.slice(args.index + args[0].length);
      const [id] = args.slice(1);

      let copy1 = args[0];

      while (true) {
        const args1 = INNER_ATTENDANCE_CLASSES_REGEX.exec(copy1);

        if (args1) {
          copy1 = copy1.slice(args1.index + args1[0].length);
          attendance.find((s) => s.id === id)?.classes.push(args1[1]);
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  return attendance.map(({ classes, date, periods, reason }) => ({
    classes,
    date,
    periods,
    reason,
  }));
};
