import { request } from "undici";
import GradeBookManager from "./GradeBookManager.js";

export enum SkywardError {
  "NOT_LOGGED_IN" = "NOT_LOGGED_IN",
  "LOGIN_EXPIRED" = "LOGIN_EXPIRED",
  "INVALID_LOGIN_OR_LOCKED" = "INVALID_LOGIN_OR_LOCKED",
  // Not sure why this happens. Usually works after a retry.
  "CANT_CONNECT_TO_SKYWARD" = "CANT_CONNECT_TO_SKYWARD",
}

/**
 * Contains all of the information you need to perform your own authenticated requests on Skyward pages
 */
export interface AuthObject {
  /**
   * From the home page response
   */
  encses: string;
  /**
   * Fetched from extra info
   */
  cookie: string;
  /**
   * From the home page response
   */
  sessionId: string;
}

export default class SkywardAccountManager {
  /**
   * I'm not sure what this values exact purpose is, but it is attached to all skyward profile requests.
   * A third session tracking variable?
   */
  private encses?: string;
  /**
   * Used for session tracking profile requests
   */
  private cookie?: string;
  /**
   * Used for session tracking profile requests
   */
  private sessionId?: string;

  /**
   * Manage your skyward account! Must run the `login` method first and then the specific request you want.
   * @param debug If true will log debug infromation to the console
   */
  public constructor(private debug: boolean = false) {}

