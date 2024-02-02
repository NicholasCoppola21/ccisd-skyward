import { ShortCode } from "./parsers/GradeBookParser.js";

export interface TermGrade {
  term: ShortCode;
  grade?: number;
}

export interface AssignmentGrade {
  term: ShortCode;
  name: string;
  dueDate: Date;
  grade?: number;
}

export default class SkywardClass {
  public termGrades: TermGrade[] = [];
  public assignmentGrades: AssignmentGrade[] = [];
  public assignmentCode: number = 0;

  public constructor(
    public name: string,
    public period: number,
    public timeRange: string,
    public teacher: string,
  ) {}
}
