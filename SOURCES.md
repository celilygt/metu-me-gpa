# Curriculum and calculation sources

Verified against METU Ankara sources on **24 September 2026**. This planner has no student's transcript. All starting requirements are a template. A student must enter completed courses, grades, approved shared courses and the curriculum that applies to their enrollment year.

## Mechanical Engineering

The [department curriculum](https://me.metu.edu.tr/major) supplies the credited major courses and the default sequence. With three-credit elective slots, the template has **44 credited requirements and 141 METU local credits**. These are calculated template totals, not a university assertion that every student's transcript must total exactly 141.

The [current academic catalog](https://catalog.metu.edu.tr/program.php?fac_prog=569) also includes **BA 100** and **OHS 301**, which the department's shorter curriculum table omits. The template therefore has ten zero-credit requirements: IS 100, OHS 101, BA 100, HIST 2201/2202, TURK 303/304, ME 300/400 and OHS 301. The catalog lists language-track alternatives for HIST and TURK. These requirements still need completion or approved exemption even though they add no GPA weight. Check enrollment-year applicability.

The [department elective rules](https://me.metu.edu.tr/elective-courses) specify five technical, one restricted, one free and two nontechnical elective slots. The restricted pool is ME 403, 405, 421, 426, 437, 476, 481, 492 or 496. The catalog labels six slots as technical electives. We preserve the department's more specific restricted requirement; this does not add a seventh technical slot. An elective placeholder is not an actual registered course. Its code, credits and approved category must be supplied. At most one technical elective may come from another engineering department under the published restrictions. At most one may be an ME graduate course, excluding ME 510 and ME 521.

## Mechatronics minor / yandal

The [official minor course list](https://me.metu.edu.tr/system/files/mechaminor_2_0.pdf) applies to registrations in or after Fall 2019. It has five compulsory groups:

| Group | Course choices | METU credits |
| --- | --- | --- |
| Introduction | ME 220 | 1 |
| Circuits | EE 281 or EE 201 | 3 or 4 |
| Statics | ME 205, CE 221 or AE 261 | 3 |
| Programming | CENG 240 or CENG 229 | 3 or 4 |
| Design | ME 462 | 3 |

Add at least four electives from the published pool, distinct from courses taken in the major. At least two must have a 4xx code. The full pool and local credits are in `curriculum.js`; a listing does not establish current availability. EE 209 is **not** a published substitute for EE 281. The default choices yield 25 minor credits, six potentially shared with the major. Thus 19 additional credits is one planning case, not the student's known remaining work.

Under the [minor directive](https://oidb.metu.edu.tr/en/node/62), the minor has its own transcript and GPA. Courses enter both programs only through approved counting and registration. ME 205 and CENG 240 are possible shared compulsory requirements; their template flags are assumptions to verify. At least four courses totaling at least 12 credits must differ from major courses. Prerequisites remain mandatory. A minor certificate requires major graduation. The major is not affected by minor performance. The directive refers to the undergraduate rules for minor completion; the planner uses 2.00 as the minor GPA target. Major CGPA below 2.00 results in leave from the minor; Article 15 separately sets a 1.00 major threshold for dismissal. Do not reduce these distinct rules to one threshold.

## GPA and repeats

The [Registrar's grade scale](https://oidb.metu.edu.tr/en/course-credit-system) supplies AA 4.00, BA 3.50, BB 3.00, CB 2.50, CC 2.00, DC 1.50, DD 1.00, FD 0.50 and FF/NA 0.00. S, U, EX, I and W have no GPA weight. NI is a course status excluded from GPA, not a letter-grade coefficient. GPA weights use local credits, not ECTS.

The [undergraduate regulations](https://oidb.metu.edu.tr/en/node/24), Articles 21 and 26–33, establish the calculation and completion rules. Divide grade points by included local credits and round to two decimal places. The latest repeated grade replaces the previous grade even if worse. FF, FD, NA, U and W require repetition, except NI courses. A passing course may be repeated within four following semesters, subject to the stated six-repeat limit and exceptions. Replacing an elective with a different code requires the appropriate approved replacement. Graduation requires all curriculum courses passed with at least DD or S and CGPA at least 2.00. A numerical forecast cannot certify graduation.

## Scheduling and source limits

The [department registration guide](https://me.metu.edu.tr/registration-guide) links a [detailed PDF](https://me.metu.edu.tr/tr/system/files/kayitrehberi/undergrad_registration_guide.pdf). It preserves the thermo-fluids design pool, requires registration for summer practice, and points students to OIBS page 64 for live courses, sections, quotas and surname eligibility. Courses and minor requirements in a planning term are not a registration guarantee. No complete live prerequisite graph or current course timetable is built into this static template.

The guide still describes a three-semester passing-course repeat window and older probation restrictions. The current university regulation describes four semesters and updated probation provisions. Use the current university regulation for these rules. The guide's English description of fourth-year eligibility is ambiguous, so the planner does not turn it into an automatic ME 407/410 eligibility gate. The previous app's A–KA / KA–Z semester swaps are not verified against a current surname schedule and must not be presented as current policy.

All decisions about equivalence, course counting, enrollment-year adjustments and actual registration remain with the student's department and advisors. This source note records concrete limits of the data; it does not imply that a transcript has been checked.
