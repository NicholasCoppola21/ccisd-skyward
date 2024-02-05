import { request } from "undici";
import GradeBookManager from "./parsers/GradeBookParser.js";
import { setTimeout as sleep } from "timers/promises";
import { writeFile } from "fs/promises";
import {
  parseReportCard,
  parseReportCardNames,
  type ReportCard,
  type ReportCardExtraInfo,
} from "./parsers/ReportCardParser.js";
import {
  parseAttendanceHTML,
  type AbsentEvent,
} from "./parsers/AttendanceParser.js";
import type SkywardClass from "./SkywardClass.js";

export enum SkywardError {
  "NOT_LOGGED_IN" = "NOT_LOGGED_IN",
  "LOGIN_EXPIRED" = "LOGIN_EXPIRED",
  "INVALID_LOGIN_OR_LOCKED" = "INVALID_LOGIN_OR_LOCKED",
  // Not sure why this happens. Usually works after a retry.
  "CANT_CONNECT_TO_SKYWARD" = "CANT_CONNECT_TO_SKYWARD",
  "INVALID_REPORT_CARD_NAMAE" = "INVALID_REPORT_CARD_NAME",
  "PDF_FAILED_TO_LOAD" = "PDF_FAILED_TO_LOAD",
  "REPORTCARD_NOT_SUPPORTED" = "REPORTCARD_NOT_SUPPORTED",
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
   * Used for keeping track of report card info.
   */
  private reportCards = new Map<string, ReportCardExtraInfo>();

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
   * @returns A map of class names with the {SkywardClass}
   */
  public async fetchGradebook(): Promise<
    Map<string, SkywardClass> | SkywardError
  > {
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

    return new GradeBookManager(gradeBookRaw, this.debug).classes;
  }

  /**
   * Fetch attendance related information
   * @returns Attendance Data, or an error.
   */
  public async fetchAttendance(): Promise<AbsentEvent[] | SkywardError> {
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

    return parseAttendanceHTML(text);
  }

  /**
   * Returns a list of report card name and the date they were processed
   * @returns A string array of report cards, or an error if there was an error
   */
  public async fetchReportCards(): Promise<
    { name: string; date: Date }[] | SkywardError
  > {
    if (!this.sessionId || !this.encses) return SkywardError.NOT_LOGGED_IN;

    const text = await (
      await request(
        "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfportfolio.w",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1",
            referrer:
              "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfhome01.w",
          },

          body: `sessionid=${this.sessionId}&encses=${this.encses}`,
          method: "POST",
        },
      )
    ).body.text();

    if (text.includes(`Your session has expired and you have been logged out.`))
      return SkywardError.LOGIN_EXPIRED;

    this.reportCards = parseReportCardNames(text);

    return [...this.reportCards.entries()].map((a) => ({
      name: a[0],
      date: a[1].date,
    }));
  }

  /**
   *
   * @param name The name of the report card to fetch, can be obtained with fetchReportCardNames
   * @param writeToFile If true will write the report card to file
   * @returns A {ReportCard}, or a {SkywardError}
   */
  public async fetchReportCard(
    name: string,
    writeToFile = false,
  ): Promise<ReportCard | SkywardError> {
    if (
      name.toLowerCase().includes("progress") ||
      name.toLowerCase().includes("staar")
    ) {
      this.log(
        `Progress/STAAR EOC report card formats are not currently supported.`,
      );
      return SkywardError.REPORTCARD_NOT_SUPPORTED;
    }
    if (this.reportCards.size === 0)
      // fetchReportCardNames returns a bunch of other hidden ids for the report cards that we need.
      await this.fetchReportCards();

    if (!this.reportCards.has(name))
      return SkywardError.INVALID_REPORT_CARD_NAMAE;

    if (!this.sessionId || !this.encses) return SkywardError.NOT_LOGGED_IN;

    /**
     * STAGE 1: ADD THE REPORT CARD TO QUEUE USING INFORMATION GATHERED FROM FETCHREPORTCARDNAMES
     */

    const { queue_desc, queue_prog, queue_params } =
      this.reportCards.get(name)!;

    const params = {
      action: "addToPrintQueue",
      queue_desc: queue_desc.replaceAll(" ", "+"),
      queue_prog,
      queue_params,
      ishttp: "true",
      sessionid: this.sessionId,
      encses: this.encses,
      requestId: Date.now().toString(),
    };

    const text = await (
      await request(
        "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/httploader.p?file=sfmainhttp001.w",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
            Accept: "text/xml",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            Cookie: this.cookie,
            referrer:
              "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfportfolio.w",
          },
          body: Object.entries(params)
            .map((s) => `${s[0]}=${s[1]}`)
            .join("&"),
          method: "POST",
        },
      )
    ).body.text();

    if (text.includes(`Your session has expired and you have been logged out.`))
      return SkywardError.LOGIN_EXPIRED;

    /**
     * STAGE 2: CHECK ON REPORT CARD STATUS AFTER 3 SECONDS AND THEN EVERY 1.5 SECONDS
     */

    const queue_rowid = text.split("message:'")[1].split("'")[0];
    const queue_token = text.split("message:'")[2].split("'")[0];

    this.log(queue_rowid);
    this.log(queue_token);

    await sleep(3500);

    const checkPrintParams = {
      action: "checkPrintQueue",
      queue_rowid,
      queue_token,
      sessionid: this.sessionId,
      encses: this.encses,
      ishttp: true,
      "javascript.filesAdded":
        "jquery.1.8.2.js%2Cqsfmain001.css%2Cqsfmain001.min.js",
      requestId: Date.now().toString(),
    };

    while (true) {
      checkPrintParams.requestId = Date.now().toString();

      this.log(`Checking print status..`);

      const printStatus = await (
        await request(
          "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/httploader.p?file=sfmainhttp001.w",
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
              Accept: "*/*",
              "Accept-Language": "en-US,en;q=0.5",
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
              "X-Requested-With": "XMLHttpRequest",
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "same-origin",
              referrer:
                "https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/sfportfolio.w",
            },
            body: Object.entries(checkPrintParams)
              .map((s) => `${s[0]}=${s[1]}`)
              .join("&"),
            method: "POST",
          },
        )
      ).body.text();

      if (
        printStatus.includes(
          `Your session has expired and you have been logged out.`,
        )
      )
        return SkywardError.LOGIN_EXPIRED;

      if (printStatus.includes("message:'C'")) {
        /**
         * STAGE 3: DOWNLOAD PDF AND ANALYZE IT
         */

        this.log(
          `PDF File link: https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/${
            printStatus.split("window.open(\\u0027")[1].split("\\u0027")[0]
          }`,
        );

        const buffer = await request(
          `https://skyward-ccisdprod.iscorp.com/scripts/wsisa.dll/WService=wseduclearcreektx/${
            printStatus.split("window.open(\\u0027")[1].split("\\u0027")[0]
          }`,
        ).then((req) => req.body.arrayBuffer());

        if (writeToFile) void writeFile(`${name}.pdf`, Buffer.from(buffer));

        return parseReportCard(name, Buffer.from(buffer));
      }

      await sleep(1500);
    }
  }

  /**
   * Fetches the hAnon (hidden value sent on each HTML page to track you across requests)
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
   * Those 2 params are then used as authentication tokens on every other page.
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

  public static isError(val: unknown | SkywardError): val is SkywardError {
    return Object.values(SkywardError).includes(val as SkywardError);
  }
}