  /**
   * Logs into your skyward account, required before running other functions
   * This stores the SessionID, Encses (From home payload), and a session cookie.
   * @param email Email to use
   * @param password Password to use
   * @returns true if the login was succesfull, otherwise the error (See SkywardErrorEnum).
   */
  public async login(
    email: string,
    password: string,
  ): Promise<AuthObject | SkywardError> {
    const hAnon = await this.fetchhAnon();
    const extraInfo = await this.fetchExtraInfo(email, password, hAnon);

    if (SkywardAccountManager.isError(extraInfo)) return extraInfo;

    // Note: I am not sure if all of these are necessarily required. I trimmed about ~50 off the payload the official website sends.
    const homeRequestArgs = [
      ...Object.entries({
        dwd: extraInfo[0],
        wfaacl: extraInfo[3],
        encses: extraInfo[14],
        nameid: extraInfo[4],
        CurrentProgram: "skyportlogin.w",
        duserid: email,
        HomePage: "sepadm01.w",
        hAnon,
        "web-data-recid": extraInfo[1],
        "wfaacl-recid": extraInfo[2],
        "User-Type": "2",
        enc: extraInfo[13],
        hforgotLoginPage: "seplog01",
        userAgent:
          "Mozilla/5.0+(X11;+Linux+x86_64;+rv:121.0)+Gecko/20100101+Firefox/121.0",
      }),
    ]
      .map((entry) => `${entry[0]}=${entry[1]}`)
      .join("&");

    const homeRequest = await request(
      "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfhome01.w",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-GPC": "1",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          referrer:
            "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/seplog01.w",
        },
        body: homeRequestArgs,
        method: "POST",
      },
    );

    const text = await homeRequest.body.text();

    [this.encses] = text.split("sff.sv('encses', '")[1].split("');");

    this.cookie = `${extraInfo[extraInfo.length - 2]}=${
      extraInfo[extraInfo.length - 1]
    }`;

    [this.sessionId] = text.split("sff.sv('sessionid', '")[1].split("');");

    this.log(
      `Encses: ${this.encses} Cookie: ${this.cookie} SessionID: ${this.sessionId}`,
    );

    return {
      cookie: this.cookie,
      encses: this.encses,
      sessionId: this.sessionId,
    };
  }

  /**
   * Fetchs the users' gradebook. You MUST run `login` first or this will fail.
   * @param raw If true will return the raw unmodified HTML
   */
  public async fetchGradebook(
    raw = false,
  ): Promise<GradeBookManager | string | SkywardError> {
    if (!this.cookie || !this.encses || !this.sessionId)
      return SkywardError.NOT_LOGGED_IN;
    const gradebookRequest = await request(
      "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfgradebook001.w",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-GPC": "1",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          Cookie: this.cookie,
          referrer:
            "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfhome01.w",
        },

        body: `sessionid=${encodeURIComponent(this.sessionId)}&encses=${
          this.encses
        }`,
        method: "POST",
      },
    );

    const gradeBookRaw = await gradebookRequest.body.text();

    if (
      gradeBookRaw.includes(
        `Your session has expired and you have been logged out.`,
      )
    )
      return SkywardError.LOGIN_EXPIRED;

    if (raw) return gradeBookRaw;

    return new GradeBookManager(gradeBookRaw, this.debug);
  }

  /**
   * Fetch attendance related information
   * @param raw If true will return unmodified HTML
   * @returns Attendance Data, raw HTML if raw is specified, or an error.
   */
  public async fetchAttendance(raw = false): Promise<
    | {
        date: Date;
        reason: string;
        periods: string;
        classes: string[];
      }[]
    | string
    | SkywardError
  > {
    if (!this.cookie || !this.encses || !this.sessionId)
      return SkywardError.NOT_LOGGED_IN;
    const result = await request(
      "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfattendance001.w",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/x-www-form-urlencoded",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
          Cookie: this.cookie,
          referrer:
            "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfhome01.w",
        },

        body: `sessionid=${encodeURIComponent(this.sessionId!)}&encses=${
          this.encses
        }`,
        method: "POST",
      },
    );

    const text = await result.body.text();

    if (text.includes(`Your session has expired and you have been logged out.`))
      return SkywardError.LOGIN_EXPIRED;

    if (raw) return text;

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
      const args = SkywardAccountManager.MAIN_ATTENDANCE_REGEX.exec(copy);

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
      const args = SkywardAccountManager.ATTENDANCE_CLASSES_ID.exec(copy);

      if (args) {
        copy = copy.slice(args.index + args[0].length);
        const [id] = args.slice(1);

        let copy1 = args[0];

        while (true) {
          const args1 =
            SkywardAccountManager.INNER_ATTENDANCE_CLASSES_REGEX.exec(copy1);

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
  }

  /**
   * Fetchs the hAnon (hidden value sent on each HTML page to track you across requests)
   * @returns hAnon Text
   */
  private async fetchhAnon(): Promise<string> {
    const prelimHTMLRequest = await request(
      "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/seplog01.w",
    );

    const hAnonHTMLReqest = await prelimHTMLRequest.body.text();

    const hAnon = hAnonHTMLReqest.split('hAnon" value="')[1].split('"')[0];

    this.log(`hAnon: ${hAnon}`);

    return hAnon;
  }

  /**
   * Technically, this fetchs the login token information that is sent to the newly opened skyward window normally.
   * This "extra info" is then used to fetch the SessionID and Enceses from the home page on the gradebook home page.
   * @param email The email that it logs in with
   * @param password The password that it logs in with
   * @param hAnon Anonymous tracking token, fetch with fetchhAnon, likely intended for cross request tracking.
   * @returns Extra Info payload
   */
  private async fetchExtraInfo(
    email: string,
    password: string,
    hAnon: string,
  ): Promise<string[] | SkywardError> {
    // Note: I am not sure if all of these are necessarily required. I trimmed about ~50 off the payload the official website sends.
    const EXTRA_INFO_REQUEST_PARAMS = [
      ...Object.entries({
        requestAction: "eel",
        method: "extrainfo",
        codeType: "tryLogin",
        codeValue: email,
        login: email,
        password,
        CurrentProgram: "skyportlogin.w",
        HomePage: "sepadm01.w",
        hAnon,
        hforgotLoginPage: "seplog01",

        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",

        fwtimestamp: Date.now(),
      }),
    ]
      .map((entry) => `${entry[0]}=${entry[1]}`)
      .join("&");

    const extraInfoRequest = await request(
      "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/skyporthttp.w",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/x-www-form-urlencoded",
          "Sec-GPC": "1",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          referrer:
            "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/seplog01.w",
        },
        body: EXTRA_INFO_REQUEST_PARAMS,
        method: "POST",
      },
    );

    const loginRequestText = await extraInfoRequest.body.text();

    if (
      loginRequestText.includes(
        `We are unable to validate the information entered`,
      )
    ) {
      return SkywardError.INVALID_LOGIN_OR_LOCKED;
    }

    this.log(`Extra Info Request Text:`);
    this.log(loginRequestText);

    return loginRequestText.replace("<li>", "").replace("</li>", "").split("^");
  }

  private log(message: unknown) {
    if (this.debug) console.log(message);
  }

  /**
   * Finds all absenses in the groups:
   * Date | Reason | Period | Unique ID (For fetching classes)
   * Fetch classes using the 2nd (and then 3rd) regexes below
   */
  private static MAIN_ATTENDANCE_REGEX =
    /<tr class="(?:odd|even)"><td scope="row" style="white-space:nowrap">([^<]+)<\/td><td>([^<]+)<\/td><td style="white-space:nowrap">([^<]+)<\/td><td><a id='(\w+)' name='\w+' (?:style='white-space:nowrap' )?href="javascript:void\(0\)" >([^<]+)</;

  /**
   * Finds the classes block by ID in the groups:
   * ID
   *
   * Use the INNER_attendance_CLASSES_REGEX to find the classes.
   */
  private static ATTENDANCE_CLASSES_ID =
    /(?:<a id=\\\w+\\u0027 name=\\\w+\\u0027 href=\\u0022javascript:void\(0\)\\u0022 >[^<]+<\/a>(?:<br \/>)?)+[^#]+#(\w+)/;

  /**
   * Finds classes from a class block
   */
  private static INNER_ATTENDANCE_CLASSES_REGEX =
    /<a id=\\\w+\\u0027 name=\\\w+\\u0027 href=\\u0022javascript:void\(0\)\\u0022 >([^<]+)<\/a>/;

  public static isError(val: unknown | SkywardError): val is SkywardError {
    return Object.values(SkywardError).includes(val as SkywardError);
  }
}
